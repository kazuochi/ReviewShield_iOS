/**
 * Tests for ATTTrackingMismatchRule
 */
import { ATTTrackingMismatchRule } from '../../src/rules/privacy/att-tracking-mismatch';
import { createContextObject } from '../../src/parsers/project-parser';
import { Severity, Confidence, DependencySource } from '../../src/types';

describe('ATTTrackingMismatchRule', () => {
  it('should point to project.pbxproj when ATT framework is missing', async () => {
    const pbxprojPath = '/test/project/MyApp.xcodeproj/project.pbxproj';
    const context = createContextObject(
      '/test/project',
      {
        CFBundleIdentifier: 'com.example.app',
        NSUserTrackingUsageDescription: 'We use tracking to measure and improve our ads performance.',
      },
      {},
      new Set(['UIKit']), // No AppTrackingTransparency
      [{ name: 'FirebaseAnalytics', version: '10.0.0', source: DependencySource.CocoaPods }],
      undefined,
      undefined,
      pbxprojPath
    );

    const findings = await ATTTrackingMismatchRule.evaluate(context);

    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe(Severity.Medium);
    expect(findings[0].confidence).toBe(Confidence.Medium);
    expect(findings[0].title).toBe('AppTrackingTransparency Framework Not Linked');
    expect(findings[0].location).toBe(pbxprojPath);
  });
});
