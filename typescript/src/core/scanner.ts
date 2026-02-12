/**
 * Core scan engine
 */
import * as fs from 'fs';
import * as path from 'path';
import type { Rule, Finding, ScanResult, ScanContext, ScanOptions } from '../types/index.js';
import { discoverProject, createScanContext } from '../parsers/project-parser.js';
import type { ProjectDiscovery } from '../parsers/project-parser.js';
import { allRules, getRulesWithValidation, getRulesExcluding } from '../rules/index.js';
import { applySuppression } from './suppression.js';

/**
 * Error thrown when invalid rule IDs are specified
 */
export class InvalidRulesError extends Error {
  constructor(public unknownIds: string[], public availableIds: string[]) {
    super(
      `Unknown rule ID(s): ${unknownIds.join(', ')}. ` +
      `Available rules: ${availableIds.join(', ')}`
    );
    this.name = 'InvalidRulesError';
  }
}

/**
 * Error thrown when no rules would be run
 */
export class NoRulesError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NoRulesError';
  }
}

/**
 * Run a scan on the given path
 */
export async function scan(options: ScanOptions): Promise<ScanResult> {
  const startTime = Date.now();
  
  // Discover project structure
  const discovery = discoverProject(options.path);
  
  // Create scan context
  const context = createScanContext(discovery);
  
  // Determine which rules to run
  let rules: Rule[];
  
  if (options.rules && options.rules.length > 0) {
    // BUG FIX #2: Validate rule IDs and error on unknown
    const { rules: foundRules, unknownIds } = getRulesWithValidation(options.rules);
    
    if (unknownIds.length > 0) {
      throw new InvalidRulesError(
        unknownIds,
        allRules.map(r => r.id)
      );
    }
    
    if (foundRules.length === 0) {
      throw new NoRulesError(
        'No valid rules to run. Check your --rules argument.'
      );
    }
    
    rules = foundRules;
  } else if (options.exclude && options.exclude.length > 0) {
    rules = getRulesExcluding(options.exclude);
    
    if (rules.length === 0) {
      throw new NoRulesError(
        'All rules were excluded. At least one rule must run.'
      );
    }
  } else {
    rules = allRules;
  }
  
  // Final safety check: never run with zero rules
  if (rules.length === 0) {
    throw new NoRulesError(
      'No rules available to run. This should not happen - please report this bug.'
    );
  }
  
  // Run all rules
  const findings: Finding[] = [];
  const rulesRun: string[] = [];
  const ruleErrors: string[] = [];
  
  for (const rule of rules) {
    try {
      const ruleFindings = await rule.evaluate(context);
      findings.push(...ruleFindings);
      rulesRun.push(rule.id);
    } catch (error) {
      ruleErrors.push(rule.id);
      if (options.verbose) {
        console.error(`Error running rule ${rule.id}:`, error);
      }
    }
  }
  
  if (ruleErrors.length > 0) {
    console.warn(`⚠️  ${ruleErrors.length} rule(s) failed to run: ${ruleErrors.join(', ')}. Use --verbose for details.`);
  }
  
  const duration = Date.now() - startTime;
  
  // Apply suppression (inline comments + .shiplintignore)
  const { activeFindings, suppressedFindings } = applySuppression(findings, options.path);
  
  // Determine project type and framework detection method from discovery
  const projectType = deriveProjectType(discovery);
  const frameworkDetectionMethod = deriveFrameworkDetectionMethod(discovery, context);
  const frameworksDetected = [...context.linkedFrameworks].sort();
  const targetCount = rules.length > 0 ? 1 : 0; // Currently scans main target
  
  return {
    projectPath: options.path,
    timestamp: new Date(),
    findings: activeFindings,
    suppressedFindings,
    rulesRun,
    duration,
    projectType,
    frameworkDetectionMethod,
    frameworksDetected,
    targetCount,
  };
}

/**
 * Derive project type from discovery info
 */
function deriveProjectType(discovery: ProjectDiscovery): 'xcodeproj' | 'swiftpm' | 'both' | 'unknown' {
  const hasXcodeproj = !!discovery.pbxprojPath;
  
  // Check for Package.swift in project directory
  const basePath = discovery.projectScopeDir ?? discovery.projectPath;
  const hasPackageSwift = fs.existsSync(path.join(basePath, 'Package.swift'));
  
  if (hasXcodeproj && hasPackageSwift) return 'both';
  if (hasXcodeproj) return 'xcodeproj';
  if (hasPackageSwift) return 'swiftpm';
  return 'unknown';
}

/**
 * Derive how frameworks were detected
 */
function deriveFrameworkDetectionMethod(
  discovery: ProjectDiscovery,
  context: ScanContext
): 'pbxproj' | 'import-scan' | 'both' {
  const hasPbxproj = !!discovery.pbxprojPath;
  // We always run import-scan (scanSwiftImports) in createScanContext
  const hasImportScan = context.linkedFrameworks.size > 0;
  
  if (hasPbxproj && hasImportScan) return 'both';
  if (hasPbxproj) return 'pbxproj';
  return 'import-scan';
}

/**
 * Run a scan with a pre-built context (for testing)
 */
export async function scanWithContext(
  context: ScanContext,
  rules?: Rule[]
): Promise<Finding[]> {
  const rulesToRun = rules ?? allRules;
  const findings: Finding[] = [];
  
  for (const rule of rulesToRun) {
    const ruleFindings = await rule.evaluate(context);
    findings.push(...ruleFindings);
  }
  
  return findings;
}
