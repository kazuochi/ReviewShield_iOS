/**
 * Rule: Missing Export Compliance Flag
 * 
 * Detects when an app is missing the ITSAppUsesNonExemptEncryption key
 * in Info.plist. Without this key, App Store Connect prompts for export
 * compliance information on every upload, causing friction and delays.
 * 
 * Export Compliance Documentation
 */
import type { Rule, Finding, ScanContext } from '../../types/index.js';
import { Severity, Confidence, RuleCategory } from '../../types/index.js';
import { makeFinding } from '../base.js';

export const MissingEncryptionFlagRule: Rule = {
  id: 'config-002-missing-encryption-flag',
  name: 'Missing Export Compliance Flag',
  description: 'Checks for missing ITSAppUsesNonExemptEncryption in Info.plist',
  category: RuleCategory.Config,
  severity: Severity.Medium,
  confidence: Confidence.High,
  guidelineReference: 'Export Compliance',

  async evaluate(context: ScanContext): Promise<Finding[]> {
    // If the key exists (true or false), the developer has declared their intent
    if (context.hasPlistKey('ITSAppUsesNonExemptEncryption')) {
      return [];
    }

    return [
      makeFinding(this, {
        description: `Your Info.plist is missing the ITSAppUsesNonExemptEncryption key. ` +
          `Without this key, App Store Connect will prompt you to answer export compliance ` +
          `questions manually on every single upload. This causes friction and potential delays ` +
          `in your submission workflow.`,
        location: 'Info.plist',
        fixGuidance: `Add the ITSAppUsesNonExemptEncryption key to your Info.plist. If your app ` +
          `only uses HTTPS/URLSession or standard iOS encryption (most apps), set it to false:

<key>ITSAppUsesNonExemptEncryption</key>
<false/>

Set it to true only if your app uses custom encryption algorithms beyond standard HTTPS ` +
          `(e.g., proprietary encryption, custom TLS implementations). In that case, you'll also ` +
          `need to submit export compliance documentation to Apple.`,
        documentationURL: 'https://developer.apple.com/documentation/bundleresources/information_property_list/itsappusesnonexemptencryption',
      }),
    ];
  },
};
