/**
 * Rule: Private API Usage (§2.5.1)
 *
 * Detects usage of private/undocumented Apple APIs that cause App Store rejection:
 * - UIWebView (deprecated, rejected since iOS 12)
 * - valueForKey/setValue:forKey on UIKit private properties (_placeholderLabel, _searchField, etc.)
 * - Known private framework imports
 * - objc_msgSend to known private selectors
 */
import type { Rule, Finding, ScanContext } from '../../types/index.js';
import { Severity, Confidence, RuleCategory } from '../../types/index.js';
import { makeFinding, makeCustomFinding } from '../base.js';
import { findSourceFiles } from '../privacy/required-reason-api.js';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Known private UIKit properties accessed via KVC
 */
const PRIVATE_KVC_PROPERTIES = [
  '_placeholderLabel',
  '_searchField',
  '_placeholderColor',
  '_backgroundView',
  '_navigationBarBackIndicatorView',
  '_barTintColor',
  '_titleView',
  '_leftViews',
  '_rightViews',
  '_contentView',
  '_backdropView',
  '_cancelButton',
  '_cancelButtonText',
  '_UINavigationBarBackground',
  '_barPosition',
  '_statusBarWindow',
  '_statusBar',
];

/**
 * Known private framework headers
 */
const PRIVATE_FRAMEWORK_IMPORTS = [
  /^\s*#import\s+<UIKit\/UI\w+_Private\.h>/,
  /^\s*#import\s+<UIKit\/UIStatusBar\.h>/,
  /^\s*#import\s+<GraphicsServices\//,
  /^\s*#import\s+<SpringBoardServices\//,
  /^\s*#import\s+<BackBoardServices\//,
  /^\s*#import\s+<MobileInstallation\//,
  /^\s*#import\s+<AppSupport\//,
  /^\s*@import\s+UIKitCore\b/,
];

/**
 * Patterns for UIWebView usage
 */
const UIWEBVIEW_PATTERNS = [
  /\bUIWebView\b/,
];

/**
 * Patterns for private KVC access on UIKit objects
 * We look for valueForKey/setValue:forKey with known private property strings
 */
