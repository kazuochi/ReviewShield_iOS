/**
 * Rule: Missing Contacts Usage Description
 * 
 * Detects when an app uses Contacts framework without the required
 * NSContactsUsageDescription in Info.plist.
 * 
 * App Store Review Guideline: 5.1.1
 */
import type { Rule, Finding, ScanContext } from '../../types/index.js';
import { Severity, Confidence, RuleCategory } from '../../types/index.js';
import { isPlaceholder } from '../../parsers/plist-parser.js';
import { makeFinding } from '../base.js';

const CONTACTS_FRAMEWORKS = ['Contacts', 'ContactsUI'];
const CONTACTS_KEY = 'NSContactsUsageDescription';

export const MissingContactsPurposeRule: Rule = {
  id: 'privacy-006-missing-contacts-purpose',
  name: 'Missing Contacts Usage Description',
  description: 'Checks for Contacts framework usage without NSContactsUsageDescription',
  category: RuleCategory.Privacy,
  severity: Severity.Critical,
  confidence: Confidence.High,
  guidelineReference: '5.1.1',

  async evaluate(context: ScanContext): Promise<Finding[]> {
    // Framework/library targets do not need app-level usage descriptions
    if (context.isFrameworkTarget()) {
      return [];
    }
    // Check if any Contacts-related framework is linked
    const detectedFrameworks = CONTACTS_FRAMEWORKS.filter(f => context.hasFramework(f));
    
    if (detectedFrameworks.length === 0) {
      return [];
    }

    const contactsDescription = context.plistString(CONTACTS_KEY);

    // Case 1: Completely missing
    if (contactsDescription === undefined) {
      return [
        makeFinding(this, {
          description: `Your app links against contacts frameworks (${detectedFrameworks.join(', ')}) ` +
            `but Info.plist is missing NSContactsUsageDescription. Apps that access the user's contacts ` +
            `must provide a purpose string explaining why access is needed.`,
          location: context.infoPlistPath || 'Info.plist',
          fixGuidance: `Add NSContactsUsageDescription to your Info.plist with a clear, user-facing explanation ` +
            `of why your app needs contacts access. For example:

<key>NSContactsUsageDescription</key>
<string>We use your contacts to help you find friends who are also using the app.</string>

Important: Contact data is considered highly sensitive. Apple scrutinizes apps that request 
contacts access, so ensure you have a legitimate user-facing feature that requires it.`,
          documentationURL: 'https://developer.apple.com/documentation/bundleresources/information_property_list/nscontactsusagedescription',
        }),
      ];
    }

    // Case 2: Empty or whitespace only
    if (contactsDescription.trim() === '') {
      return [
        makeFinding(this, {
          title: 'Empty Contacts Usage Description',
          description: `NSContactsUsageDescription exists in Info.plist but is empty. ` +
            `Apple requires a meaningful description explaining why your app needs contacts access.`,
          location: context.infoPlistPath || 'Info.plist',
          fixGuidance: `Update NSContactsUsageDescription with a clear, specific explanation of why your app ` +
            `needs contacts access. Generic or empty descriptions will be rejected.

Good example: "Find friends in your contacts who use the app."
Bad example: "Contacts access required" or ""

Note: Contacts are sensitive data. Only request access if you have a clear user-facing need.`,
          documentationURL: 'https://developer.apple.com/documentation/bundleresources/information_property_list/nscontactsusagedescription',
        }),
      ];
    }

    // Case 3: Placeholder text detected
    if (isPlaceholder(contactsDescription)) {
      return [
        makeFinding(this, {
          title: 'Placeholder Contacts Usage Description',
          description: `NSContactsUsageDescription appears to contain placeholder text: "${contactsDescription}". ` +
            `Apple requires meaningful, user-facing descriptions.`,
          location: context.infoPlistPath || 'Info.plist',
          fixGuidance: `Replace the placeholder text with a clear explanation of why your app needs contacts access. ` +
            `The description should be specific to your app's features.

Current value: "${contactsDescription}"

Write a description that helps users understand what feature uses contacts and why.`,
          documentationURL: 'https://developer.apple.com/documentation/bundleresources/information_property_list/nscontactsusagedescription',
        }),
      ];
    }

    // All checks passed
    return [];
  },
};
