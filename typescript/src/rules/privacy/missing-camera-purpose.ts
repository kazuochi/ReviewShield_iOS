/**
 * Rule: Missing Camera Usage Description
 * 
 * Detects when an app uses camera-related frameworks but is missing
 * the required NSCameraUsageDescription in Info.plist.
 * 
 * App Store Review Guideline: 5.1.1
 */
import type { Rule, Finding, ScanContext } from '../../types/index.js';
import { Severity, Confidence, RuleCategory } from '../../types/index.js';
import { isPlaceholder } from '../../parsers/plist-parser.js';
import { makeFinding } from '../base.js';

const CAMERA_FRAMEWORKS = ['AVFoundation', 'AVKit', 'VisionKit'];

export const MissingCameraPurposeRule: Rule = {
  id: 'privacy-001-missing-camera-purpose',
  name: 'Missing Camera Usage Description',
  description: 'Checks for camera framework usage without NSCameraUsageDescription',
  category: RuleCategory.Privacy,
  severity: Severity.Critical,
  confidence: Confidence.High,
  guidelineReference: '5.1.1',

  async evaluate(context: ScanContext): Promise<Finding[]> {
    // Check if any camera-related framework is linked
    const detectedFrameworks = CAMERA_FRAMEWORKS.filter(f => context.hasFramework(f));
    
    if (detectedFrameworks.length === 0) {
      // No camera framework detected, rule doesn't apply
      return [];
    }

    const cameraDescription = context.plistString('NSCameraUsageDescription');

    // Case 1: Completely missing
    if (cameraDescription === undefined) {
      return [
        makeFinding(this, {
          description: `Your app links against camera-related frameworks (${detectedFrameworks.join(', ')}) ` +
            `but Info.plist is missing NSCameraUsageDescription. Apps that access the camera must ` +
            `provide a purpose string explaining why access is needed.`,
          location: 'Info.plist',
          fixGuidance: `Add NSCameraUsageDescription to your Info.plist with a clear, user-facing explanation ` +
            `of why your app needs camera access. For example:

<key>NSCameraUsageDescription</key>
<string>We need access to your camera to take photos for your profile.</string>

The description should explain the specific feature that uses the camera and ` +
            `be written from the user's perspective.`,
          documentationURL: 'https://developer.apple.com/documentation/bundleresources/information_property_list/nscamerausagedescription',
        }),
      ];
    }

    // Case 2: Empty or whitespace only
    if (cameraDescription.trim() === '') {
      return [
        makeFinding(this, {
          title: 'Empty Camera Usage Description',
          description: `NSCameraUsageDescription exists in Info.plist but is empty. ` +
            `Apple requires a meaningful description explaining why your app needs camera access.`,
          location: 'Info.plist',
          fixGuidance: `Update NSCameraUsageDescription with a clear, specific explanation of why your app ` +
            `needs camera access. Generic or empty descriptions may be rejected.

Good example: "We use your camera to scan QR codes for quick login."
Bad example: "Camera access required" or ""`,
          documentationURL: 'https://developer.apple.com/documentation/bundleresources/information_property_list/nscamerausagedescription',
        }),
      ];
    }

    // Case 3: Placeholder text detected
    if (isPlaceholder(cameraDescription)) {
      return [
        makeFinding(this, {
          title: 'Placeholder Camera Usage Description',
          description: `NSCameraUsageDescription appears to contain placeholder text: "${cameraDescription}". ` +
            `Apple requires meaningful, user-facing descriptions.`,
          location: 'Info.plist',
          fixGuidance: `Replace the placeholder text with a clear explanation of why your app needs camera access. ` +
            `The description should be specific to your app's features.

Current value: "${cameraDescription}"

Write a description that helps users understand what feature uses the camera and why.`,
          documentationURL: 'https://developer.apple.com/documentation/bundleresources/information_property_list/nscamerausagedescription',
        }),
      ];
    }

    // All checks passed
    return [];
  },
};
