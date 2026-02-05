/**
 * Tests for MissingEncryptionFlagRule
 */
import { MissingEncryptionFlagRule } from '../../src/rules/config/missing-encryption-flag';
import { createContextObject } from '../../src/parsers/project-parser';
import { Severity, Confidence } from '../../src/types';

describe('MissingEncryptionFlagRule', () => {
  it('should return no findings when ITSAppUsesNonExemptEncryption is set to false', async () => {
    const context = createContextObject(
      '/test/project',
      {
        CFBundleIdentifier: 'com.example.app',
        ITSAppUsesNonExemptEncryption: false,
      },
      {},
      new Set(['UIKit']),
      []
    );

    const findings = await MissingEncryptionFlagRule.evaluate(context);
    expect(findings).toEqual([]);
  });

  it('should return no findings when ITSAppUsesNonExemptEncryption is set to true', async () => {
    const context = createContextObject(
      '/test/project',
      {
        CFBundleIdentifier: 'com.example.app',
        ITSAppUsesNonExemptEncryption: true,
      },
      {},
      new Set(['UIKit']),
      []
    );

    const findings = await MissingEncryptionFlagRule.evaluate(context);
    expect(findings).toEqual([]);
  });

  it('should find missing ITSAppUsesNonExemptEncryption key', async () => {
    const context = createContextObject(
      '/test/project',
      {
        CFBundleIdentifier: 'com.example.app',
      },
      {},
      new Set(['UIKit']),
      []
    );

    const findings = await MissingEncryptionFlagRule.evaluate(context);
    expect(findings).toHaveLength(1);
    expect(findings[0].ruleId).toBe('config-002-missing-encryption-flag');
    expect(findings[0].severity).toBe(Severity.Medium);
    expect(findings[0].confidence).toBe(Confidence.High);
  });

  it('should have correct metadata', () => {
    expect(MissingEncryptionFlagRule.id).toBe('config-002-missing-encryption-flag');
    expect(MissingEncryptionFlagRule.name).toBe('Missing Export Compliance Flag');
    expect(MissingEncryptionFlagRule.severity).toBe(Severity.Medium);
  });
});
