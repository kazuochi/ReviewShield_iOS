/**
 * Rule: Missing Privacy Manifest
 * 
 * iOS 17+ requires PrivacyInfo.xcprivacy for apps that use certain APIs
 * known as "Required Reason APIs". This rule checks for common indicators
 * that an app may need a privacy manifest.
 * 
 * App Store Review Guideline: 5.1.1
 */
import type { Rule, Finding, ScanContext } from '../../types/index.js';
import { Severity, Confidence, RuleCategory } from '../../types/index.js';
// Note: using Privacy category as privacy manifest relates to data privacy compliance
import { makeFinding, makeCustomFinding } from '../base.js';
import * as fs from 'fs';
import * as path from 'path';

/**
 * SDK dependencies commonly known to require privacy manifests
 */
const SDK_REQUIRING_PRIVACY_MANIFEST = [
  { pattern: 'Firebase', name: 'Firebase', note: 'Firebase SDKs require privacy manifests as of May 2024' },
  { pattern: 'Facebook', name: 'Facebook SDK', note: 'Facebook SDK requires privacy manifests' },
  { pattern: 'FBSDK', name: 'Facebook SDK', note: 'Facebook SDK requires privacy manifests' },
  { pattern: 'GoogleMobileAds', name: 'Google Mobile Ads', note: 'Google Ad SDK requires privacy manifests' },
  { pattern: 'Google-Mobile-Ads', name: 'Google Mobile Ads', note: 'Google Ad SDK requires privacy manifests' },
  { pattern: 'Crashlytics', name: 'Crashlytics', note: 'Crashlytics requires privacy manifests' },
  { pattern: 'Amplitude', name: 'Amplitude', note: 'Amplitude SDK requires privacy manifests' },
  { pattern: 'Mixpanel', name: 'Mixpanel', note: 'Mixpanel SDK requires privacy manifests' },
  { pattern: 'Adjust', name: 'Adjust', note: 'Adjust SDK requires privacy manifests' },
  { pattern: 'AppsFlyer', name: 'AppsFlyer', note: 'AppsFlyer SDK requires privacy manifests' },
];

/**
 * Check if a privacy manifest exists in the project
 */
function findPrivacyManifest(projectPath: string): string | null {
  const searchPaths = [
    path.join(projectPath, 'PrivacyInfo.xcprivacy'),
    path.join(projectPath, 'Resources', 'PrivacyInfo.xcprivacy'),
  ];
  
  // Also search in subdirectories (common app structure)
  try {
    const entries = fs.readdirSync(projectPath);
    for (const entry of entries) {
      const fullPath = path.join(projectPath, entry);
      try {
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          searchPaths.push(path.join(fullPath, 'PrivacyInfo.xcprivacy'));
          searchPaths.push(path.join(fullPath, 'Resources', 'PrivacyInfo.xcprivacy'));
        }
      } catch {
        // Ignore stat errors
      }
    }
  } catch {
    // Ignore readdir errors
  }
  
  for (const searchPath of searchPaths) {
    if (fs.existsSync(searchPath)) {
      return searchPath;
    }
  }
  
  return null;
}

export const MissingPrivacyManifestRule: Rule = {
  id: 'metadata-001-missing-privacy-manifest',
  name: 'Missing Privacy Manifest',
  description: 'Checks for presence of PrivacyInfo.xcprivacy when using Required Reason APIs or common SDKs',
  category: RuleCategory.Metadata,
  severity: Severity.High,
  confidence: Confidence.Medium,
  guidelineReference: '5.1.1',

  async evaluate(context: ScanContext): Promise<Finding[]> {
    // Check if privacy manifest exists
    const privacyManifestPath = findPrivacyManifest(context.projectPath);
    
    if (privacyManifestPath) {
      // Privacy manifest exists, no issue
      return [];
    }

    const findings: Finding[] = [];
    
    // Check for SDKs that commonly require privacy manifests
    const detectedSDKs: string[] = [];
    for (const sdk of SDK_REQUIRING_PRIVACY_MANIFEST) {
      const hasSDK = context.dependencies.some(dep => 
        dep.name.toLowerCase().includes(sdk.pattern.toLowerCase())
      );
      if (hasSDK && !detectedSDKs.includes(sdk.name)) {
        detectedSDKs.push(sdk.name);
      }
    }

    if (detectedSDKs.length > 0) {
      findings.push(makeFinding(this, {
        title: 'Missing Privacy Manifest for Third-Party SDKs',
        description: `Your app uses SDKs that require privacy manifests: ${detectedSDKs.join(', ')}. ` +
          `Starting Spring 2024, apps submitted to the App Store must include a privacy manifest ` +
          `(PrivacyInfo.xcprivacy) that declares the data collection and Required Reason API usage ` +
          `from these SDKs.`,
        location: context.projectPath,
        fixGuidance: `Create a PrivacyInfo.xcprivacy file in your project root and declare the Required Reason APIs ` +
          `used by your app and its dependencies.

1. In Xcode, File > New > File > iOS > Resource > App Privacy
2. Add entries for each Required Reason API category your app uses
3. Ensure third-party SDK privacy manifests are bundled with your app

Most SDK vendors now provide privacy manifests with their SDKs. Update to the latest versions.

Example PrivacyInfo.xcprivacy structure:
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>NSPrivacyTracking</key>
    <false/>
    <key>NSPrivacyCollectedDataTypes</key>
    <array/>
    <key>NSPrivacyAccessedAPITypes</key>
    <array>
        <dict>
            <key>NSPrivacyAccessedAPIType</key>
            <string>NSPrivacyAccessedAPICategoryUserDefaults</string>
            <key>NSPrivacyAccessedAPITypeReasons</key>
            <array>
                <string>CA92.1</string>
            </array>
        </dict>
    </array>
</dict>
</plist>`,
        documentationURL: 'https://developer.apple.com/documentation/bundleresources/privacy_manifest_files',
      }));
    }

    // If no SDK indicators but this is a newer project, provide informational warning
    if (findings.length === 0) {
      // Check for frameworks that might use Required Reason APIs
      const commonFrameworks = ['Foundation', 'UIKit'];
      const hasCommonFrameworks = commonFrameworks.some(f => context.hasFramework(f));
      
      if (hasCommonFrameworks && context.dependencies.length > 0) {
        findings.push(makeCustomFinding(this, Severity.Info, Confidence.Low, {
          title: 'Consider Adding Privacy Manifest',
          description: `Your app uses third-party dependencies which may use Required Reason APIs. ` +
            `Consider adding a PrivacyInfo.xcprivacy to avoid potential App Store submission issues.`,
          location: context.projectPath,
          fixGuidance: `Review Apple's Required Reason API documentation and check if your app or its ` +
            `dependencies use any of these APIs:

- File timestamp APIs (NSFileCreationDate, NSFileModificationDate)
- System boot time APIs (systemUptime)  
- Disk space APIs (volumeAvailableCapacity)
- User defaults (UserDefaults.standard)
- Active keyboard APIs (activeInputModes)

If any are used, create a PrivacyInfo.xcprivacy and declare the appropriate reasons.`,
          documentationURL: 'https://developer.apple.com/documentation/bundleresources/privacy_manifest_files/describing_use_of_required_reason_api',
        }));
      }
    }

    return findings;
  },
};
