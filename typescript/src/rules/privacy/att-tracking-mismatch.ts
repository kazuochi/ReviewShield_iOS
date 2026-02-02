/**
 * Rule: Tracking SDK Without App Tracking Transparency
 * 
 * Detects when an app includes tracking/attribution SDKs but is missing
 * NSUserTrackingUsageDescription in Info.plist and/or the AppTrackingTransparency
 * framework.
 * 
 * App Store Review Guideline: 5.1.2
 */
import type { Rule, Finding, ScanContext } from '../../types/index.js';
import { Severity, Confidence, RuleCategory } from '../../types/index.js';
import { isPlaceholder } from '../../parsers/plist-parser.js';
import { detectTrackingSDKs } from '../../parsers/framework-detector.js';
import { makeFinding, makeCustomFinding } from '../base.js';

const TRACKING_USAGE_KEY = 'NSUserTrackingUsageDescription';
const ATT_FRAMEWORK = 'AppTrackingTransparency';

export const ATTTrackingMismatchRule: Rule = {
  id: 'privacy-003-att-tracking-mismatch',
  name: 'Tracking SDK Without App Tracking Transparency',
  description: 'Checks for tracking SDKs without proper ATT implementation',
  category: RuleCategory.Privacy,
  severity: Severity.Critical,
  confidence: Confidence.High,
  guidelineReference: '5.1.2',

  async evaluate(context: ScanContext): Promise<Finding[]> {
    // Detect tracking SDKs from dependencies
    const detectedSDKs = detectTrackingSDKs(context.dependencies);
    
    if (detectedSDKs.length === 0) {
      return [];
    }

    const findings: Finding[] = [];
    
    const trackingDescription = context.plistString(TRACKING_USAGE_KEY);
    const hasTrackingDescription = trackingDescription !== undefined;
    const hasATTFramework = context.hasFramework(ATT_FRAMEWORK);

    // Case 1: Missing NSUserTrackingUsageDescription entirely
    if (!hasTrackingDescription) {
      findings.push(makeFinding(this, {
        description: `Your app includes tracking/attribution SDKs (${detectedSDKs.join(', ')}) ` +
          `but Info.plist is missing NSUserTrackingUsageDescription. Since iOS 14.5, apps that track ` +
          `users must implement App Tracking Transparency and include a purpose string.`,
        location: 'Info.plist',
        fixGuidance: `Add NSUserTrackingUsageDescription to your Info.plist:

<key>NSUserTrackingUsageDescription</key>
<string>We use tracking to show you personalized ads and measure ad effectiveness.</string>

Then implement the ATT prompt in your code:

import AppTrackingTransparency

ATTrackingManager.requestTrackingAuthorization { status in
    switch status {
    case .authorized:
        // Enable tracking
    default:
        // Disable tracking
    }
}

Important: Only initialize tracking SDKs after the user grants permission.`,
        documentationURL: 'https://developer.apple.com/documentation/apptrackingtransparency',
      }));
    }
    // Case 2: Description is empty
    else if (trackingDescription.trim() === '') {
      findings.push(makeFinding(this, {
        title: 'Empty Tracking Usage Description',
        description: `NSUserTrackingUsageDescription exists but is empty. Apple requires a meaningful ` +
          `description explaining why your app tracks users.`,
        location: 'Info.plist',
        fixGuidance: `Update NSUserTrackingUsageDescription with a clear explanation of your tracking purpose.

Good example: "Allow tracking to receive personalized ads based on your interests."
Bad example: "" or "For tracking"

Be specific about what data is collected and how it's used.`,
        documentationURL: 'https://developer.apple.com/documentation/apptrackingtransparency',
      }));
    }
    // Case 3: Description is placeholder
    else if (isPlaceholder(trackingDescription)) {
      findings.push(makeFinding(this, {
        title: 'Placeholder Tracking Usage Description',
        description: `NSUserTrackingUsageDescription appears to contain placeholder text: "${trackingDescription}". ` +
          `Apple requires meaningful, user-facing descriptions.`,
        location: 'Info.plist',
        fixGuidance: `Replace the placeholder with a real explanation of why your app tracks users.

Current value: "${trackingDescription}"

Users should understand what tracking means for their privacy.`,
        documentationURL: 'https://developer.apple.com/documentation/apptrackingtransparency',
      }));
    }

    // Case 4: Has description but no ATT framework
    if (hasTrackingDescription && !hasATTFramework) {
      findings.push(makeCustomFinding(this, Severity.Medium, Confidence.Medium, {
        title: 'AppTrackingTransparency Framework Not Linked',
        description: `Your app has NSUserTrackingUsageDescription but AppTrackingTransparency framework ` +
          `does not appear to be linked. This may indicate an incomplete ATT implementation.`,
        location: 'Project',
        fixGuidance: `Ensure you're importing AppTrackingTransparency in your code and actually showing ` +
          `the tracking permission prompt to users.

import AppTrackingTransparency

// Call this at an appropriate time (not immediately at launch)
ATTrackingManager.requestTrackingAuthorization { status in
    // Handle response
}

Note: If you're using a different approach to ATT (like via a third-party SDK wrapper), ` +
          `you can ignore this finding.`,
        documentationURL: 'https://developer.apple.com/documentation/apptrackingtransparency',
      }));
    }

    return findings;
  },
};
