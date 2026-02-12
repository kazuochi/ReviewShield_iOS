/**
 * Rule: Dynamic Code Execution (§2.5.2)
 *
 * Detects patterns that load or execute code dynamically at runtime,
 * which Apple prohibits for App Store apps:
 * - JSContext().evaluateScript
 * - dlopen / dlsym
 * - NSClassFromString with suspicious (non-standard) classes
 * - Runtime code loading patterns (NSBundle load, etc.)
 */
import type { Rule, Finding, ScanContext } from '../../types/index.js';
import { Severity, Confidence, RuleCategory } from '../../types/index.js';
import { makeFinding, makeCustomFinding } from '../base.js';
import { findSourceFiles } from '../privacy/required-reason-api.js';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Well-known Apple framework classes that are safe with NSClassFromString
 */
const SAFE_NSCLASSFROMSTRING = new Set([
  // UIKit
  'UIViewController', 'UINavigationController', 'UITabBarController',
  'UITableViewController', 'UICollectionViewController', 'UIAlertController',
  'UIActivityViewController', 'UISplitViewController', 'UISearchController',
  'UIPageViewController', 'UIDocumentPickerViewController',
  'SFSafariViewController', 'SKStoreProductViewController',
  'MFMailComposeViewController', 'MFMessageComposeViewController',
  'UIImagePickerController', 'PHPickerViewController',
  'UIColorPickerViewController', 'UIFontPickerViewController',
  'CNContactPickerViewController', 'EKEventEditViewController',
  'QLPreviewController', 'ASWebAuthenticationSession',
  'ASAuthorizationController', 'WKWebView',
  // SwiftUI
  'UIHostingController',
  // Common patterns in well-known frameworks (Firebase, etc.)
  'FIRApp', 'FIRAnalytics', 'FIRCrashlytics',
  // Accessibility
  'UIAccessibility',
  // Test detection (common pattern)
  'XCTestCase', 'XCTest',
]);

interface DynCodeDetection {
  file: string;
  line: number;
  kind: 'js-eval' | 'dlopen' | 'dlsym' | 'nsclass-suspicious' | 'bundle-load';
  match: string;
}

/**
 * Patterns for JSContext evaluateScript
 */
const JS_EVAL_PATTERNS = [
  /\bJSContext\s*\(\s*\)\.evaluateScript\b/,
  /\bevaluateScript\s*\(/,
  /\bJSContext\b[^}]*\.evaluateScript\b/s,
];

/**
 * Patterns for dlopen/dlsym
 */
