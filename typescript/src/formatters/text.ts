/**
 * Text formatter for human-readable output
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
 * Format scan results as text
 */
export async function formatText(result: ScanResult): Promise<string> {
  const c = await getChalk();
  const lines: string[] = [];
  
  // Header
  lines.push(c.bold.underline('\n🛡️  ShipLint Scan Results\n'));
  lines.push(`📁 Project: ${result.projectPath}`);
  lines.push(`🕐 Scanned: ${result.timestamp.toISOString()}`);
  lines.push(`⏱️  Duration: ${result.duration}ms`);
  lines.push(`📊 Rules run: ${result.rulesRun.length}`);
  lines.push('');
  
  if (result.findings.length === 0) {
    lines.push(c.green.bold('✅ No issues found! Your app looks ready for review.'));
    lines.push('');
    return lines.join('\n');
  }
  
  // Summary by severity
  const bySeverity = new Map<Severity, Finding[]>();
  for (const finding of result.findings) {
    const existing = bySeverity.get(finding.severity) ?? [];
    existing.push(finding);
    bySeverity.set(finding.severity, existing);
  }
  
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
  
  // Findings
  lines.push(c.bold.underline(`\n🔍 Found ${result.findings.length} issue(s):\n`));
  
  // Sort by severity
  const sortedFindings = [...result.findings].sort((a, b) => {
    const order = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
    return order[a.severity] - order[b.severity];
  });
  
  for (let i = 0; i < sortedFindings.length; i++) {
    const formattedFinding = await formatFinding(sortedFindings[i], i);
    lines.push(formattedFinding);
    lines.push('');
    lines.push(c.dim('   ' + '─'.repeat(60)));
    lines.push('');
  }
  
  return lines.join('\n');
}
