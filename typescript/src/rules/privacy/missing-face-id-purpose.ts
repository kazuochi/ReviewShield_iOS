/**
 * Rule: Missing Face ID Usage Description
 * 
 * Detects when an app uses LocalAuthentication but is missing
 * the required NSFaceIDUsageDescription in Info.plist.
 * 
 * App Store Review Guideline: 5.1.1
 */
import type { Rule, Finding, ScanContext } from '../../types/index.js';
import { Severity, Confidence, RuleCategory } from '../../types/index.js';
import { isPlaceholder } from '../../parsers/plist-parser.js';
import { makeFinding } from '../base.js';

const FACE_ID_FRAMEWORKS = ['LocalAuthentication'];

export const MissingFaceIdPurposeRule: Rule = {
  id: 'privacy-009-missing-face-id-purpose',
  name: 'Missing Face ID Usage Description',
  description: 'Checks for LocalAuthentication framework usage without NSFaceIDUsageDescription',
  category: RuleCategory.Privacy,
  severity: Severity.Critical,
  confidence: Confidence.High,
  guidelineReference: '5.1.1',

  async evaluate(context: ScanContext): Promise<Finding[]> {
    const detectedFrameworks = FACE_ID_FRAMEWORKS.filter(f => context.hasFramework(f));

    if (detectedFrameworks.length === 0) {
      return [];
    }

    const faceIdDescription = context.plistString('NSFaceIDUsageDescription');

    // Case 1: Completely missing
    if (faceIdDescription === undefined) {
      return [
        makeFinding(this, {
          description: `Your app links against biometric authentication frameworks (${detectedFrameworks.join(', ')}) ` +
            `but Info.plist is missing NSFaceIDUsageDescription. Apps that use Face ID ` +
            `must provide a purpose string explaining why biometric authentication is needed.`,
          location: 'Info.plist',
          fixGuidance: `Add NSFaceIDUsageDescription to your Info.plist with a clear, user-facing ` +
            `explanation of why your app needs Face ID access. For example:

<key>NSFaceIDUsageDescription</key>
<string>We use Face ID to securely authenticate you for quick access to your account.</string>

The description should explain what feature uses Face ID and ` +
            `be written from the user's perspective.`,
          documentationURL: 'https://developer.apple.com/documentation/bundleresources/information_property_list/nsfaceidusagedescription',
        }),
      ];
    }

    // Case 2: Empty or whitespace only
    if (faceIdDescription.trim() === '') {
      return [
        makeFinding(this, {
          title: 'Empty Face ID Usage Description',
          description: `NSFaceIDUsageDescription exists in Info.plist but is empty. ` +
            `Apple requires a meaningful description explaining why your app needs Face ID access.`,
          location: 'Info.plist',
          fixGuidance: `Update NSFaceIDUsageDescription with a clear, specific explanation of why ` +
            `your app needs Face ID access. Generic or empty descriptions may be rejected.

Good example: "We use Face ID to securely log you in without a password."
Bad example: "Face ID access required" or ""`,
          documentationURL: 'https://developer.apple.com/documentation/bundleresources/information_property_list/nsfaceidusagedescription',
        }),
      ];
    }

    // Case 3: Placeholder text detected
    if (isPlaceholder(faceIdDescription)) {
      return [
        makeFinding(this, {
          title: 'Placeholder Face ID Usage Description',
          description: `NSFaceIDUsageDescription appears to contain placeholder text: "${faceIdDescription}". ` +
            `Apple requires meaningful, user-facing descriptions.`,
          location: 'Info.plist',
          fixGuidance: `Replace the placeholder text with a clear explanation of why your app needs Face ID access. ` +
            `The description should be specific to your app's features.

Current value: "${faceIdDescription}"

Write a description that helps users understand what feature uses Face ID and why.`,
          documentationURL: 'https://developer.apple.com/documentation/bundleresources/information_property_list/nsfaceidusagedescription',
        }),
      ];
    }

    return [];
  },
};
