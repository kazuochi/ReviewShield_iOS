/**
 * Tests for MissingCameraPurposeRule
 */
import { MissingCameraPurposeRule } from '../../src/rules/privacy/missing-camera-purpose';
import { createContextObject } from '../../src/parsers/project-parser';
import { Severity, Confidence } from '../../src/types';

describe('MissingCameraPurposeRule', () => {
  it('should return no findings when no camera framework is linked', async () => {
    const context = createContextObject(
      '/test/project',
      { CFBundleIdentifier: 'com.example.app' },
      {},
      new Set(['UIKit', 'Foundation']),
      []
    );

    const findings = await MissingCameraPurposeRule.evaluate(context);
    
    expect(findings).toEqual([]);
  });

  it('should find missing NSCameraUsageDescription when AVFoundation is linked', async () => {
    const context = createContextObject(
      '/test/project',
      { CFBundleIdentifier: 'com.example.app' },
      {},
      new Set(['AVFoundation']),
      []
    );

    const findings = await MissingCameraPurposeRule.evaluate(context);
    
    expect(findings).toHaveLength(1);
    expect(findings[0].ruleId).toBe('privacy-001-missing-camera-purpose');
    expect(findings[0].severity).toBe(Severity.Critical);
    expect(findings[0].confidence).toBe(Confidence.High);
  });

  it('should find empty NSCameraUsageDescription', async () => {
    const context = createContextObject(
      '/test/project',
      {
        CFBundleIdentifier: 'com.example.app',
        NSCameraUsageDescription: '',
      },
      {},
      new Set(['AVFoundation']),
      []
    );

    const findings = await MissingCameraPurposeRule.evaluate(context);
    
    expect(findings).toHaveLength(1);
    expect(findings[0].title).toBe('Empty Camera Usage Description');
  });

  it('should find placeholder NSCameraUsageDescription', async () => {
    const context = createContextObject(
      '/test/project',
      {
        CFBundleIdentifier: 'com.example.app',
        NSCameraUsageDescription: 'TODO: add real description',
      },
      {},
      new Set(['AVFoundation']),
      []
    );

    const findings = await MissingCameraPurposeRule.evaluate(context);
    
    expect(findings).toHaveLength(1);
    expect(findings[0].title).toBe('Placeholder Camera Usage Description');
  });

  it('should return no findings when valid description exists', async () => {
    const context = createContextObject(
      '/test/project',
      {
        CFBundleIdentifier: 'com.example.app',
        NSCameraUsageDescription: 'We need camera access to take photos for your profile and to scan QR codes.',
      },
      {},
      new Set(['AVFoundation']),
      []
    );

    const findings = await MissingCameraPurposeRule.evaluate(context);
    
    expect(findings).toEqual([]);
  });

  it('should detect AVKit and VisionKit as camera frameworks', async () => {
    const contextAVKit = createContextObject(
      '/test/project',
      { CFBundleIdentifier: 'com.example.app' },
      {},
      new Set(['AVKit']),
      []
    );

    const contextVisionKit = createContextObject(
      '/test/project',
      { CFBundleIdentifier: 'com.example.app' },
      {},
      new Set(['VisionKit']),
      []
    );

    const findingsAVKit = await MissingCameraPurposeRule.evaluate(contextAVKit);
    const findingsVisionKit = await MissingCameraPurposeRule.evaluate(contextVisionKit);
    
    expect(findingsAVKit).toHaveLength(1);
    expect(findingsVisionKit).toHaveLength(1);
  });
});
