/**
 * Rule: Missing Photo Library Usage Description
 * 
 * Detects when an app uses Photos framework without the required
 * NSPhotoLibraryUsageDescription in Info.plist.
 * 
 * App Store Review Guideline: 5.1.1
 */
import type { Rule, Finding, ScanContext } from '../../types/index.js';
import { Severity, Confidence, RuleCategory } from '../../types/index.js';
import { isPlaceholder } from '../../parsers/plist-parser.js';
import { makeFinding } from '../base.js';

const PHOTO_LIBRARY_FRAMEWORKS = ['Photos', 'PhotosUI'];
const PHOTO_LIBRARY_KEY = 'NSPhotoLibraryUsageDescription';
const PHOTO_LIBRARY_ADD_KEY = 'NSPhotoLibraryAddUsageDescription';

export const MissingPhotoLibraryPurposeRule: Rule = {
  id: 'privacy-004-missing-photo-library-purpose',
  name: 'Missing Photo Library Usage Description',
  description: 'Checks for Photos framework usage without NSPhotoLibraryUsageDescription',
  category: RuleCategory.Privacy,
  severity: Severity.Critical,
  confidence: Confidence.High,
  guidelineReference: '5.1.1',

  async evaluate(context: ScanContext): Promise<Finding[]> {
    // Framework/library targets do not need app-level usage descriptions
    if (context.isFrameworkTarget()) {
      return [];
    }
    // Check if any Photos-related framework is linked
    const detectedFrameworks = PHOTO_LIBRARY_FRAMEWORKS.filter(f => context.hasFramework(f));
    
    if (detectedFrameworks.length === 0) {
      return [];
    }

    const findings: Finding[] = [];
    const photoLibraryDescription = context.plistString(PHOTO_LIBRARY_KEY);
    const photoLibraryAddDescription = context.plistString(PHOTO_LIBRARY_ADD_KEY);

    // Case 1: Completely missing read access description
    // If NSPhotoLibraryAddUsageDescription IS present, the app may only save photos (not read),
    // which is a valid pattern that doesn't require NSPhotoLibraryUsageDescription
    if (photoLibraryDescription === undefined && photoLibraryAddDescription === undefined) {
      findings.push(makeFinding(this, {
        description: `Your app links against photo library frameworks (${detectedFrameworks.join(', ')}) ` +
          `but Info.plist is missing NSPhotoLibraryUsageDescription. Apps that access the photo library ` +
          `must provide a purpose string explaining why access is needed.`,
        location: context.infoPlistPath || 'Info.plist',
        fixGuidance: `Add NSPhotoLibraryUsageDescription to your Info.plist with a clear, user-facing explanation ` +
          `of why your app needs photo library access. For example:

<key>NSPhotoLibraryUsageDescription</key>
<string>We need access to your photos to let you select images for your posts.</string>

If your app only needs to save photos (not read), you can use NSPhotoLibraryAddUsageDescription instead.`,
        documentationURL: 'https://developer.apple.com/documentation/bundleresources/information_property_list/nsphotolibraryusagedescription',
      }));
    }
    // Case 2: Empty description
    else if (photoLibraryDescription !== undefined && photoLibraryDescription.trim() === '') {
      findings.push(makeFinding(this, {
        title: 'Empty Photo Library Usage Description',
        description: `NSPhotoLibraryUsageDescription exists in Info.plist but is empty. ` +
          `Apple requires a meaningful description explaining why your app needs photo library access.`,
        location: context.infoPlistPath || 'Info.plist',
        fixGuidance: `Update NSPhotoLibraryUsageDescription with a clear, specific explanation of why your app ` +
          `needs photo library access. Generic or empty descriptions will be rejected.

Good example: "Choose photos to share with your friends."
Bad example: "Photo access required" or ""`,
        documentationURL: 'https://developer.apple.com/documentation/bundleresources/information_property_list/nsphotolibraryusagedescription',
      }));
    }
    // Case 3: Placeholder text detected
    else if (photoLibraryDescription !== undefined && isPlaceholder(photoLibraryDescription)) {
      findings.push(makeFinding(this, {
        title: 'Placeholder Photo Library Usage Description',
        description: `NSPhotoLibraryUsageDescription appears to contain placeholder text: "${photoLibraryDescription}". ` +
          `Apple requires meaningful, user-facing descriptions.`,
        location: context.infoPlistPath || 'Info.plist',
        fixGuidance: `Replace the placeholder text with a clear explanation of why your app needs photo library access. ` +
          `The description should be specific to your app's features.

Current value: "${photoLibraryDescription}"

Write a description that helps users understand what feature uses the photo library and why.`,
        documentationURL: 'https://developer.apple.com/documentation/bundleresources/information_property_list/nsphotolibraryusagedescription',
      }));
    }

    // Also check for add-only permission if it exists but is empty/placeholder
    if (photoLibraryAddDescription !== undefined) {
      if (photoLibraryAddDescription.trim() === '') {
        findings.push(makeFinding(this, {
          title: 'Empty Photo Library Add Usage Description',
          description: `NSPhotoLibraryAddUsageDescription exists in Info.plist but is empty. ` +
            `Apple requires a meaningful description explaining why your app needs to save photos.`,
          location: context.infoPlistPath || 'Info.plist',
          fixGuidance: `Update NSPhotoLibraryAddUsageDescription with a clear explanation of why your app needs to save photos.

Good example: "Save edited photos to your library."`,
          documentationURL: 'https://developer.apple.com/documentation/bundleresources/information_property_list/nsphotolibraryaddusagedescription',
        }));
      } else if (isPlaceholder(photoLibraryAddDescription)) {
        findings.push(makeFinding(this, {
          title: 'Placeholder Photo Library Add Usage Description',
          description: `NSPhotoLibraryAddUsageDescription contains placeholder text: "${photoLibraryAddDescription}".`,
          location: context.infoPlistPath || 'Info.plist',
          fixGuidance: `Replace the placeholder with a real description of why your app needs to save photos.`,
          documentationURL: 'https://developer.apple.com/documentation/bundleresources/information_property_list/nsphotolibraryaddusagedescription',
        }));
      }
    }

    return findings;
  },
};
