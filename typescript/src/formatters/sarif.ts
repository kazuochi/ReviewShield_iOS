/**
 * SARIF formatter for CI/CD integration
 * 
 * SARIF (Static Analysis Results Interchange Format) is a standard format
 * for static analysis tools. It's supported by GitHub, Azure DevOps, and others.
 * 
 * @see https://sarifweb.azurewebsites.net/
 */
import type { ScanResult, Finding } from '../types/index.js';
import { Severity } from '../types/index.js';
import packageJson from '../../package.json';

/**
 * SARIF schema version
 */
const SARIF_VERSION = '2.1.0';
const SARIF_SCHEMA = 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json';

/**
 * Convert severity to SARIF level
 */
function toSarifLevel(severity: Severity): 'error' | 'warning' | 'note' | 'none' {
  switch (severity) {
    case Severity.Critical:
    case Severity.High:
      return 'error';
    case Severity.Medium:
      return 'warning';
    case Severity.Low:
    case Severity.Info:
      return 'note';
  }
}

/**
 * Convert finding to SARIF result
 */
function toSarifResult(finding: Finding) {
  const result: Record<string, unknown> = {
    ruleId: finding.ruleId,
    level: toSarifLevel(finding.severity),
    message: {
      text: finding.description,
    },
    properties: {
      confidence: finding.confidence,
      guideline: finding.guideline,
      fixGuidance: finding.fixGuidance,
    },
  };
  
  if (finding.location) {
    result.locations = [
      {
        physicalLocation: {
          artifactLocation: {
            uri: finding.location,
          },
        },
      },
    ];
  }
  
  return result;
}

/**
 * Build SARIF rules array from findings
 */
function buildRules(findings: Finding[]) {
  const ruleMap = new Map<string, Finding>();
  
  for (const finding of findings) {
    if (!ruleMap.has(finding.ruleId)) {
      ruleMap.set(finding.ruleId, finding);
    }
  }
  
  return Array.from(ruleMap.values()).map(finding => ({
    id: finding.ruleId,
    name: finding.title,
    shortDescription: {
      text: finding.title,
    },
    fullDescription: {
      text: finding.description,
    },
    helpUri: finding.documentationURL,
    properties: {
      guideline: finding.guideline,
    },
  }));
}

/**
 * Format scan results as SARIF
 */
export function formatSARIF(result: ScanResult): string {
  const sarif = {
    $schema: SARIF_SCHEMA,
    version: SARIF_VERSION,
    runs: [
      {
        tool: {
          driver: {
            name: 'ShipLint',
            version: packageJson.version,
            informationUri: 'https://github.com/Signal26AI/ShipLint',
            rules: buildRules(result.findings),
          },
        },
        results: result.findings.map(toSarifResult),
        invocations: [
          {
            executionSuccessful: true,
            endTimeUtc: result.timestamp.toISOString(),
          },
        ],
      },
    ],
  };
  
  return JSON.stringify(sarif, null, 2);
}
