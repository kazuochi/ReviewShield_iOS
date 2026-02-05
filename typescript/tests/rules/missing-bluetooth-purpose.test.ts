/**
 * Tests for MissingBluetoothPurposeRule
 */
import { MissingBluetoothPurposeRule } from '../../src/rules/privacy/missing-bluetooth-purpose';
import { createContextObject } from '../../src/parsers/project-parser';
import { Severity, Confidence } from '../../src/types';

describe('MissingBluetoothPurposeRule', () => {
  it('should return no findings when no Bluetooth framework is linked', async () => {
    const context = createContextObject(
      '/test/project',
      { CFBundleIdentifier: 'com.example.app' },
      {},
      new Set(['UIKit', 'Foundation']),
      []
    );

    const findings = await MissingBluetoothPurposeRule.evaluate(context);
    expect(findings).toEqual([]);
  });

  it('should find missing NSBluetoothAlwaysUsageDescription when CoreBluetooth is linked', async () => {
    const context = createContextObject(
      '/test/project',
      { CFBundleIdentifier: 'com.example.app' },
      {},
      new Set(['CoreBluetooth']),
      []
    );

    const findings = await MissingBluetoothPurposeRule.evaluate(context);
    expect(findings).toHaveLength(1);
    expect(findings[0].ruleId).toBe('privacy-008-missing-bluetooth-purpose');
    expect(findings[0].severity).toBe(Severity.Critical);
    expect(findings[0].confidence).toBe(Confidence.High);
  });

  it('should find empty NSBluetoothAlwaysUsageDescription', async () => {
    const context = createContextObject(
      '/test/project',
      {
        CFBundleIdentifier: 'com.example.app',
        NSBluetoothAlwaysUsageDescription: '',
      },
      {},
      new Set(['CoreBluetooth']),
      []
    );

    const findings = await MissingBluetoothPurposeRule.evaluate(context);
    expect(findings).toHaveLength(1);
    expect(findings[0].title).toBe('Empty Bluetooth Usage Description');
  });

  it('should find placeholder NSBluetoothAlwaysUsageDescription', async () => {
    const context = createContextObject(
      '/test/project',
      {
        CFBundleIdentifier: 'com.example.app',
        NSBluetoothAlwaysUsageDescription: 'TODO: add real description',
      },
      {},
      new Set(['CoreBluetooth']),
      []
    );

    const findings = await MissingBluetoothPurposeRule.evaluate(context);
    expect(findings).toHaveLength(1);
    expect(findings[0].title).toBe('Placeholder Bluetooth Usage Description');
  });

  it('should return no findings when valid description exists', async () => {
    const context = createContextObject(
      '/test/project',
      {
        CFBundleIdentifier: 'com.example.app',
        NSBluetoothAlwaysUsageDescription: 'We use Bluetooth to connect to your heart rate monitor.',
      },
      {},
      new Set(['CoreBluetooth']),
      []
    );

    const findings = await MissingBluetoothPurposeRule.evaluate(context);
    expect(findings).toEqual([]);
  });
});
