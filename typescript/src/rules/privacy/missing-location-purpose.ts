/**
 * Rule: Missing Location Usage Description
 * 
 * Detects when an app uses location-related frameworks but is missing
 * the required NSLocationWhenInUseUsageDescription or
 * NSLocationAlwaysAndWhenInUseUsageDescription in Info.plist.
 * 
 * App Store Review Guideline: 5.1.1
 */
import type { Rule, Finding, ScanContext } from '../../types/index.js';
import { Severity, Confidence, RuleCategory } from '../../types/index.js';
import { isPlaceholder } from '../../parsers/plist-parser.js';
import { makeFinding } from '../base.js';

const LOCATION_FRAMEWORKS = ['CoreLocation', 'MapKit'];
const WHEN_IN_USE_KEY = 'NSLocationWhenInUseUsageDescription';
const ALWAYS_AND_WHEN_IN_USE_KEY = 'NSLocationAlwaysAndWhenInUseUsageDescription';
const ALWAYS_KEY = 'NSLocationAlwaysUsageDescription';

export const MissingLocationPurposeRule: Rule = {
  id: 'privacy-002-missing-location-purpose',
  name: 'Missing Location Usage Description',
  description: 'Checks for location framework usage without required usage descriptions',
  category: RuleCategory.Privacy,
  severity: Severity.Critical,
  confidence: Confidence.High,
  guidelineReference: '5.1.1',

  async evaluate(context: ScanContext): Promise<Finding[]> {
    // Framework/library targets do not need app-level usage descriptions
    if (context.isFrameworkTarget()) {
      return [];
    }
    // Check if any location-related framework is linked
    const detectedFrameworks = LOCATION_FRAMEWORKS.filter(f => context.hasFramework(f));
    
    if (detectedFrameworks.length === 0) {
      return [];
    }

    const findings: Finding[] = [];
    
    const whenInUseDescription = context.plistString(WHEN_IN_USE_KEY);
    const hasAlwaysDescription = context.hasPlistKey(ALWAYS_KEY) || 
                                  context.hasPlistKey(ALWAYS_AND_WHEN_IN_USE_KEY);

    // Case 1: Completely missing WhenInUse description
    if (whenInUseDescription === undefined) {
      findings.push(makeFinding(this, {
        description: `Your app links against location-related frameworks (${detectedFrameworks.join(', ')}) ` +
          `but Info.plist is missing NSLocationWhenInUseUsageDescription. Apps that access location services ` +
          `must provide a purpose string explaining why access is needed.`,
        location: context.infoPlistPath || 'Info.plist',
        fixGuidance: `Add NSLocationWhenInUseUsageDescription to your Info.plist with a clear, user-facing explanation ` +
          `of why your app needs location access. For example:

<key>NSLocationWhenInUseUsageDescription</key>
<string>We use your location to show nearby restaurants and provide directions.</string>

This key is required for any location access. The description should explain the specific feature ` +
          `that uses location and be written from the user's perspective.`,
        documentationURL: 'https://developer.apple.com/documentation/corelocation/requesting_authorization_to_use_location_services',
      }));
    }
    // Case 2: WhenInUse description is empty
    else if (whenInUseDescription.trim() === '') {
      findings.push(makeFinding(this, {
        title: 'Empty Location Usage Description',
        description: `NSLocationWhenInUseUsageDescription exists in Info.plist but is empty. ` +
          `Apple requires a meaningful description explaining why your app needs location access.`,
        location: context.infoPlistPath || 'Info.plist',
        fixGuidance: `Update NSLocationWhenInUseUsageDescription with a clear, specific explanation of why your app ` +
          `needs location access. Generic or empty descriptions will be rejected.

Good example: "Find coffee shops near your current location."
Bad example: "Location access required" or ""`,
        documentationURL: 'https://developer.apple.com/documentation/corelocation/requesting_authorization_to_use_location_services',
      }));
    }
    // Case 3: WhenInUse description is a placeholder
    else if (isPlaceholder(whenInUseDescription)) {
      findings.push(makeFinding(this, {
        title: 'Placeholder Location Usage Description',
        description: `NSLocationWhenInUseUsageDescription appears to contain placeholder text: "${whenInUseDescription}". ` +
          `Apple requires meaningful, user-facing descriptions.`,
        location: context.infoPlistPath || 'Info.plist',
        fixGuidance: `Replace the placeholder text with a clear explanation of why your app needs location access. ` +
          `The description should be specific to your app's features.

Current value: "${whenInUseDescription}"

Write a description that helps users understand what feature uses location and why.`,
        documentationURL: 'https://developer.apple.com/documentation/corelocation/requesting_authorization_to_use_location_services',
      }));
    }

    // Check Always permission configuration
    if (hasAlwaysDescription) {
      const alwaysAndWhenInUseDescription = context.plistString(ALWAYS_AND_WHEN_IN_USE_KEY);
      
      // iOS 11+ requires NSLocationAlwaysAndWhenInUseUsageDescription for Always permission
      if (alwaysAndWhenInUseDescription === undefined) {
        // Only flag if they have the legacy key but not the new one
        if (context.hasPlistKey(ALWAYS_KEY)) {
          findings.push(makeFinding(this, {
            title: 'Missing Always And When In Use Description',
            description: `Your app has NSLocationAlwaysUsageDescription but is missing ` +
              `NSLocationAlwaysAndWhenInUseUsageDescription. Since iOS 11, both keys are required ` +
              `when requesting Always location permission.`,
            location: context.infoPlistPath || 'Info.plist',
            fixGuidance: `Add NSLocationAlwaysAndWhenInUseUsageDescription to your Info.plist. This key is required ` +
              `for iOS 11+ when requesting Always permission.

<key>NSLocationWhenInUseUsageDescription</key>
<string>See nearby places while you're using the app.</string>

<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>Send you alerts when you're near saved places, even when the app is closed.</string>

Note: Always permission is heavily scrutinized. Only request it if you have a visible, ` +
              `continuous location feature like navigation or fitness tracking.`,
            documentationURL: 'https://developer.apple.com/documentation/corelocation/choosing_the_location_services_authorization_to_request',
          }));
        }
      }
      // Case: Always description exists but is empty
      else if (alwaysAndWhenInUseDescription.trim() === '') {
        findings.push(makeFinding(this, {
          title: 'Empty Always Location Description',
          description: `NSLocationAlwaysAndWhenInUseUsageDescription exists but is empty. ` +
            `Apple requires a meaningful description for Always location access.`,
          location: context.infoPlistPath || 'Info.plist',
          fixGuidance: `Provide a clear explanation of why your app needs Always location access. ` +
            `This should describe a user-facing feature that requires continuous location.

Example: "Track your runs in the background so you can see your route even ` +
            `when the screen is off."`,
          documentationURL: 'https://developer.apple.com/documentation/corelocation/choosing_the_location_services_authorization_to_request',
        }));
      }
      // Case: Always description is a placeholder
      else if (isPlaceholder(alwaysAndWhenInUseDescription)) {
        findings.push(makeFinding(this, {
          title: 'Placeholder Always Location Description',
          description: `NSLocationAlwaysAndWhenInUseUsageDescription contains placeholder text: ` +
            `"${alwaysAndWhenInUseDescription}".`,
          location: context.infoPlistPath || 'Info.plist',
          fixGuidance: `Replace the placeholder with a real description of your continuous location feature. ` +
            `Always permission requires a clear, user-visible justification.`,
          documentationURL: 'https://developer.apple.com/documentation/corelocation/choosing_the_location_services_authorization_to_request',
        }));
      }
    }

    return findings;
  },
};
