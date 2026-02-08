/**
 * ShipLint Analytics - Pieter Levels style
 * 
 * Simple, anonymous, fire-and-forget telemetry.
 * - No personal data
 * - No project names
 * - Just aggregate counts for public stats
 * 
 * Opt-out: Set SHIPLINT_NO_TELEMETRY=1
 */

const ANALYTICS_ENDPOINT = 'https://shiplint.app/api/ping';

export type ProjectType = 'xcodeproj' | 'swiftpm' | 'both' | 'unknown';
export type FrameworkDetectionMethod = 'pbxproj' | 'import-scan' | 'both';
export type ScanMode = 'cli' | 'mcp';

export interface AnalyticsPayload {
  v: string;           // CLI version
  findings: number;    // Total findings count
  errors: number;      // Error count
  warnings: number;    // Warning count
  rules: string[];     // Rule IDs that triggered (no details)
  ts: number;          // Timestamp
  // Enhanced telemetry fields
  projectType: ProjectType;
  frameworkDetectionMethod: FrameworkDetectionMethod;
  frameworksDetected: string[];
  targetCount: number;
  scanMode: ScanMode;
  findingsByRule: Record<string, number>;
  totalFindings: number;
  scanDurationMs: number;
}

/**
 * Context for building enhanced analytics payload
 */
export interface AnalyticsContext {
  version: string;
  findings: Array<{ severity: string; ruleId: string }>;
  scanDurationMs: number;
  scanMode: ScanMode;
  projectType: ProjectType;
  frameworkDetectionMethod: FrameworkDetectionMethod;
  frameworksDetected: string[];
  targetCount: number;
}

/**
 * Send anonymous analytics ping (fire-and-forget)
 * Non-blocking, silent failures
 */
export async function ping(payload: AnalyticsPayload): Promise<void> {
  // Check opt-out
  if (process.env.SHIPLINT_NO_TELEMETRY === '1') {
    return;
  }

  try {
    // Fire and forget - don't await, don't block
    fetch(ANALYTICS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {
      // Silent fail - analytics should never break the tool
    });
  } catch {
    // Silent fail
  }
}

/**
 * Build payload from scan results (legacy compat - defaults to cli mode with minimal context)
 */
export function buildPayload(
  version: string,
  findings: Array<{ severity: string; ruleId: string }>
): AnalyticsPayload {
  return buildEnhancedPayload({
    version,
    findings,
    scanDurationMs: 0,
    scanMode: 'cli',
    projectType: 'unknown',
    frameworkDetectionMethod: 'import-scan',
    frameworksDetected: [],
    targetCount: 0,
  });
}

/**
 * Build enhanced payload with full telemetry context
 */
export function buildEnhancedPayload(ctx: AnalyticsContext): AnalyticsPayload {
  const { findings } = ctx;
  const errors = findings.filter(f => f.severity === 'error' || f.severity === 'critical').length;
  const warnings = findings.filter(f => f.severity === 'warning').length;
  const rules = [...new Set(findings.map(f => f.ruleId))];

  // Build findingsByRule breakdown
  const findingsByRule: Record<string, number> = {};
  for (const f of findings) {
    findingsByRule[f.ruleId] = (findingsByRule[f.ruleId] || 0) + 1;
  }

  return {
    v: ctx.version,
    findings: findings.length,
    errors,
    warnings,
    rules,
    ts: Date.now(),
    projectType: ctx.projectType,
    frameworkDetectionMethod: ctx.frameworkDetectionMethod,
    frameworksDetected: ctx.frameworksDetected,
    targetCount: ctx.targetCount,
    scanMode: ctx.scanMode,
    findingsByRule,
    totalFindings: findings.length,
    scanDurationMs: ctx.scanDurationMs,
  };
}
