/**
 * Rule: Missing Bluetooth Usage Description
 * 
 * Detects when an app uses CoreBluetooth but is missing
 * the required NSBluetoothAlwaysUsageDescription in Info.plist.
 * 
 * App Store Review Guideline: 5.1.1
 */
import type { Rule, Finding, ScanContext } from '../../types/index.js';
import { Severity, Confidence, RuleCategory } from '../../types/index.js';
import { isPlaceholder } from '../../parsers/plist-parser.js';
import { makeFinding } from '../base.js';

const BLUETOOTH_FRAMEWORKS = ['CoreBluetooth'];

export const MissingBluetoothPurposeRule: Rule = {
  id: 'privacy-008-missing-bluetooth-purpose',
  name: 'Missing Bluetooth Usage Description',
  description: 'Checks for Bluetooth framework usage without NSBluetoothAlwaysUsageDescription',
  category: RuleCategory.Privacy,
  severity: Severity.Critical,
  confidence: Confidence.High,
  guidelineReference: '5.1.1',

  async evaluate(context: ScanContext): Promise<Finding[]> {
    // Framework/library targets do not need app-level usage descriptions
    if (context.isFrameworkTarget()) {
      return [];
    }
    const detectedFrameworks = BLUETOOTH_FRAMEWORKS.filter(f => context.hasFramework(f));

    if (detectedFrameworks.length === 0) {
      return [];
    }

    const bluetoothDescription = context.plistString('NSBluetoothAlwaysUsageDescription');

    // Case 1: Completely missing
    if (bluetoothDescription === undefined) {
      return [
        makeFinding(this, {
          description: `Your app links against Bluetooth frameworks (${detectedFrameworks.join(', ')}) ` +
            `but Info.plist is missing NSBluetoothAlwaysUsageDescription. Apps that access Bluetooth ` +
            `must provide a purpose string explaining why access is needed.`,
          location: context.infoPlistPath || 'Info.plist',
          fixGuidance: `Add NSBluetoothAlwaysUsageDescription to your Info.plist with a clear, user-facing ` +
            `explanation of why your app needs Bluetooth access. For example:

<key>NSBluetoothAlwaysUsageDescription</key>
<string>We use Bluetooth to connect to your fitness tracker and sync workout data.</string>

The description should explain the specific feature that uses Bluetooth and ` +
            `be written from the user's perspective.`,
          documentationURL: 'https://developer.apple.com/documentation/bundleresources/information_property_list/nsbluetoothalwaysusagedescription',
        }),
      ];
    }

    // Case 2: Empty or whitespace only
    if (bluetoothDescription.trim() === '') {
      return [
        makeFinding(this, {
          title: 'Empty Bluetooth Usage Description',
          description: `NSBluetoothAlwaysUsageDescription exists in Info.plist but is empty. ` +
            `Apple requires a meaningful description explaining why your app needs Bluetooth access.`,
          location: context.infoPlistPath || 'Info.plist',
          fixGuidance: `Update NSBluetoothAlwaysUsageDescription with a clear, specific explanation of why ` +
            `your app needs Bluetooth access. Generic or empty descriptions may be rejected.

Good example: "We use Bluetooth to connect to your heart rate monitor."
Bad example: "Bluetooth access required" or ""`,
          documentationURL: 'https://developer.apple.com/documentation/bundleresources/information_property_list/nsbluetoothalwaysusagedescription',
        }),
      ];
    }

    // Case 3: Placeholder text detected
    if (isPlaceholder(bluetoothDescription)) {
      return [
        makeFinding(this, {
          title: 'Placeholder Bluetooth Usage Description',
          description: `NSBluetoothAlwaysUsageDescription appears to contain placeholder text: "${bluetoothDescription}". ` +
            `Apple requires meaningful, user-facing descriptions.`,
          location: context.infoPlistPath || 'Info.plist',
          fixGuidance: `Replace the placeholder text with a clear explanation of why your app needs Bluetooth access. ` +
            `The description should be specific to your app's features.

Current value: "${bluetoothDescription}"

Write a description that helps users understand what feature uses Bluetooth and why.`,
          documentationURL: 'https://developer.apple.com/documentation/bundleresources/information_property_list/nsbluetoothalwaysusagedescription',
        }),
      ];
    }

    return [];
  },
};
