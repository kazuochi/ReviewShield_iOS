/**
 * Rule: Missing Launch Storyboard
 * 
 * Detects when an app is missing UILaunchStoryboardName in Info.plist.
 * Since April 2020, all apps submitted to the App Store must use a
 * launch storyboard to support all screen sizes.
 * 
 * App Store Review Guideline: 4.0 (Design)
 */
import type { Rule, Finding, ScanContext } from '../../types/index.js';
import { Severity, Confidence, RuleCategory } from '../../types/index.js';
import { makeFinding } from '../base.js';

export const MissingLaunchStoryboardRule: Rule = {
  id: 'config-003-missing-launch-storyboard',
  name: 'Missing Launch Storyboard',
  description: 'Checks for missing UILaunchStoryboardName in Info.plist',
  category: RuleCategory.Config,
  severity: Severity.Critical,
  confidence: Confidence.High,
  guidelineReference: '4.0',

  async evaluate(context: ScanContext): Promise<Finding[]> {
    // Only flag if the key is completely absent.
    // An empty string is valid (SwiftUI lifecycle apps use empty UILaunchStoryboardName).
    if (context.hasPlistKey('UILaunchStoryboardName')) {
      return [];
    }

    return [
      makeFinding(this, {
        description: `Your Info.plist is missing the UILaunchStoryboardName key. Since April 2020, ` +
          `all apps submitted to the App Store must include a launch storyboard to support ` +
          `all device screen sizes. Apps without a launch storyboard will be rejected.`,
        location: 'Info.plist',
        fixGuidance: `Add UILaunchStoryboardName to your Info.plist pointing to your launch storyboard:

<key>UILaunchStoryboardName</key>
<string>LaunchScreen</string>

If you're using a SwiftUI app lifecycle, set it to an empty string — Xcode typically ` +
          `handles this automatically. Make sure a corresponding LaunchScreen.storyboard file ` +
          `exists in your project.

Note: Launch images (UILaunchImages / asset catalog launch images) are no longer accepted ` +
          `as a substitute for launch storyboards.`,
        documentationURL: 'https://developer.apple.com/documentation/bundleresources/information_property_list/uilaunchstoryboardname',
      }),
    ];
  },
};
