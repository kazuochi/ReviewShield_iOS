/**
 * Tests for MissingFaceIdPurposeRule
 */
import { MissingFaceIdPurposeRule } from '../../src/rules/privacy/missing-face-id-purpose';
import { createContextObject } from '../../src/parsers/project-parser';
import { Severity, Confidence } from '../../src/types';

describe('MissingFaceIdPurposeRule', () => {
  it('should return no findings when no LocalAuthentication framework is linked', async () => {
    const context = createContextObject(
      '/test/project',
      { CFBundleIdentifier: 'com.example.app' },
      {},
      new Set(['UIKit', 'Foundation']),
      []
    );

    const findings = await MissingFaceIdPurposeRule.evaluate(context);
    expect(findings).toEqual([]);
  });

  it('should find missing NSFaceIDUsageDescription when LocalAuthentication is linked', async () => {
    const context = createContextObject(
      '/test/project',
      { CFBundleIdentifier: 'com.example.app' },
      {},
      new Set(['LocalAuthentication']),
      []
    );

    const findings = await MissingFaceIdPurposeRule.evaluate(context);
    expect(findings).toHaveLength(1);
    expect(findings[0].ruleId).toBe('privacy-009-missing-face-id-purpose');
    expect(findings[0].severity).toBe(Severity.Critical);
    expect(findings[0].confidence).toBe(Confidence.High);
  });

  it('should find empty NSFaceIDUsageDescription', async () => {
    const context = createContextObject(
      '/test/project',
      {
        CFBundleIdentifier: 'com.example.app',
        NSFaceIDUsageDescription: '',
      },
      {},
      new Set(['LocalAuthentication']),
      []
    );

    const findings = await MissingFaceIdPurposeRule.evaluate(context);
    expect(findings).toHaveLength(1);
    expect(findings[0].title).toBe('Empty Face ID Usage Description');
  });

  it('should find placeholder NSFaceIDUsageDescription', async () => {
    const context = createContextObject(
      '/test/project',
      {
        CFBundleIdentifier: 'com.example.app',
        NSFaceIDUsageDescription: 'TODO: add real description',
      },
      {},
      new Set(['LocalAuthentication']),
      []
    );

    const findings = await MissingFaceIdPurposeRule.evaluate(context);
    expect(findings).toHaveLength(1);
    expect(findings[0].title).toBe('Placeholder Face ID Usage Description');
  });

  it('should return no findings when valid description exists', async () => {
    const context = createContextObject(
      '/test/project',
      {
        CFBundleIdentifier: 'com.example.app',
        NSFaceIDUsageDescription: 'We use Face ID to securely authenticate you for quick login.',
      },
      {},
      new Set(['LocalAuthentication']),
      []
    );

    const findings = await MissingFaceIdPurposeRule.evaluate(context);
    expect(findings).toEqual([]);
  });
});
