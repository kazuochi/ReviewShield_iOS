/**
 * Tests for MissingSupportedOrientationsRule
 */
import { MissingSupportedOrientationsRule } from '../../src/rules/metadata/missing-supported-orientations';
import { createContextObject } from '../../src/parsers/project-parser';
import { Severity, Confidence } from '../../src/types';

describe('MissingSupportedOrientationsRule', () => {
  it('should return no findings when UISupportedInterfaceOrientations is set', async () => {
    const context = createContextObject(
      '/test/project',
      {
        CFBundleIdentifier: 'com.example.app',
        UISupportedInterfaceOrientations: ['UIInterfaceOrientationPortrait'],
      },
      {},
      new Set(['UIKit']),
      []
    );

    const findings = await MissingSupportedOrientationsRule.evaluate(context);
    expect(findings).toEqual([]);
  });

  it('should find missing UISupportedInterfaceOrientations key', async () => {
    const context = createContextObject(
      '/test/project',
      {
        CFBundleIdentifier: 'com.example.app',
      },
      {},
      new Set(['UIKit']),
      []
    );

    const findings = await MissingSupportedOrientationsRule.evaluate(context);
    expect(findings).toHaveLength(1);
    expect(findings[0].ruleId).toBe('metadata-002-missing-supported-orientations');
    expect(findings[0].severity).toBe(Severity.Medium);
    expect(findings[0].confidence).toBe(Confidence.High);
  });

  it('should find empty UISupportedInterfaceOrientations array', async () => {
    const context = createContextObject(
      '/test/project',
      {
        CFBundleIdentifier: 'com.example.app',
        UISupportedInterfaceOrientations: [],
      },
      {},
      new Set(['UIKit']),
      []
    );

    const findings = await MissingSupportedOrientationsRule.evaluate(context);
    expect(findings).toHaveLength(1);
    expect(findings[0].title).toBe('Empty Supported Orientations');
  });

  it('should return no findings with multiple orientations', async () => {
    const context = createContextObject(
      '/test/project',
      {
        CFBundleIdentifier: 'com.example.app',
        UISupportedInterfaceOrientations: [
          'UIInterfaceOrientationPortrait',
          'UIInterfaceOrientationLandscapeLeft',
          'UIInterfaceOrientationLandscapeRight',
        ],
      },
      {},
      new Set(['UIKit']),
      []
    );

    const findings = await MissingSupportedOrientationsRule.evaluate(context);
    expect(findings).toEqual([]);
  });

  it('should have correct metadata', () => {
    expect(MissingSupportedOrientationsRule.id).toBe('metadata-002-missing-supported-orientations');
    expect(MissingSupportedOrientationsRule.name).toBe('Missing Supported Orientations');
    expect(MissingSupportedOrientationsRule.severity).toBe(Severity.Medium);
  });
});
