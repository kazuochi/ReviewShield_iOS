/**
 * Tests for MissingLaunchStoryboardRule
 */
import { MissingLaunchStoryboardRule } from '../../src/rules/config/missing-launch-storyboard';
import { createContextObject } from '../../src/parsers/project-parser';
import { Severity, Confidence } from '../../src/types';

describe('MissingLaunchStoryboardRule', () => {
  it('should return no findings when UILaunchStoryboardName is set', async () => {
    const context = createContextObject(
      '/test/project',
      {
        CFBundleIdentifier: 'com.example.app',
        UILaunchStoryboardName: 'LaunchScreen',
      },
      {},
      new Set(['UIKit']),
      []
    );

    const findings = await MissingLaunchStoryboardRule.evaluate(context);
    expect(findings).toEqual([]);
  });

  it('should return no findings when UILaunchStoryboardName is empty string (SwiftUI lifecycle)', async () => {
    const context = createContextObject(
      '/test/project',
      {
        CFBundleIdentifier: 'com.example.app',
        UILaunchStoryboardName: '',
      },
      {},
      new Set(['UIKit']),
      []
    );

    const findings = await MissingLaunchStoryboardRule.evaluate(context);
    expect(findings).toEqual([]);
  });

  it('should find missing UILaunchStoryboardName key', async () => {
    const context = createContextObject(
      '/test/project',
      {
        CFBundleIdentifier: 'com.example.app',
      },
      {},
      new Set(['UIKit']),
      []
    );

    const findings = await MissingLaunchStoryboardRule.evaluate(context);
    expect(findings).toHaveLength(1);
    expect(findings[0].ruleId).toBe('config-003-missing-launch-storyboard');
    expect(findings[0].severity).toBe(Severity.Critical);
    expect(findings[0].confidence).toBe(Confidence.High);
  });

  it('should have correct metadata', () => {
    expect(MissingLaunchStoryboardRule.id).toBe('config-003-missing-launch-storyboard');
    expect(MissingLaunchStoryboardRule.name).toBe('Missing Launch Storyboard');
    expect(MissingLaunchStoryboardRule.severity).toBe(Severity.Critical);
  });
});
