/**
 * Rule: Location Always Permission Without Justification
 * 
 * Detects when an app requests Always location permission but doesn't
 * have the "location" background mode enabled in UIBackgroundModes.
 * 
 * App Store Review Guideline: 5.1.1
 */
import type { Rule, Finding, ScanContext } from '../../types/index.js';
import { Severity, Confidence, RuleCategory } from '../../types/index.js';
import { makeFinding, makeCustomFinding } from '../base.js';

const ALWAYS_KEYS = [
  'NSLocationAlwaysUsageDescription',
  'NSLocationAlwaysAndWhenInUseUsageDescription',
];
const BACKGROUND_MODES_KEY = 'UIBackgroundModes';
const LOCATION_BACKGROUND_MODE = 'location';

export const LocationAlwaysUnjustifiedRule: Rule = {
  id: 'entitlements-001-location-always-unjustified',
  name: 'Location Always Permission Without Justification',
  description: 'Checks for Always location permission without background mode or proper justification',
  category: RuleCategory.Privacy,
  severity: Severity.Critical,
  confidence: Confidence.Medium,
  guidelineReference: '5.1.1',

  async evaluate(context: ScanContext): Promise<Finding[]> {
    // Check if app requests Always location permission
    const hasAlwaysPermission = ALWAYS_KEYS.some(key => context.hasPlistKey(key));
    
    if (!hasAlwaysPermission) {
      return [];
    }

    // Check if background location mode is enabled
    const backgroundModes = (context.plistArray(BACKGROUND_MODES_KEY) as string[]) ?? [];
    const hasLocationBackgroundMode = backgroundModes.includes(LOCATION_BACKGROUND_MODE);

    const findings: Finding[] = [];

    // Case 1: Always permission without background location mode
    if (!hasLocationBackgroundMode) {
      const presentKeys = ALWAYS_KEYS.filter(key => context.hasPlistKey(key));
      
      findings.push(makeFinding(this, {
        description: `Your app requests Always location permission (${presentKeys.join(', ')}) ` +
          `but UIBackgroundModes does not include "location". This configuration strongly suggests ` +
          `your app doesn't have a legitimate continuous location feature, which Apple will ` +
          `likely question during review.`,
        location: 'Info.plist',
        fixGuidance: `You have two options:

**Option 1: If you DO need Always permission (navigation, fitness, geofencing):**

Add "location" to UIBackgroundModes in Info.plist:

<key>UIBackgroundModes</key>
<array>
    <string>location</string>
</array>

Also ensure your app has a visible, user-initiated feature that uses continuous location ` +
          `(like run tracking or turn-by-turn navigation).

**Option 2: If you DON'T need Always permission (most apps):**

Switch to When In Use permission instead. Remove the Always description keys and ` +
          `use requestWhenInUseAuthorization() instead of requestAlwaysAuthorization().

When In Use permission has a much higher approval rate and is sufficient for most ` +
          `location features.

Note: Always permission is heavily scrutinized. Be prepared to justify your use case ` +
          `in App Store Review notes.`,
        documentationURL: 'https://developer.apple.com/documentation/corelocation/choosing_the_location_services_authorization_to_request',
      }));
    }
    // Case 2: Has background mode but check for suspicious patterns
    else {
      const alwaysDesc = context.plistString('NSLocationAlwaysAndWhenInUseUsageDescription') ??
                         context.plistString('NSLocationAlwaysUsageDescription');
      
      if (alwaysDesc) {
        const lowercased = alwaysDesc.toLowerCase();
        const vaguePatterns = ['nearby', 'location services', 'your location', 'we need', 'is required'];
        const legitimatePatterns = ['track', 'background', 'navigation', 'running', 'workout', 'geofence', 'alert'];
        
        const seemsVague = vaguePatterns.some(p => lowercased.includes(p)) &&
                          !legitimatePatterns.some(p => lowercased.includes(p));
        
        if (seemsVague) {
          findings.push(makeCustomFinding(this, Severity.Medium, Confidence.Low, {
            title: 'Always Location Description May Be Insufficient',
            description: `Your Always location description doesn't clearly explain a continuous ` +
              `location feature: "${alwaysDesc}". Apple expects clear justification for ` +
              `Always permission.`,
            location: 'Info.plist',
            fixGuidance: `Update your description to clearly explain the continuous location feature:

Good examples:
- "Track your runs in the background so you can see your complete route."
- "Provide turn-by-turn directions even when the screen is off."
- "Send alerts when you arrive at or leave saved locations."

Bad examples:
- "We use your location" (too vague)
- "Location is required" (doesn't explain feature)
- "Show nearby places" (doesn't justify Always)`,
            documentationURL: 'https://developer.apple.com/documentation/corelocation/choosing_the_location_services_authorization_to_request',
          }));
        }
      }
    }

    return findings;
  },
};
