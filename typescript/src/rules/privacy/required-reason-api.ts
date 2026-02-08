/**
 * Rule: Required Reason API Usage Without Declaration
 *
 * Apple requires apps to declare usage of certain "Required Reason APIs" in
 * their privacy manifest (PrivacyInfo.xcprivacy). Using these APIs without
 * declaring them results in ITMS-91053 rejection.
 *
 * App Store Review Guideline: 5.1.1
 */
import type { Rule, Finding, ScanContext } from '../../types/index.js';
import { Severity, Confidence, RuleCategory } from '../../types/index.js';
import { makeFinding } from '../base.js';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Required Reason API categories and their detection patterns
 */
export interface APICategory {
  key: string;
  name: string;
  patterns: RegExp[];
  description: string;
}

export const REQUIRED_REASON_API_CATEGORIES: APICategory[] = [
  {
    key: 'NSPrivacyAccessedAPICategoryFileTimestamp',
    name: 'File Timestamp APIs',
    description: 'APIs that access file timestamps',
    patterns: [
      /\bNSFileCreationDate\b/,
      /\bNSFileModificationDate\b/,
      /\bNSURLContentModificationDateKey\b/,
      /\bNSURLCreationDateKey\b/,
      /\bgetattrlist\b/,
      /\bgetattrlistbulk\b/,
      /\bfgetattrlist\b/,
      /\bstat\b\s*\(/,
      /\bfstat\b\s*\(/,
      /\blstat\b\s*\(/,
      /\bfstatat\b\s*\(/,
      /\b\.contentModificationDateKey\b/,
      /\b\.creationDateKey\b/,
      /\bFileAttributeKey\.creationDate\b/,
      /\bFileAttributeKey\.modificationDate\b/,
      /\b\.modificationDate\b/,
      /\b\.creationDate\b/,
    ],
  },
  {
    key: 'NSPrivacyAccessedAPICategorySystemBootTime',
    name: 'System Boot Time APIs',
    description: 'APIs that access system uptime or boot time',
    patterns: [
      /\bsystemUptime\b/,
      /\bmach_absolute_time\b/,
      /\bProcessInfo\.processInfo\.systemUptime\b/,
      /\bNSProcessInfo\.processInfo\.systemUptime\b/,
    ],
  },
  {
    key: 'NSPrivacyAccessedAPICategoryDiskSpace',
    name: 'Disk Space APIs',
    description: 'APIs that access disk space information',
    patterns: [
      /\bvolumeAvailableCapacityKey\b/,
      /\bvolumeAvailableCapacityForImportantUsageKey\b/,
      /\bvolumeAvailableCapacityForOpportunisticUsageKey\b/,
      /\bvolumeTotalCapacityKey\b/,
      /\bNSURLVolumeAvailableCapacityKey\b/,
      /\bNSURLVolumeAvailableCapacityForImportantUsageKey\b/,
      /\bNSURLVolumeAvailableCapacityForOpportunisticUsageKey\b/,
      /\bNSURLVolumeTotalCapacityKey\b/,
      /\bNSFileSystemFreeSize\b/,
      /\bNSFileSystemSize\b/,
      /\bstatfs\b\s*\(/,
      /\bstatvfs\b\s*\(/,
      /\bfstatfs\b\s*\(/,
      /\bfstatvfs\b\s*\(/,
    ],
  },
  {
    key: 'NSPrivacyAccessedAPICategoryActiveKeyboards',
    name: 'Active Keyboards API',
    description: 'APIs that access the list of active keyboards',
    patterns: [
      /\bactiveInputModes\b/,
      /\bUITextInputMode\.activeInputModes\b/,
    ],
  },
  {
    key: 'NSPrivacyAccessedAPICategoryUserDefaults',
    name: 'UserDefaults API',
    description: 'APIs that access UserDefaults',
    patterns: [
      /\bUserDefaults\b/,
      /\bNSUserDefaults\b/,
      /\b\[\[NSUserDefaults\s+standardUserDefaults\]\b/,
    ],
  },
];

/**
 * Recursively find source files (.swift, .m) in a directory
 */
export function findSourceFiles(dir: string): string[] {
  const results: string[] = [];
  const skipDirs = new Set(['Pods', 'Carthage', 'DerivedData', '.build', 'node_modules', 'build', '.git']);

  function walk(d: string): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!skipDirs.has(entry.name)) {
          walk(path.join(d, entry.name));
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (ext === '.swift' || ext === '.m') {
          results.push(path.join(d, entry.name));
        }
      }
    }
  }

  walk(dir);
  return results;
}

/**
 * Scan source files for Required Reason API usage.
 * Returns a map of category key → list of files where detected.
 */
export function detectRequiredReasonAPIs(
  sourceFiles: string[]
): Map<string, string[]> {
  const result = new Map<string, string[]>();

  for (const file of sourceFiles) {
    let content: string;
    try {
      content = fs.readFileSync(file, 'utf-8');
    } catch {
      continue;
    }

    for (const category of REQUIRED_REASON_API_CATEGORIES) {
      for (const pattern of category.patterns) {
        if (pattern.test(content)) {
          const existing = result.get(category.key) || [];
          existing.push(file);
          result.set(category.key, existing);
          break; // One match per category per file is enough
        }
      }
    }
  }

  return result;
}

/**
 * Find and parse PrivacyInfo.xcprivacy, returning declared API category keys.
 */
export function findPrivacyManifest(projectPath: string): string | null {
  const searchPaths = [
    path.join(projectPath, 'PrivacyInfo.xcprivacy'),
    path.join(projectPath, 'Resources', 'PrivacyInfo.xcprivacy'),
  ];

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
        // ignore
      }
    }
  } catch {
    // ignore
  }

  for (const p of searchPaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  return null;
}

/**
 * Parse PrivacyInfo.xcprivacy XML plist and extract declared API category keys.
 */
export function parseDeclaredAPICategories(manifestPath: string): Set<string> {
  const declared = new Set<string>();
  let content: string;
  try {
    content = fs.readFileSync(manifestPath, 'utf-8');
  } catch {
    return declared;
  }

  // The plist structure has NSPrivacyAccessedAPITypes as an array of dicts,
  // each containing NSPrivacyAccessedAPIType → category string.
  // Simple regex extraction since it's well-structured XML.
  const typeRegex = /<key>NSPrivacyAccessedAPIType<\/key>\s*<string>(.*?)<\/string>/g;
  let match: RegExpExecArray | null;
  while ((match = typeRegex.exec(content)) !== null) {
    declared.add(match[1]);
  }

  return declared;
}

export const RequiredReasonAPIRule: Rule = {
  id: 'privacy-010-required-reason-api',
  name: 'Required Reason API Usage Without Declaration',
  description:
    'Detects usage of Required Reason APIs without corresponding declaration in PrivacyInfo.xcprivacy',
  category: RuleCategory.Privacy,
  severity: Severity.High,
  confidence: Confidence.High,
  guidelineReference: '5.1.1',

  async evaluate(context: ScanContext): Promise<Finding[]> {
    // 1. Find source files and detect API usage
    const sourceFiles = findSourceFiles(context.projectPath);
    const usedAPIs = detectRequiredReasonAPIs(sourceFiles);

    if (usedAPIs.size === 0) {
      return []; // No Required Reason APIs used
    }

    // 2. Find and parse privacy manifest
    const manifestPath = findPrivacyManifest(context.projectPath);
    const findings: Finding[] = [];

    if (!manifestPath) {
      // No manifest at all — report all used categories
      const categories = Array.from(usedAPIs.keys()).map((key) => {
        const cat = REQUIRED_REASON_API_CATEGORIES.find((c) => c.key === key);
        return cat ? cat.name : key;
      });

      findings.push(
        makeFinding(this, {
          title: 'Required Reason APIs Used Without Privacy Manifest',
          description:
            `Your app uses Required Reason APIs (${categories.join(', ')}) but no PrivacyInfo.xcprivacy ` +
            `file was found. Starting Spring 2024, Apple rejects apps (ITMS-91053) that use these APIs ` +
            `without declaring them in a privacy manifest.`,
          location: context.projectPath,
          fixGuidance:
            `Create a PrivacyInfo.xcprivacy file and declare the Required Reason API categories your app uses:\n\n` +
            Array.from(usedAPIs.keys())
              .map((key) => `  - ${key}`)
              .join('\n') +
            `\n\nIn Xcode: File > New > File > App Privacy. Then add entries under NSPrivacyAccessedAPITypes ` +
            `for each category with appropriate reason codes.\n\n` +
            `See: https://developer.apple.com/documentation/bundleresources/privacy_manifest_files/describing_use_of_required_reason_api`,
          documentationURL:
            'https://developer.apple.com/documentation/bundleresources/privacy_manifest_files/describing_use_of_required_reason_api',
        })
      );

      return findings;
    }

    // 3. Manifest exists — check which categories are declared
    const declaredCategories = parseDeclaredAPICategories(manifestPath);

    for (const [categoryKey, files] of usedAPIs.entries()) {
      if (!declaredCategories.has(categoryKey)) {
        const cat = REQUIRED_REASON_API_CATEGORIES.find(
          (c) => c.key === categoryKey
        );
        const categoryName = cat ? cat.name : categoryKey;
        const sampleFiles = files
          .slice(0, 3)
          .map((f) => path.relative(context.projectPath, f));
        const moreCount = files.length > 3 ? ` and ${files.length - 3} more` : '';

        findings.push(
          makeFinding(this, {
            title: `Undeclared Required Reason API: ${categoryName}`,
            description:
              `Your app uses ${categoryName} (${categoryKey}) in ${files.length} file(s) ` +
              `(${sampleFiles.join(', ')}${moreCount}) but this category is not declared in ` +
              `your PrivacyInfo.xcprivacy. Apple will reject submissions with ITMS-91053.`,
            location: manifestPath,
            fixGuidance:
              `Add the following to your PrivacyInfo.xcprivacy under NSPrivacyAccessedAPITypes:\n\n` +
              `<dict>\n` +
              `    <key>NSPrivacyAccessedAPIType</key>\n` +
              `    <string>${categoryKey}</string>\n` +
              `    <key>NSPrivacyAccessedAPITypeReasons</key>\n` +
              `    <array>\n` +
              `        <string>REASON_CODE</string>\n` +
              `    </array>\n` +
              `</dict>\n\n` +
              `Replace REASON_CODE with the appropriate reason from Apple's documentation.`,
            documentationURL:
              'https://developer.apple.com/documentation/bundleresources/privacy_manifest_files/describing_use_of_required_reason_api',
          })
        );
      }
    }

    return findings;
  },
};
