/**
 * Text formatter for human-readable output
 * v1.4: Ship verdict, severity grouping, scanner breakdown
 */
import type { ScanResult, Finding } from '../types/index.js';
import { Severity, Confidence } from '../types/index.js';

// Dynamic import for chalk (ESM)
let chalk: typeof import('chalk').default;

async function getChalk() {
  if (!chalk) {
    const module = await import('chalk');
    chalk = module.default;
  }
  return chalk;
}

/**
 * Get severity color
 */
function getSeverityColor(severity: Severity): (text: string) => string {
  switch (severity) {
    case Severity.Critical:
      return (text) => chalk.red.bold(text);
    case Severity.High:
      return (text) => chalk.red(text);
    case Severity.Medium:
      return (text) => chalk.yellow(text);
    case Severity.Low:
      return (text) => chalk.blue(text);
    case Severity.Info:
      return (text) => chalk.gray(text);
  }
}

/**
 * Get confidence label
 */
function getConfidenceLabel(confidence: Confidence): string {
  switch (confidence) {
    case Confidence.High:
      return 'high confidence';
    case Confidence.Medium:
      return 'medium confidence';
    case Confidence.Low:
      return 'low confidence';
  }
}

/**
 * Severity sort order
 */
const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

/**
 * Format a single finding
 */
async function formatFinding(finding: Finding, index: number): Promise<string> {
  const c = await getChalk();
  const severityColor = getSeverityColor(finding.severity);
  
  const lines: string[] = [];
  
  // Header
  lines.push(
    `${c.bold(`${index + 1}.`)} ${severityColor(`[${finding.severity.toUpperCase()}]`)} ${c.bold(finding.title)}`
  );
  
  // Location and guideline
  const meta: string[] = [];
  if (finding.location) {
    meta.push(`📍 ${finding.location}`);
  }
  meta.push(`🧩 Rule ${finding.ruleId}`);
  meta.push(`📋 Guideline ${finding.guideline}`);
  meta.push(`🎯 ${getConfidenceLabel(finding.confidence)}`);
  lines.push(c.dim(`   ${meta.join(' • ')}`));
  
  // Description
  lines.push('');
  lines.push(c.white(`   ${finding.description}`));
  
  // Fix guidance
  lines.push('');
  lines.push(c.green.bold('   How to fix:'));
  for (const line of finding.fixGuidance.split('\n')) {
    lines.push(c.green(`   ${line}`));
  }
  
  // Documentation URL
  if (finding.documentationURL) {
    lines.push('');
    lines.push(c.cyan(`   📚 ${finding.documentationURL}`));
  }
  
  return lines.join('\n');
}

/**
 * Get scanner name from rule ID
 */
function getScannerFromRuleId(ruleId: string): string {
  if (ruleId.startsWith('privacy-')) return 'Privacy';
  if (ruleId.startsWith('auth-')) return 'Auth';
  if (ruleId.startsWith('metadata-')) return 'Metadata';
  if (ruleId.startsWith('config-')) return 'Config';
  if (ruleId.startsWith('code-')) return 'Code Analysis';
  return 'Other';
}

/**
 * Format scan results as text
 */
