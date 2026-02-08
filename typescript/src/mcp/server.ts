/**
 * ShipLint MCP Server
 * 
 * Exposes ShipLint functionality via the Model Context Protocol (MCP).
 * Use with stdio transport for IDE integration (Cursor, Windsurf, etc.)
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { scan, InvalidRulesError, NoRulesError } from '../core/scanner.js';
import { allRules, getRule } from '../rules/index.js';
import { Severity } from '../types/index.js';
import { ping, buildEnhancedPayload } from '../cli/analytics.js';
import { evaluatePurposeString, getContextualSuggestion } from './sampling.js';
import packageJson from '../../package.json';

/** Rule IDs that relate to purpose strings */
const PURPOSE_STRING_RULE_IDS = [
  'privacy-001-missing-camera-purpose',
  'privacy-002-missing-photo-library-purpose',
  'privacy-003-missing-location-purpose',
  'privacy-004-missing-microphone-purpose',
  'privacy-005-missing-contacts-purpose',
  'privacy-007-missing-bluetooth-purpose',
  'privacy-008-missing-face-id-purpose',
];

/** Map rule IDs to permission names for prompts */
const RULE_PERMISSION_MAP: Record<string, string> = {
  'privacy-001-missing-camera-purpose': 'Camera (NSCameraUsageDescription)',
  'privacy-002-missing-photo-library-purpose': 'Photo Library (NSPhotoLibraryUsageDescription)',
  'privacy-003-missing-location-purpose': 'Location (NSLocationWhenInUseUsageDescription)',
  'privacy-004-missing-microphone-purpose': 'Microphone (NSMicrophoneUsageDescription)',
  'privacy-005-missing-contacts-purpose': 'Contacts (NSContactsUsageDescription)',
  'privacy-007-missing-bluetooth-purpose': 'Bluetooth (NSBluetoothAlwaysUsageDescription)',
  'privacy-008-missing-face-id-purpose': 'Face ID (NSFaceIDUsageDescription)',
};

/**
 * Create and configure the MCP server
 */
