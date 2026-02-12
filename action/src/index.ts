import * as core from '@actions/core';
import * as github from '@actions/github';
import * as path from 'path';
import * as fs from 'fs';
import { scan, format, OutputFormat, Severity, type Finding, type ScanResult } from 'shiplint';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SEVERITY_ORDER: Record<string, number> = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  info: 1,
};

function severityRank(s: Severity | string): number {
  return SEVERITY_ORDER[String(s).toLowerCase()] ?? 0;
}

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

function severityEmoji(s: Severity): string {
  switch (s) {
    case Severity.Critical: return '🔴';
    case Severity.High: return '🟠';
    case Severity.Medium: return '🟡';
    case Severity.Low: return '🟢';
    default: return 'ℹ️';
  }
}

// ---------------------------------------------------------------------------
// Auto-detect Xcode project
// ---------------------------------------------------------------------------

function autoDetectProjectPath(basePath: string): string {
  // Look for .xcworkspace first (preferred), then .xcodeproj
  const entries = fs.readdirSync(basePath, { withFileTypes: true });

  for (const ext of ['.xcworkspace', '.xcodeproj']) {
    const match = entries.find(e => e.name.endsWith(ext) && !e.name.startsWith('.'));
    if (match) {
      core.info(`🔍 Auto-detected project: ${match.name}`);
      return path.join(basePath, match.name);
    }
  }

  // Recurse one level
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const sub = path.join(basePath, entry.name);
    try {
      const subEntries = fs.readdirSync(sub);
      for (const ext of ['.xcworkspace', '.xcodeproj']) {
        const match = subEntries.find(n => n.endsWith(ext) && !n.startsWith('.'));
        if (match) {
          core.info(`🔍 Auto-detected project: ${entry.name}/${match}`);
          return path.join(sub, match);
        }
      }
    } catch { /* skip unreadable dirs */ }
  }

  // Fall back to basePath — let shiplint decide
  core.info('🔍 No Xcode project found; scanning entire directory');
  return basePath;
}

// ---------------------------------------------------------------------------
// Annotations
// ---------------------------------------------------------------------------

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

    const properties: core.AnnotationProperties = { title: `ShipLint: ${finding.ruleId}`, file };

    switch (level) {
      case 'error': core.error(message, properties); break;
      case 'warning': core.warning(message, properties); break;
      case 'notice': core.notice(message, properties); break;
    }
  }
}

// ---------------------------------------------------------------------------
// PR Comment
// ---------------------------------------------------------------------------

const COMMENT_MARKER = '<!-- shiplint-scan-results -->';

function buildCommentBody(result: ScanResult, workspacePath: string, threshold: string): string {
  const lines: string[] = [COMMENT_MARKER];

  if (result.findings.length === 0) {
    lines.push('## 🛡️ ShipLint — All Clear! ✅');
    lines.push('');
    lines.push(`Scanned with **${result.rulesRun.length}** rules in ${result.duration}ms. No App Store Review issues found.`);
    return lines.join('\n');
  }

  const bySeverity = (s: Severity) => result.findings.filter(f => f.severity === s);
  const critical = bySeverity(Severity.Critical);
  const high = bySeverity(Severity.High);
  const medium = bySeverity(Severity.Medium);
  const low = bySeverity(Severity.Low);

  const failing = result.findings.filter(f => severityRank(f.severity) >= severityRank(threshold as any));
  const status = failing.length > 0 ? '❌ Issues Found' : '⚠️ Warnings';

  lines.push(`## 🛡️ ShipLint — ${status}`);
  lines.push('');
  lines.push(`| Severity | Count |`);
  lines.push(`|----------|-------|`);
  if (critical.length) lines.push(`| 🔴 Critical | ${critical.length} |`);
  if (high.length) lines.push(`| 🟠 High | ${high.length} |`);
  if (medium.length) lines.push(`| 🟡 Medium | ${medium.length} |`);
  if (low.length) lines.push(`| 🟢 Low | ${low.length} |`);
  lines.push('');

  // Details per finding (collapse if many)
  if (result.findings.length > 5) {
    lines.push('<details><summary>Show all findings</summary>');
    lines.push('');
  }

  for (const f of result.findings) {
    const loc = f.location ? ` \`${path.relative(workspacePath, f.location)}\`` : '';
    lines.push(`### ${severityEmoji(f.severity)} ${f.ruleId} — ${f.title}${loc}`);
    lines.push('');
    lines.push(f.description);
    if (f.fixGuidance) {
      lines.push('');
      lines.push(`> 💡 **Fix:** ${f.fixGuidance}`);
    }
    lines.push('');
  }

  if (result.findings.length > 5) {
    lines.push('</details>');
  }

  lines.push(`---`);
  lines.push(`*Scanned with ${result.rulesRun.length} rules in ${result.duration}ms · Threshold: **${threshold}***`);

  return lines.join('\n');
}

