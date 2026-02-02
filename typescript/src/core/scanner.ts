/**
 * Core scan engine
 */
import type { Rule, Finding, ScanResult, ScanContext, ScanOptions } from '../types/index.js';
import { discoverProject, createScanContext } from '../parsers/project-parser.js';
import { allRules, getRules, getRulesExcluding } from '../rules/index.js';

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
    rules = getRules(options.rules);
  } else if (options.exclude && options.exclude.length > 0) {
    rules = getRulesExcluding(options.exclude);
  } else {
    rules = allRules;
  }
  
  // Run all rules
  const findings: Finding[] = [];
  const rulesRun: string[] = [];
  
  for (const rule of rules) {
    try {
      const ruleFindings = await rule.evaluate(context);
      findings.push(...ruleFindings);
      rulesRun.push(rule.id);
    } catch (error) {
      if (options.verbose) {
        console.error(`Error running rule ${rule.id}:`, error);
      }
    }
  }
  
  const duration = Date.now() - startTime;
  
  return {
    projectPath: options.path,
    timestamp: new Date(),
    findings,
    rulesRun,
    duration,
  };
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