export function createMcpServer(): McpServer {
  const server = new McpServer(
    {
      name: 'shiplint',
      version: packageJson.version,
    },
    {
      capabilities: {
        tools: {},
      },
      instructions: 'ShipLint is an App Store Review Guideline scanner for iOS projects. ' +
        'Use shiplint_scan to check a project for potential rejection issues, ' +
        'shiplint_rules to list available rules, and shiplint_explain for detailed fix guidance.',
    }
  );

  // Tool: shiplint_scan
  // Scan a project path and return findings
  server.registerTool(
    'shiplint_scan',
    {
      description: 'Scan an iOS/Xcode project for potential App Store Review issues. ' +
        'Returns findings with severity, descriptions, and fix guidance.',
      inputSchema: {
        path: z.string().describe('Path to Xcode project, workspace, or directory to scan'),
        rules: z.array(z.string()).optional().describe('Only run specific rules (by ID). If omitted, runs all rules.'),
        exclude: z.array(z.string()).optional().describe('Exclude specific rules (by ID)'),
      },
      outputSchema: {
        findings: z.array(z.object({
          ruleId: z.string(),
          severity: z.enum(['critical', 'high', 'medium', 'low', 'info']),
          confidence: z.enum(['high', 'medium', 'low']),
          title: z.string(),
          description: z.string(),
          location: z.string().optional(),
          guideline: z.string(),
          fixGuidance: z.string(),
          documentationURL: z.string().optional(),
        })),
        summary: z.object({
          total: z.number(),
          critical: z.number(),
          high: z.number(),
          medium: z.number(),
          low: z.number(),
          info: z.number(),
          rulesRun: z.number(),
          durationMs: z.number(),
        }),
      },
    },
    async ({ path, rules, exclude }) => {
      try {
        const result = await scan({
          path,
          rules,
          exclude,
        });

        // Compute summary
        const summary = {
          total: result.findings.length,
          critical: result.findings.filter(f => f.severity === Severity.Critical).length,
          high: result.findings.filter(f => f.severity === Severity.High).length,
          medium: result.findings.filter(f => f.severity === Severity.Medium).length,
          low: result.findings.filter(f => f.severity === Severity.Low).length,
          info: result.findings.filter(f => f.severity === Severity.Info).length,
          rulesRun: result.rulesRun.length,
          durationMs: result.duration,
        };

        // Anonymous analytics ping (fire-and-forget)
        ping(buildEnhancedPayload({
          version: packageJson.version,
          findings: result.findings,
          scanDurationMs: result.duration,
          scanMode: 'mcp',
          projectType: result.projectType,
          frameworkDetectionMethod: result.frameworkDetectionMethod,
          frameworksDetected: result.frameworksDetected,
          targetCount: result.targetCount,
        }));

        // Attempt AI-powered purpose string evaluation via MCP sampling
        const aiEvaluations: Record<string, { evaluation: string; suggestedString?: string }> = {};
        const purposeFindings = result.findings.filter(f => PURPOSE_STRING_RULE_IDS.includes(f.ruleId));

        if (purposeFindings.length > 0) {
          for (const finding of purposeFindings) {
            // Extract quoted purpose string from description (placeholder/empty cases)
            const quotedMatch = finding.description.match(/placeholder text: "([^"]+)"/);
            if (!quotedMatch) continue;

            const purposeString = quotedMatch[1];
            const permission = RULE_PERMISSION_MAP[finding.ruleId] || finding.ruleId;

            try {
              const evalResult = await evaluatePurposeString(server.server, {
                permission,
                purposeString,
                detectedFrameworks: result.frameworksDetected,
                ruleId: finding.ruleId,
              });

              if (evalResult) {
                aiEvaluations[finding.ruleId] = {
                  evaluation: evalResult.evaluation,
                  suggestedString: evalResult.suggestedString,
                };
              }
            } catch {
              // Sampling failed for this finding — skip silently
            }
          }
        }

        // Merge AI evaluations into findings
        const enhancedFindings = result.findings.map(f => {
          const ai = aiEvaluations[f.ruleId];
          if (!ai) return f;
          return {
            ...f,
            aiEvaluation: ai.evaluation,
            aiSuggestedString: ai.suggestedString,
          };
        });

        const structuredContent = {
          findings: enhancedFindings,
          summary,
        };

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(structuredContent, null, 2),
            },
          ],
          structuredContent,
        };
      } catch (error) {
        if (error instanceof InvalidRulesError) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `Invalid rule IDs: ${error.unknownIds.join(', ')}\n\nAvailable rules: ${error.availableIds.join(', ')}`,
              },
            ],
            isError: true,
          };
        }
        if (error instanceof NoRulesError) {
          return {
            content: [
              {
                type: 'text' as const,
                text: error.message,
              },
            ],
            isError: true,
          };
        }
        throw error;
      }
    }
  );

  // Tool: shiplint_rules
  // List all available rules
  server.registerTool(
    'shiplint_rules',
    {
      description: 'List all available ShipLint rules with their IDs, categories, and severities.',
      outputSchema: {
        rules: z.array(z.object({
          id: z.string(),
          name: z.string(),
          category: z.string(),
          severity: z.enum(['critical', 'high', 'medium', 'low', 'info']),
          guideline: z.string(),
        })),
      },
    },
    async () => {
      const rules = allRules.map(rule => ({
        id: rule.id,
        name: rule.name,
        category: rule.category,
        severity: rule.severity,
        guideline: rule.guidelineReference,
      }));

      const structuredContent = { rules };

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(structuredContent, null, 2),
          },
        ],
        structuredContent,
      };
    }
  );

  // Tool: shiplint_explain
  // Get detailed explanation and fix guidance for a specific rule
  server.registerTool(
    'shiplint_explain',
    {
      description: 'Get detailed explanation and fix guidance for a specific ShipLint rule.',
      inputSchema: {
        ruleId: z.string().describe('The rule ID to explain (e.g., "privacy-001-missing-camera-purpose")'),
      },
      outputSchema: {
        id: z.string(),
        name: z.string(),
        description: z.string(),
        category: z.string(),
        severity: z.enum(['critical', 'high', 'medium', 'low', 'info']),
        confidence: z.enum(['high', 'medium', 'low']),
        guideline: z.string(),
        guidelineUrl: z.string(),
      },
    },
    async ({ ruleId }) => {
      const rule = getRule(ruleId);

      if (!rule) {
        const availableIds = allRules.map(r => r.id);
        return {
          content: [
            {
              type: 'text' as const,
              text: `Unknown rule ID: ${ruleId}\n\nAvailable rules:\n${availableIds.map(id => `  - ${id}`).join('\n')}`,
            },
          ],
          isError: true,
        };
      }

      // Extract guideline number for Apple URL
      const guidelineNumber = rule.guidelineReference.replace(/[^0-9.]/g, '');
      const guidelineUrl = `https://developer.apple.com/app-store/review/guidelines/#${guidelineNumber.split('.')[0]}`;

      // Attempt AI-powered contextual suggestion for purpose string rules
      let aiContextualSuggestion: string | undefined;
      if (PURPOSE_STRING_RULE_IDS.includes(ruleId)) {
        try {
          const suggestion = await getContextualSuggestion(
            server.server,
            ruleId,
            [], // No frameworks context in explain — best effort
          );
          if (suggestion) {
            aiContextualSuggestion = suggestion;
          }
        } catch {
          // Sampling not supported — skip silently
        }
      }

      const structuredContent: Record<string, unknown> = {
        id: rule.id,
        name: rule.name,
        description: rule.description,
        category: rule.category,
        severity: rule.severity,
        confidence: rule.confidence,
        guideline: rule.guidelineReference,
        guidelineUrl,
      };

      if (aiContextualSuggestion) {
        structuredContent.aiContextualSuggestion = aiContextualSuggestion;
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(structuredContent, null, 2),
          },
        ],
        structuredContent,
      };
    }
  );

  return server;
}

/**
 * Start the MCP server with stdio transport
 */
export async function startMcpServer(): Promise<void> {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  
  await server.connect(transport);
  
  // Log to stderr so it doesn't interfere with MCP protocol on stdout
  console.error(`ShipLint MCP server v${packageJson.version} running on stdio`);
}
