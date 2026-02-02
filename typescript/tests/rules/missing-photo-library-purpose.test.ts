/**
 * Tests for MissingPhotoLibraryPurposeRule
 */
import { MissingPhotoLibraryPurposeRule } from '../../src/rules/privacy/missing-photo-library-purpose';
import { createContextObject } from '../../src/parsers/project-parser';
import { Severity, Confidence } from '../../src/types';

describe('MissingPhotoLibraryPurposeRule', () => {
  it('should return no findings when no Photos framework is linked', async () => {
    const context = createContextObject(
      '/test/project',
      { CFBundleIdentifier: 'com.example.app' },
      {},
      new Set(['UIKit', 'Foundation']),
      []
    );

    const findings = await MissingPhotoLibraryPurposeRule.evaluate(context);
    
    expect(findings).toEqual([]);
  });

  it('should find missing NSPhotoLibraryUsageDescription when Photos is linked', async () => {
    const context = createContextObject(
      '/test/project',
      { CFBundleIdentifier: 'com.example.app' },
      {},
      new Set(['Photos']),
      []
    );

    const findings = await MissingPhotoLibraryPurposeRule.evaluate(context);
    
    expect(findings).toHaveLength(1);
    expect(findings[0].ruleId).toBe('privacy-004-missing-photo-library-purpose');
    expect(findings[0].severity).toBe(Severity.Critical);
    expect(findings[0].confidence).toBe(Confidence.High);
  });

  it('should find empty NSPhotoLibraryUsageDescription', async () => {
    const context = createContextObject(
      '/test/project',
      {
        CFBundleIdentifier: 'com.example.app',
        NSPhotoLibraryUsageDescription: '',
      },
      {},
      new Set(['Photos']),
      []
    );

    const findings = await MissingPhotoLibraryPurposeRule.evaluate(context);
    
    expect(findings).toHaveLength(1);
    expect(findings[0].title).toBe('Empty Photo Library Usage Description');
  });

  it('should find whitespace-only NSPhotoLibraryUsageDescription', async () => {
    const context = createContextObject(
      '/test/project',
      {
        CFBundleIdentifier: 'com.example.app',
        NSPhotoLibraryUsageDescription: '   ',
      },
      {},
      new Set(['Photos']),
      []
    );

    const findings = await MissingPhotoLibraryPurposeRule.evaluate(context);
    
    expect(findings).toHaveLength(1);
    expect(findings[0].title).toBe('Empty Photo Library Usage Description');
  });

  it('should find placeholder NSPhotoLibraryUsageDescription', async () => {
    const context = createContextObject(
      '/test/project',
      {
        CFBundleIdentifier: 'com.example.app',
        NSPhotoLibraryUsageDescription: 'TODO: add description',
      },
      {},
      new Set(['Photos']),
      []
    );

    const findings = await MissingPhotoLibraryPurposeRule.evaluate(context);
    
    expect(findings).toHaveLength(1);
    expect(findings[0].title).toBe('Placeholder Photo Library Usage Description');
  });

  it('should return no findings when valid description exists', async () => {
    const context = createContextObject(
      '/test/project',
      {
        CFBundleIdentifier: 'com.example.app',
        NSPhotoLibraryUsageDescription: 'We need access to your photos to let you choose images for your posts.',
      },
      {},
      new Set(['Photos']),
      []
    );

    const findings = await MissingPhotoLibraryPurposeRule.evaluate(context);
    
    expect(findings).toEqual([]);
  });

  it('should detect PhotosUI as a photo library framework', async () => {
    const context = createContextObject(
      '/test/project',
      { CFBundleIdentifier: 'com.example.app' },
      {},
      new Set(['PhotosUI']),
      []
    );

    const findings = await MissingPhotoLibraryPurposeRule.evaluate(context);
    
    expect(findings).toHaveLength(1);
    expect(findings[0].ruleId).toBe('privacy-004-missing-photo-library-purpose');
  });

  it('should check for empty NSPhotoLibraryAddUsageDescription when present', async () => {
    const context = createContextObject(
      '/test/project',
      {
        CFBundleIdentifier: 'com.example.app',
        NSPhotoLibraryUsageDescription: 'Valid description for reading photos.',
        NSPhotoLibraryAddUsageDescription: '',
      },
      {},
      new Set(['Photos']),
      []
    );

    const findings = await MissingPhotoLibraryPurposeRule.evaluate(context);
    
    expect(findings).toHaveLength(1);
    expect(findings[0].title).toBe('Empty Photo Library Add Usage Description');
  });
});
