import * as core from '@actions/core';
import * as path from 'path';
import * as fs from 'fs';
import { scan, format, OutputFormat, Severity, type Finding, type ScanResult } from 'reviewshield';

/**
 * Severity mapping for GitHub annotations
 */
function severityToAnnotationLevel(severity: Severity): 'error' | 'warning' | 'notice' {
  switch (severity) {
    case Severity.Critical:
    case Severity.High:
      return 'error';
    case Severity.Medium:
      return 'warning';
    case Severity.Low:
    case Severity.Info:
    default:
      return 'notice';
  }
}

/**
 * Create GitHub annotations from findings
 */
function createAnnotations(findings: Finding[], basePath: string): void {
  for (const finding of findings) {
    const level = severityToAnnotationLevel(finding.severity);
    const file = finding.location ? path.relative(basePath, finding.location) : undefined;
    
    const message = [
      `[${finding.ruleId}] ${finding.title}`,
      finding.description,
      finding.fixGuidance ? `💡 ${finding.fixGuidance}` : '',
      finding.documentationURL ? `📖 ${finding.documentationURL}` : '',
    ].filter(Boolean).join('\n');
    
    const properties: core.AnnotationProperties = {
      title: `ReviewShield: ${finding.ruleId}`,
      file,
    };
    
    switch (level) {
      case 'error':
        core.error(message, properties);
        break;
      case 'warning':
        core.warning(message, properties);
        break;
      case 'notice':
        core.notice(message, properties);
        break;
    }
  }
}

/**
 * Write SARIF output for GitHub Security tab
 */
async function writeSarifOutput(result: ScanResult, outputPath: string): Promise<string> {
  const sarifContent = await format(result, OutputFormat.SARIF);
  fs.writeFileSync(outputPath, sarifContent, 'utf-8');
  return outputPath;
}

/**
 * Main action entry point
 */
async function run(): Promise<void> {
  try {
    // Get inputs
    const scanPath = core.getInput('path') || '.';
    const outputFormat = core.getInput('format') || 'text';
    const failOnError = core.getBooleanInput('fail-on-error');
    const rulesInput = core.getInput('rules');
    const excludeInput = core.getInput('exclude');
    
    // Resolve absolute path
    const workspacePath = process.env.GITHUB_WORKSPACE || process.cwd();
    const absolutePath = path.resolve(workspacePath, scanPath);
    
    // Parse rule filters
    const rules = rulesInput ? rulesInput.split(',').map(r => r.trim()).filter(Boolean) : undefined;
    const exclude = excludeInput ? excludeInput.split(',').map(r => r.trim()).filter(Boolean) : undefined;
    
    core.info(`🛡️ ReviewShield - Scanning for App Store Review issues`);
    core.info(`📁 Path: ${absolutePath}`);
    if (rules?.length) {
      core.info(`🎯 Rules: ${rules.join(', ')}`);
    }
    if (exclude?.length) {
      core.info(`🚫 Excluding: ${exclude.join(', ')}`);
    }
    
    // Run scan
    const result = await scan({
      path: absolutePath,
      rules,
      exclude,
    });
    
    core.info(`✅ Scanned with ${result.rulesRun.length} rules in ${result.duration}ms`);
    
    // Set outputs
    core.setOutput('findings-count', result.findings.length);
    core.setOutput('exit-code', result.findings.length > 0 ? 1 : 0);
    
    // Create annotations for each finding
    createAnnotations(result.findings, workspacePath);
    
    // Handle output format
    if (outputFormat === 'sarif') {
      const sarifPath = path.join(workspacePath, 'reviewshield-results.sarif');
      await writeSarifOutput(result, sarifPath);
      core.setOutput('sarif-file', sarifPath);
      core.info(`📄 SARIF output written to: ${sarifPath}`);
      
      // Log instructions for GitHub Security tab
      core.info('');
      core.info('💡 To see results in the Security tab, add this step after ReviewShield:');
      core.info('   - uses: github/codeql-action/upload-sarif@v3');
      core.info('     with:');
      core.info('       sarif_file: reviewshield-results.sarif');
    } else {
      // Print formatted output
      const formatType = outputFormat === 'json' ? OutputFormat.JSON : OutputFormat.Text;
      const formattedOutput = await format(result, formatType);
      core.info('');
      core.info(formattedOutput);
    }
    
    // Summary
    core.info('');
    if (result.findings.length === 0) {
      core.info('🎉 No App Store Review issues found!');
    } else {
      const byLevel = {
        critical: result.findings.filter(f => f.severity === Severity.Critical).length,
        high: result.findings.filter(f => f.severity === Severity.High).length,
        medium: result.findings.filter(f => f.severity === Severity.Medium).length,
        low: result.findings.filter(f => f.severity === Severity.Low).length,
      };
      
      core.info(`⚠️ Found ${result.findings.length} issue(s):`);
      if (byLevel.critical > 0) core.info(`   🔴 Critical: ${byLevel.critical}`);
      if (byLevel.high > 0) core.info(`   🟠 High: ${byLevel.high}`);
      if (byLevel.medium > 0) core.info(`   🟡 Medium: ${byLevel.medium}`);
      if (byLevel.low > 0) core.info(`   🟢 Low: ${byLevel.low}`);
      
      // Create job summary
      await core.summary
        .addHeading('ReviewShield Scan Results', 2)
        .addTable([
          [{ data: 'Severity', header: true }, { data: 'Count', header: true }],
          ['🔴 Critical', String(byLevel.critical)],
          ['🟠 High', String(byLevel.high)],
          ['🟡 Medium', String(byLevel.medium)],
          ['🟢 Low', String(byLevel.low)],
          ['**Total**', `**${result.findings.length}**`],
        ])
        .addHeading('Findings', 3)
        .addList(result.findings.map(f => 
          `**[${f.ruleId}]** ${f.title}${f.location ? ` (${path.relative(workspacePath, f.location)})` : ''}`
        ))
        .write();
      
      if (failOnError) {
        core.setFailed(`ReviewShield found ${result.findings.length} issue(s)`);
      }
    }
    
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(`ReviewShield failed: ${error.message}`);
    } else {
      core.setFailed('ReviewShield failed with an unknown error');
    }
  }
}

run();
