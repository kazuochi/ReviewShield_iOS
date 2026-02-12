/**
 * TypeScript interfaces for ShipLint
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
  Metadata = 'metadata',
  Config = 'config',
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
  /** Line number in the source file (1-indexed) */
  line?: number;
  guideline: string;
  fixGuidance: string;
  documentationURL?: string;
  /** Whether this finding was suppressed */
  suppressed?: boolean;
  /** Reason for suppression */
  suppressionReason?: string;
}

/**
 * Result of a scan
 */
export interface ScanResult {
  projectPath: string;
  timestamp: Date;
  findings: Finding[];
  suppressedFindings: Finding[];
  rulesRun: string[];
  duration: number;
  /** Project type detected: xcodeproj, swiftpm, both, or unknown */
  projectType: 'xcodeproj' | 'swiftpm' | 'both' | 'unknown';
  /** How frameworks were detected */
  frameworkDetectionMethod: 'pbxproj' | 'import-scan' | 'both';
  /** Framework names found (anonymous — no paths) */
  frameworksDetected: string[];
  /** Number of targets scanned */
  targetCount: number;
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
  infoPlistPath?: string;
  entitlements: Record<string, unknown>;
  entitlementsPath?: string;
  pbxprojPath?: string;
  linkedFrameworks: Set<string>;
  dependencies: Dependency[];
  /** Build settings from the main target's build configuration */
  buildSettings: Record<string, string>;
  
  // Helper methods
  plistString(key: string): string | undefined;
  plistArray(key: string): unknown[] | undefined;
  plistBool(key: string): boolean | undefined;
  hasPlistKey(key: string): boolean;
  hasFramework(name: string): boolean;
  hasEntitlement(key: string): boolean;
  entitlementString(key: string): string | undefined;
  entitlementArray(key: string): unknown[] | undefined;
  hasBuildSetting(key: string): boolean;
  buildSettingValue(key: string): string | undefined;
  /** Whether the project uses GENERATE_INFOPLIST_FILE = YES */
  generatesInfoPlist(): boolean;
  /** Whether this target is an app extension (not a full app) */
  isExtension(): boolean;
  /** Whether this is a macOS-only target (no iOS support) */
  isMacOSOnly(): boolean;
  /** Whether this is a framework/library target (not an app) */
  isFrameworkTarget(): boolean;
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
  format?: OutputFormat;
  verbose?: boolean;
  rules?: string[];
  exclude?: string[];
  showSuppressed?: boolean;
}