async function postOrUpdateComment(token: string, body: string): Promise<void> {
  const context = github.context;
  if (!context.payload.pull_request) {
    core.info('ℹ️ Not a pull request — skipping comment');
    return;
  }

  const octokit = github.getOctokit(token);
  const { owner, repo } = context.repo;
  const prNumber = context.payload.pull_request.number;

  // Find existing comment
  const { data: comments } = await octokit.rest.issues.listComments({
    owner, repo, issue_number: prNumber, per_page: 100,
  });
  const existing = comments.find(c => c.body?.includes(COMMENT_MARKER));

  if (existing) {
    await octokit.rest.issues.updateComment({ owner, repo, comment_id: existing.id, body });
    core.info(`💬 Updated existing PR comment #${existing.id}`);
  } else {
    await octokit.rest.issues.createComment({ owner, repo, issue_number: prNumber, body });
    core.info(`💬 Posted new PR comment on #${prNumber}`);
  }
}

// ---------------------------------------------------------------------------
// SARIF
// ---------------------------------------------------------------------------

async function writeSarifOutput(result: ScanResult, outputPath: string): Promise<string> {
  const sarifContent = await format(result, OutputFormat.SARIF);
  fs.writeFileSync(outputPath, sarifContent, 'utf-8');
  return outputPath;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function run(): Promise<void> {
  try {
    // Inputs
    const inputPath = core.getInput('path') || '';
    const projectPath = core.getInput('project-path') || '';
    const outputFormat = core.getInput('format') || 'text';
    const severityThreshold = core.getInput('severity-threshold') || 'critical';
    const shouldComment = core.getInput('comment') !== 'false';
    const failOnError = core.getBooleanInput('fail-on-error');
    const rulesInput = core.getInput('rules');
    const excludeInput = core.getInput('exclude');
    const githubToken = core.getInput('github-token');

    const workspacePath = process.env.GITHUB_WORKSPACE || process.cwd();

    // Resolve scan path
    let scanTarget: string;
    if (projectPath) {
      scanTarget = path.resolve(workspacePath, projectPath);
    } else if (inputPath) {
      scanTarget = path.resolve(workspacePath, inputPath);
    } else {
      scanTarget = autoDetectProjectPath(workspacePath);
    }

    // Parse rule filters
    const rules = rulesInput ? rulesInput.split(',').map(r => r.trim()).filter(Boolean) : undefined;
    const exclude = excludeInput ? excludeInput.split(',').map(r => r.trim()).filter(Boolean) : undefined;

    core.info('🛡️ ShipLint Pro — Scanning for App Store Review issues');
    core.info(`📁 Target: ${scanTarget}`);
    core.info(`🎚️ Severity threshold: ${severityThreshold}`);
    if (rules?.length) core.info(`🎯 Rules: ${rules.join(', ')}`);
    if (exclude?.length) core.info(`🚫 Excluding: ${exclude.join(', ')}`);

    // Run scan
    const result = await scan({ path: scanTarget, rules, exclude });

    core.info(`✅ Scanned with ${result.rulesRun.length} rules in ${result.duration}ms`);

    // Outputs
    core.setOutput('findings-count', result.findings.length);
    core.setOutput('exit-code', result.findings.length > 0 ? 1 : 0);

    // Annotations
    createAnnotations(result.findings, workspacePath);

    // SARIF
    if (outputFormat === 'sarif') {
      const sarifPath = path.join(workspacePath, 'shiplint-results.sarif');
      await writeSarifOutput(result, sarifPath);
      core.setOutput('sarif-file', sarifPath);
      core.info(`📄 SARIF output: ${sarifPath}`);
    } else {
      const formatType = outputFormat === 'json' ? OutputFormat.JSON : OutputFormat.Text;
      const formattedOutput = await format(result, formatType);
      core.info('');
      core.info(formattedOutput);
    }

    // PR Comment
    if (shouldComment && githubToken) {
      try {
        const body = buildCommentBody(result, workspacePath, severityThreshold);
        await postOrUpdateComment(githubToken, body);
      } catch (err) {
        core.warning(`Failed to post PR comment: ${err instanceof Error ? err.message : err}`);
      }
    }

    // Job Summary
    if (result.findings.length > 0) {
      const bySev = (s: Severity) => result.findings.filter(f => f.severity === s).length;
      await core.summary
        .addHeading('ShipLint Scan Results', 2)
        .addTable([
          [{ data: 'Severity', header: true }, { data: 'Count', header: true }],
          ['🔴 Critical', String(bySev(Severity.Critical))],
          ['🟠 High', String(bySev(Severity.High))],
          ['🟡 Medium', String(bySev(Severity.Medium))],
          ['🟢 Low', String(bySev(Severity.Low))],
          ['**Total**', `**${result.findings.length}**`],
        ])
        .addHeading('Findings', 3)
        .addList(result.findings.map(f =>
          `**[${f.ruleId}]** ${f.title}${f.location ? ` (${path.relative(workspacePath, f.location)})` : ''}`
        ))
        .write();
    }

    // Summary & fail decision
    core.info('');
    if (result.findings.length === 0) {
      core.info('🎉 No App Store Review issues found!');
    } else {
      const failing = result.findings.filter(f => severityRank(f.severity) >= severityRank(severityThreshold as any));
      core.info(`⚠️ Found ${result.findings.length} issue(s), ${failing.length} at or above threshold (${severityThreshold})`);

      if (failOnError && failing.length > 0) {
        core.setFailed(`ShipLint found ${failing.length} issue(s) at or above ${severityThreshold} severity`);
      }
    }

  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(`ShipLint failed: ${error.message}`);
    } else {
      core.setFailed('ShipLint failed with an unknown error');
    }
  }
}

run();
