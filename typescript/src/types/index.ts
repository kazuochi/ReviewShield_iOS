/**
 * TypeScript interfaces for ReviewShield
 */

/**
 * Severity level of a finding
 */
export enum Severity {
  Critical = 'critical',
  High = 'high',
  Medium = 'medium',
  Low = 'low',
  Info = 'info',
}

/**
 * Confidence level of a finding
 */
export enum Confidence {
  High = 'high',
  Medium = 'medium',
  Low = 'low',
}

/**
 * Category of a rule
 */
export enum RuleCategory {
  Privacy = 'privacy',
  Auth = 'auth',
  Entitlements = 'entitlements',
  Performance = 'performance',
  Content = 'content',
}

/**
 * Source of a dependency
 */
export enum DependencySource {
  CocoaPods = 'cocoapods',
  SPM = 'spm',
  Carthage = 'carthage',
  Manual = 'manual',
}

/**
 * A third-party dependency
 */
export interface Dependency {
  name: string;
  version?: string;
  source: DependencySource;
}

/**
 * A single finding from a rule evaluation
 */
export interface Finding {
  ruleId: string;
  severity: Severity;
  confidence: Confidence;
  title: string;
  description: string;
  location?: string;
  guideline: string;
  fixGuidance: string;
  documentationURL?: string;
}

/**
 * Result of a scan
 */
export interface ScanResult {
  projectPath: string;
  timestamp: Date;
  findings: Finding[];
  rulesRun: string[];
  duration: number;
}

/**
 * Parsed Info.plist data
 */
export interface ParsedInfoPlist {
  bundleIdentifier?: string;
  displayName?: string;
  bundleName?: string;
  minimumOSVersion?: string;
  requiredDeviceCapabilities: string[];
  backgroundModes: string[];
  usageDescriptions: Record<string, string>;
  raw: Record<string, unknown>;
}

/**
 * Scan context containing all parsed project data
 */
export interface ScanContext {
  projectPath: string;
  infoPlist: Record<string, unknown>;
  entitlements: Record<string, unknown>;
  linkedFrameworks: Set<string>;
  dependencies: Dependency[];
  
  // Helper methods
  plistString(key: string): string | undefined;
  plistArray(key: string): unknown[] | undefined;
  plistBool(key: string): boolean | undefined;
  hasPlistKey(key: string): boolean;
  hasFramework(name: string): boolean;
  hasEntitlement(key: string): boolean;
  entitlementString(key: string): string | undefined;
  entitlementArray(key: string): unknown[] | undefined;
}

/**
 * Rule interface - each rule must implement this
 */
export interface Rule {
  id: string;
  name: string;
  description: string;
  category: RuleCategory;
  severity: Severity;
  confidence: Confidence;
  guidelineReference: string;
  
  /**
   * Evaluate the rule against the scan context
   */
  evaluate(context: ScanContext): Promise<Finding[]>;
}

/**
 * Output format options
 */
export enum OutputFormat {
  Text = 'text',
  JSON = 'json',
  SARIF = 'sarif',
}

/**
 * CLI options
 */
export interface ScanOptions {
  path: string;
  format: OutputFormat;
  verbose: boolean;
  rules?: string[];
  exclude?: string[];
}