const DLOPEN_PATTERNS = [
  /\bdlopen\s*\(/,
  /\bdlsym\s*\(/,
];

/**
 * Patterns for NSBundle load (dynamic framework loading)
 * Must be specific to Bundle/NSBundle to avoid false positives on .load() on other types
 */
const BUNDLE_LOAD_PATTERNS = [
  /\bNSBundle\b[^;\n]*\.load\s*\(/,
  /\bBundle\s*\([^)]*\)\s*[.!?]*\s*\.load\s*\(/,
  /\bbundle\s*\.load\s*\(/,
  /\bloadAndReturnError\b/,
];

export const DynamicCodeExecutionRule: Rule = {
  id: 'code-003-dynamic-code-execution',
  name: 'Dynamic Code Execution',
  description: 'Detects dynamic code loading/execution that violates App Store guidelines',
  category: RuleCategory.Config,
  severity: Severity.Critical,
  confidence: Confidence.High,
  guidelineReference: '2.5.2',

  async evaluate(context: ScanContext): Promise<Finding[]> {
    const sourceFiles = findSourceFiles(context.projectPath);
    const detections: DynCodeDetection[] = [];

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
        const trimmed = line.trim();

        // Skip comments
        if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;

        // JSContext evaluateScript
        for (const pattern of JS_EVAL_PATTERNS) {
          if (pattern.test(line)) {
            detections.push({ file, line: lineNum, kind: 'js-eval', match: 'JSContext.evaluateScript' });
            break;
          }
        }

        // dlopen/dlsym
        for (const pattern of DLOPEN_PATTERNS) {
          if (pattern.test(line)) {
            // Avoid false positive for test files or comments
            const fn = line.match(/\b(dlopen|dlsym)\b/)?.[1] ?? 'dlopen/dlsym';
            detections.push({ file, line: lineNum, kind: 'dlopen', match: fn });
            break;
          }
        }

        // NSClassFromString with suspicious classes
        const nscMatch = line.match(/NSClassFromString\(\s*"(\w+)"\s*\)/);
        if (nscMatch) {
          const className = nscMatch[1];
          // Safe prefixes: Apple framework conventions
          const safePrefixes = ['UI', 'NS', 'CL', 'MK', 'AV', 'SK', 'WK', 'SF', 'AS', 'CN', 'EK', 'QL', 'MF', 'PH', 'XC', 'CA', 'CK', 'HK', 'MT', 'SC', 'GK', 'FIR', 'GID', 'FB'];
          const isSafe = SAFE_NSCLASSFROMSTRING.has(className) || safePrefixes.some(p => className.startsWith(p));
          if (!isSafe) {
            detections.push({ file, line: lineNum, kind: 'nsclass-suspicious', match: className });
          }
        }

        // NSBundle load patterns — only flag explicit Bundle/NSBundle.load() calls
        for (const pattern of BUNDLE_LOAD_PATTERNS) {
          if (pattern.test(line)) {
            // Must actually reference Bundle/NSBundle
            if (/\b(Bundle|NSBundle|bundle)\b/.test(line)) {
              // Avoid false positives on resource bundles
              if (!/\b(UIImage|NSImage|UIFont|NSFont|UIStoryboard|UIViewController)\b/.test(line) &&
                  !/\bnib\b/i.test(line) && !/\bstoryboard\b/i.test(line) &&
                  !/\bresource\b/i.test(line)) {
                detections.push({ file, line: lineNum, kind: 'bundle-load', match: 'NSBundle.load' });
              }
            }
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
        case 'js-eval':
          findings.push(makeFinding(this, {
            title: 'JavaScript Evaluation at Runtime',
            description: `JSContext.evaluateScript detected in ${relFile}:${det.line}. Executing dynamically downloaded JavaScript code can cause rejection.`,
            location: relFile,
            line: det.line,
            fixGuidance: 'If using JavaScriptCore for app logic, ensure scripts are bundled with the app binary, not downloaded at runtime. Consider using native Swift/ObjC instead.',
          }));
          break;
        case 'dlopen':
        case 'dlsym':
          findings.push(makeFinding(this, {
            title: 'Dynamic Library Loading (dlopen/dlsym)',
            description: `dlopen/dlsym call detected in ${relFile}:${det.line}. Loading executable code at runtime violates App Store guidelines.`,
            location: relFile,
            line: det.line,
            fixGuidance: 'Remove dlopen/dlsym calls. Link frameworks at build time instead of loading them dynamically at runtime.',
          }));
          break;
        case 'nsclass-suspicious':
          findings.push(makeCustomFinding(this, Severity.Medium, Confidence.Medium, {
            title: 'Suspicious NSClassFromString Usage',
            description: `NSClassFromString used with non-standard class (${det.match}) in ${relFile}:${det.line}. This may indicate runtime class resolution for code loading.`,
            location: relFile,
            line: det.line,
            fixGuidance: 'Use direct class references instead of NSClassFromString where possible. If used for optional framework detection, ensure the class is from a public Apple framework.',
          }));
          break;
        case 'bundle-load':
          findings.push(makeCustomFinding(this, Severity.High, Confidence.Medium, {
            title: 'Dynamic Bundle Loading',
            description: `NSBundle.load() or equivalent detected in ${relFile}:${det.line}. Loading executable bundles at runtime may violate App Store guidelines.`,
            location: relFile,
            line: det.line,
            fixGuidance: 'Link frameworks at build time. If loading resource bundles (not code), this is fine — verify the bundle contains only resources.',
          }));
          break;
      }
    }

    return findings;
  },
};