function buildKVCPatterns(): RegExp[] {
  const patterns: RegExp[] = [];
  for (const prop of PRIVATE_KVC_PROPERTIES) {
    // Swift: value(forKey: "_placeholderLabel")
    patterns.push(new RegExp(`value\\(forKey:\\s*"${escapeRegex(prop)}"\\)`));
    // Swift: setValue(xxx, forKey: "_placeholderLabel")
    patterns.push(new RegExp(`setValue\\([^)]*forKey:\\s*"${escapeRegex(prop)}"\\)`));
    // ObjC: [xxx valueForKey:@"_placeholderLabel"]
    patterns.push(new RegExp(`valueForKey:\\s*@"${escapeRegex(prop)}"`));
    // ObjC: [xxx setValue:xxx forKey:@"_placeholderLabel"]
    patterns.push(new RegExp(`setValue:[^\\]]*forKey:\\s*@"${escapeRegex(prop)}"`));
  }
  return patterns;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Patterns for objc_msgSend with suspicious selectors
 */
const OBJC_MSGSEND_PRIVATE_PATTERNS = [
  /\bobjc_msgSend\s*\([^,]+,\s*@selector\(\s*_\w+\s*\)/,
  /\bobjc_msgSend\s*\([^,]+,\s*sel_registerName\(\s*"_\w+/,
  /\bNSSelectorFromString\(\s*@?"_\w+"\s*\)/,
  /\bSelectortor\(\s*"_\w+"\s*\)/,
  /\bSelector\(\s*"_\w+"\s*\)/,
  /\b#selector\(\s*_\w+\)/,
];

interface Detection {
  file: string;
  line: number;
  kind: 'uiwebview' | 'private-kvc' | 'private-import' | 'private-selector';
  match: string;
}

const KVC_PATTERNS = buildKVCPatterns();

export const PrivateAPIUsageRule: Rule = {
  id: 'code-001-private-api-usage',
  name: 'Private API Usage',
  description: 'Detects usage of private/undocumented Apple APIs that cause App Store rejection',
  category: RuleCategory.Config,
  severity: Severity.Critical,
  confidence: Confidence.High,
  guidelineReference: '2.5.1',

  async evaluate(context: ScanContext): Promise<Finding[]> {
    const sourceFiles = findSourceFiles(context.projectPath);
    const detections: Detection[] = [];

    for (const file of sourceFiles) {
      let content: string;
      try {
        content = fs.readFileSync(file, 'utf-8');
      } catch {
        continue;
      }

      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineNum = i + 1;

        // Skip comments
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;

        // UIWebView
        for (const pattern of UIWEBVIEW_PATTERNS) {
          if (pattern.test(line)) {
            // Avoid false positive: WKWebView contains "WebView" but not "UIWebView"
            // Also skip if it's in a comment about migration
            if (!trimmed.startsWith('//') && !trimmed.startsWith('*')) {
              detections.push({ file, line: lineNum, kind: 'uiwebview', match: 'UIWebView' });
            }
            break;
          }
        }

        // Private KVC
        for (const pattern of KVC_PATTERNS) {
          if (pattern.test(line)) {
            const m = line.match(/"(_\w+)"/);
            detections.push({
              file, line: lineNum, kind: 'private-kvc',
              match: m ? m[1] : 'private property',
            });
            break;
          }
        }

        // Private framework imports
        for (const pattern of PRIVATE_FRAMEWORK_IMPORTS) {
          if (pattern.test(line)) {
            detections.push({ file, line: lineNum, kind: 'private-import', match: trimmed });
            break;
          }
        }

        // Private selectors via objc_msgSend/NSSelectorFromString
        for (const pattern of OBJC_MSGSEND_PRIVATE_PATTERNS) {
          if (pattern.test(line)) {
            const m = line.match(/"(_\w+)"/);
            detections.push({
              file, line: lineNum, kind: 'private-selector',
              match: m ? m[1] : 'private selector',
            });
            break;
          }
        }
      }
    }

    if (detections.length === 0) return [];

    const findings: Finding[] = [];

    // Emit per-detection findings with line numbers for suppression support
    for (const det of detections) {
      const relFile = path.relative(context.projectPath, det.file);
      switch (det.kind) {
        case 'uiwebview':
          findings.push(makeFinding(this, {
            title: 'UIWebView Usage (Deprecated & Rejected)',
            description: `UIWebView is deprecated since iOS 12 and Apple rejects apps that reference it. Found in: ${relFile}:${det.line}`,
            location: relFile,
            line: det.line,
            fixGuidance: 'Replace all UIWebView usage with WKWebView. Also check your dependencies — some older pods still reference UIWebView.',
            documentationURL: 'https://developer.apple.com/documentation/webkit/wkwebview',
          }));
          break;
        case 'private-kvc':
          findings.push(makeFinding(this, {
            title: 'Private UIKit Property Access via KVC',
            description: `Accessing private UIKit property (${det.match}) via valueForKey/setValue:forKey will cause App Store rejection. Found in: ${relFile}:${det.line}`,
            location: relFile,
            line: det.line,
            fixGuidance: 'Use public API alternatives instead of KVC on private properties. For placeholder color, use attributedPlaceholder. For search fields, use searchTextField (iOS 13+).',
          }));
          break;
        case 'private-import':
          findings.push(makeFinding(this, {
            title: 'Private Framework Import',
            description: `Importing private/undocumented Apple frameworks will cause App Store rejection. Found in: ${relFile}:${det.line}`,
            location: relFile,
            line: det.line,
            fixGuidance: 'Remove imports of private Apple frameworks and use only public APIs.',
          }));
          break;
        case 'private-selector':
          findings.push(makeFinding(this, {
            title: 'Private Selector Usage',
            description: `Using private selector (${det.match}) via objc_msgSend or NSSelectorFromString will cause App Store rejection. Found in: ${relFile}:${det.line}`,
            location: relFile,
            line: det.line,
            fixGuidance: 'Replace private selector calls with equivalent public API methods.',
          }));
          break;
      }
    }

    return findings;
  },
};
