/**
 * Rule: Missing Supported Orientations
 * 
 * Detects when an app is missing UISupportedInterfaceOrientations in Info.plist.
 * Apps must declare supported orientations to ensure correct behavior across
 * all device types and screen sizes.
 * 
 * App Store Review Guideline: 4.0 (Design)
 */
import type { Rule, Finding, ScanContext } from '../../types/index.js';
import { Severity, Confidence, RuleCategory } from '../../types/index.js';
import { makeFinding } from '../base.js';

export const MissingSupportedOrientationsRule: Rule = {
  id: 'metadata-002-missing-supported-orientations',
  name: 'Missing Supported Orientations',
  description: 'Checks for missing UISupportedInterfaceOrientations in Info.plist',
  category: RuleCategory.Metadata,
  severity: Severity.Medium,
  confidence: Confidence.High,
  guidelineReference: '4.0',

  async evaluate(context: ScanContext): Promise<Finding[]> {
    const orientations = context.plistArray('UISupportedInterfaceOrientations');

    // Case 1: Key completely missing
    if (orientations === undefined) {
      return [
        makeFinding(this, {
          description: `Your Info.plist is missing the UISupportedInterfaceOrientations key. ` +
            `Apps should declare which interface orientations they support to ensure correct ` +
            `behavior across all device types. Without this key, Apple's defaults may not match ` +
            `your app's intended behavior, which can lead to UI issues and potential rejection.`,
          location: 'Info.plist',
          fixGuidance: `Add UISupportedInterfaceOrientations to your Info.plist with the orientations ` +
            `your app supports:

<key>UISupportedInterfaceOrientations</key>
<array>
    <string>UIInterfaceOrientationPortrait</string>
</array>

Common orientation values:
- UIInterfaceOrientationPortrait
- UIInterfaceOrientationPortraitUpsideDown
- UIInterfaceOrientationLandscapeLeft
- UIInterfaceOrientationLandscapeRight

For iPad, also consider adding UISupportedInterfaceOrientations~ipad with ` +
            `all four orientations (iPad apps are expected to support all orientations).`,
          documentationURL: 'https://developer.apple.com/documentation/bundleresources/information_property_list/uisupportedinterfaceorientations',
        }),
      ];
    }

    // Case 2: Empty array
    if (orientations.length === 0) {
      return [
        makeFinding(this, {
          title: 'Empty Supported Orientations',
          description: `UISupportedInterfaceOrientations exists in Info.plist but is an empty array. ` +
            `Your app must declare at least one supported orientation.`,
          location: 'Info.plist',
          fixGuidance: `Add at least one orientation to UISupportedInterfaceOrientations:

<key>UISupportedInterfaceOrientations</key>
<array>
    <string>UIInterfaceOrientationPortrait</string>
</array>

Most apps should support at minimum UIInterfaceOrientationPortrait.`,
          documentationURL: 'https://developer.apple.com/documentation/bundleresources/information_property_list/uisupportedinterfaceorientations',
        }),
      ];
    }

    return [];
  },
};
