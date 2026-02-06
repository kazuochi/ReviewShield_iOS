/**
 * Tests for ATSExceptionWithoutJustificationRule
 */
import { ATSExceptionWithoutJustificationRule } from '../../src/rules/config/ats-exception-without-justification';
import { createContextObject } from '../../src/parsers/project-parser';
import { Severity, Confidence } from '../../src/types';

describe('ATSExceptionWithoutJustificationRule', () => {
  it('should use the real Info.plist file path as the finding location', async () => {
    const infoPlistPath = '/test/project/Info.plist';
    const context = createContextObject(
      '/test/project',
      {
        CFBundleIdentifier: 'com.example.app',
        NSAppTransportSecurity: {
          NSAllowsArbitraryLoads: true,
        },
      },
      {},
      new Set(['UIKit']),
      [],
      infoPlistPath
    );

    const findings = await ATSExceptionWithoutJustificationRule.evaluate(context);

    expect(findings).toHaveLength(1);
    expect(findings[0].location).toBe(infoPlistPath);
  });

  it('should return no findings when no ATS configuration exists', async () => {
    const context = createContextObject(
      '/test/project',
      { CFBundleIdentifier: 'com.example.app' },
      {},
      new Set(['UIKit']),
      []
    );

    const findings = await ATSExceptionWithoutJustificationRule.evaluate(context);
    
    expect(findings).toEqual([]);
  });

  it('should find NSAllowsArbitraryLoads = true without exception domains', async () => {
    const context = createContextObject(
      '/test/project',
      {
        CFBundleIdentifier: 'com.example.app',
        NSAppTransportSecurity: {
          NSAllowsArbitraryLoads: true,
        },
      },
      {},
      new Set(['UIKit']),
      []
    );

    const findings = await ATSExceptionWithoutJustificationRule.evaluate(context);
    
    expect(findings).toHaveLength(1);
    expect(findings[0].ruleId).toBe('config-001-ats-exception-without-justification');
    expect(findings[0].severity).toBe(Severity.High);
    expect(findings[0].title).toBe('Insecure ATS Configuration - Arbitrary Loads Enabled');
  });

  it('should return no findings when ATS is configured with only exception domains', async () => {
    const context = createContextObject(
      '/test/project',
      {
        CFBundleIdentifier: 'com.example.app',
        NSAppTransportSecurity: {
          NSExceptionDomains: {
            'api.example.com': {
              NSExceptionAllowsInsecureHTTPLoads: true,
            },
          },
        },
      },
      {},
      new Set(['UIKit']),
      []
    );

    const findings = await ATSExceptionWithoutJustificationRule.evaluate(context);
    
    // Should only find the low-severity warning about missing TLS version
    const criticalFindings = findings.filter(f => f.severity === Severity.High);
    expect(criticalFindings).toEqual([]);
  });

  it('should find redundant configuration with both arbitrary loads and exception domains', async () => {
    const context = createContextObject(
      '/test/project',
      {
        CFBundleIdentifier: 'com.example.app',
        NSAppTransportSecurity: {
          NSAllowsArbitraryLoads: true,
          NSExceptionDomains: {
            'api.example.com': {
              NSExceptionAllowsInsecureHTTPLoads: true,
            },
          },
        },
      },
      {},
      new Set(['UIKit']),
      []
    );

    const findings = await ATSExceptionWithoutJustificationRule.evaluate(context);
    
    expect(findings.some(f => f.title === 'Redundant ATS Configuration')).toBe(true);
  });

  it('should find NSAllowsArbitraryLoadsInWebContent = true', async () => {
    const context = createContextObject(
      '/test/project',
      {
        CFBundleIdentifier: 'com.example.app',
        NSAppTransportSecurity: {
          NSAllowsArbitraryLoadsInWebContent: true,
        },
      },
      {},
      new Set(['UIKit']),
      []
    );

    const findings = await ATSExceptionWithoutJustificationRule.evaluate(context);
    
    expect(findings).toHaveLength(1);
    expect(findings[0].title).toBe('ATS Disabled for Web Content');
    expect(findings[0].severity).toBe(Severity.Medium);
  });

  it('should warn about insecure HTTP without minimum TLS version', async () => {
    const context = createContextObject(
      '/test/project',
      {
        CFBundleIdentifier: 'com.example.app',
        NSAppTransportSecurity: {
          NSExceptionDomains: {
            'legacy-api.example.com': {
              NSExceptionAllowsInsecureHTTPLoads: true,
            },
          },
        },
      },
      {},
      new Set(['UIKit']),
      []
    );

    const findings = await ATSExceptionWithoutJustificationRule.evaluate(context);
    
    expect(findings.some(f => 
      f.title.includes('Insecure HTTP Allowed for legacy-api.example.com')
    )).toBe(true);
  });

  it('should not warn when minimum TLS version is specified', async () => {
    const context = createContextObject(
      '/test/project',
      {
        CFBundleIdentifier: 'com.example.app',
        NSAppTransportSecurity: {
          NSExceptionDomains: {
            'legacy-api.example.com': {
              NSExceptionAllowsInsecureHTTPLoads: true,
              NSExceptionMinimumTLSVersion: 'TLSv1.2',
            },
          },
        },
      },
      {},
      new Set(['UIKit']),
      []
    );

    const findings = await ATSExceptionWithoutJustificationRule.evaluate(context);
    
    // Should have no findings since TLS is specified
    expect(findings).toEqual([]);
  });

  it('should return no findings when NSAllowsArbitraryLoads is false', async () => {
    const context = createContextObject(
      '/test/project',
      {
        CFBundleIdentifier: 'com.example.app',
        NSAppTransportSecurity: {
          NSAllowsArbitraryLoads: false,
        },
      },
      {},
      new Set(['UIKit']),
      []
    );

    const findings = await ATSExceptionWithoutJustificationRule.evaluate(context);
    
    expect(findings).toEqual([]);
  });

  it('should handle multiple exception domains', async () => {
    const context = createContextObject(
      '/test/project',
      {
        CFBundleIdentifier: 'com.example.app',
        NSAppTransportSecurity: {
          NSExceptionDomains: {
            'api1.example.com': {
              NSExceptionAllowsInsecureHTTPLoads: true,
            },
            'api2.example.com': {
              NSExceptionAllowsInsecureHTTPLoads: true,
            },
            'api3.example.com': {
              NSExceptionAllowsInsecureHTTPLoads: true,
              NSExceptionMinimumTLSVersion: 'TLSv1.2',
            },
          },
        },
      },
      {},
      new Set(['UIKit']),
      []
    );

    const findings = await ATSExceptionWithoutJustificationRule.evaluate(context);
    
    // Should find 2 domains without TLS version (api1 and api2), not api3
    const domainFindings = findings.filter(f => f.title.includes('Insecure HTTP Allowed'));
    expect(domainFindings).toHaveLength(2);
  });
});