export async function formatText(result: ScanResult): Promise<string> {
  const c = await getChalk();
  const lines: string[] = [];
  const suppressedCount = result.suppressedFindings?.length ?? 0;
  const suppressedSuffix = suppressedCount > 0 ? ` (${suppressedCount} suppressed)` : '';
  
  // Header
  lines.push(c.bold.underline('\n🛡️  ShipLint Scan Results\n'));
  lines.push(`📁 Project: ${result.projectPath}`);
  lines.push(`🕐 Scanned: ${result.timestamp.toISOString()}`);
  lines.push(`⏱️  Duration: ${result.duration}ms`);
  lines.push(`📊 Rules run: ${result.rulesRun.length}`);
  if (suppressedCount > 0) {
    lines.push(`🔇 Suppressed: ${suppressedCount}`);
  }
  lines.push('');
  
  // Count by severity
  const bySeverity = new Map<Severity, Finding[]>();
  for (const finding of result.findings) {
    const existing = bySeverity.get(finding.severity) ?? [];
    existing.push(finding);
    bySeverity.set(finding.severity, existing);
  }

  const criticalCount = bySeverity.get(Severity.Critical)?.length ?? 0;
  const highCount = bySeverity.get(Severity.High)?.length ?? 0;
  const mediumCount = bySeverity.get(Severity.Medium)?.length ?? 0;

  // ═══ SHIP VERDICT ═══
  // NOT READY only when CRITICAL findings exist
  // REVIEW when HIGH or MEDIUM findings exist (no CRITICAL)
  // PASS otherwise (only LOW/INFO, or no findings)
  if (criticalCount > 0) {
    lines.push(c.red.bold('═'.repeat(60)));
    lines.push(c.red.bold(`  ❌  NOT READY — ${criticalCount} critical issue(s) found${suppressedSuffix}`));
    lines.push(c.red.bold('═'.repeat(60)));
  } else if (highCount > 0 || mediumCount > 0) {
    lines.push(c.yellow.bold('═'.repeat(60)));
    lines.push(c.yellow.bold(`  ⚠️  REVIEW — ${result.findings.length} issue(s) found (no critical)${suppressedSuffix}`));
    lines.push(c.yellow.bold('═'.repeat(60)));
  } else {
    lines.push(c.green.bold('═'.repeat(60)));
    lines.push(c.green.bold(`  ✅  PASS — 0 critical issues. Your app looks ready for review.${suppressedSuffix}`));
    lines.push(c.green.bold('═'.repeat(60)));
    if (result.findings.length === 0) {
      lines.push('');
      return lines.join('\n');
    }
  }
  lines.push('');
  
  // Summary by severity
  lines.push(c.bold('📊 Summary:'));
  const severityOrder = [Severity.Critical, Severity.High, Severity.Medium, Severity.Low, Severity.Info];
  for (const severity of severityOrder) {
    const count = bySeverity.get(severity)?.length ?? 0;
    if (count > 0) {
      const color = getSeverityColor(severity);
      lines.push(`   ${color(`${severity.toUpperCase()}`)}: ${count}`);
    }
  }
  lines.push('');

  // Scanner breakdown
  const byScanner = new Map<string, Finding[]>();
  for (const finding of result.findings) {
    const scanner = getScannerFromRuleId(finding.ruleId);
    const existing = byScanner.get(scanner) ?? [];
    existing.push(finding);
    byScanner.set(scanner, existing);
  }

  lines.push(c.bold('🔧 Scanner Breakdown:'));
  for (const [scanner, findings] of byScanner.entries()) {
    const critCount = findings.filter(f => f.severity === Severity.Critical || f.severity === Severity.High).length;
    const tag = critCount > 0 ? c.red(`(${critCount} critical/high)`) : c.green('(clean)');
    lines.push(`   ${scanner}: ${findings.length} finding(s) ${tag}`);
  }
  lines.push('');
  
  // Findings grouped by severity
  const sortedFindings = [...result.findings].sort((a, b) => {
    return SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
  });

  let currentSeverity: Severity | null = null;
  let findingIndex = 0;

  for (const finding of sortedFindings) {
    if (finding.severity !== currentSeverity) {
      currentSeverity = finding.severity;
      const color = getSeverityColor(currentSeverity);
      const count = bySeverity.get(currentSeverity)?.length ?? 0;
      lines.push('');
      lines.push(color(`${'─'.repeat(60)}`));
      lines.push(color(`  ${currentSeverity.toUpperCase()} (${count})`));
      lines.push(color(`${'─'.repeat(60)}`));
      lines.push('');
    }

    const formattedFinding = await formatFinding(finding, findingIndex);
    lines.push(formattedFinding);
    lines.push('');
    findingIndex++;
  }
  
  return lines.join('\n');
}
