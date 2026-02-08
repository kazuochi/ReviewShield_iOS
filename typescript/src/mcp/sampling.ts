/**
 * MCP Sampling Integration
 * 
 * Uses the MCP sampling primitive to request AI-powered evaluation
 * of purpose strings from the host LLM. Gracefully falls back if
 * sampling is not supported by the client.
 */
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import type { CreateMessageResult } from '@modelcontextprotocol/sdk/types.js';

export interface PurposeStringEvaluation {
  permission: string;
  currentString: string;
  isAdequate: boolean;
  evaluation: string;
  suggestedString?: string;
}

export interface SamplingOptions {
  permission: string;
  purposeString: string;
  detectedFrameworks: string[];
  ruleId: string;
}

/**
 * Check if sampling is likely supported by attempting a createMessage call.
 * Caches the result per server instance.
 */
const samplingSupported = new WeakMap<Server, boolean | null>();

/**
 * Build the evaluation prompt for a purpose string
 */
function buildEvaluationPrompt(opts: SamplingOptions): string {
  const frameworks = opts.detectedFrameworks.length > 0
    ? opts.detectedFrameworks.join(', ')
    : 'unknown frameworks';

  return (
    `You are reviewing iOS App Store purpose strings (NSUsageDescription values). ` +
    `Given this app uses [${frameworks}], evaluate this purpose string for ${opts.permission}: ` +
    `'${opts.purposeString}'. ` +
    `Is it specific enough for App Store review? Rate as ADEQUATE or INADEQUATE. ` +
    `If inadequate, suggest a better one. ` +
    `Reply in this exact format:\n` +
    `VERDICT: ADEQUATE or INADEQUATE\n` +
    `EVALUATION: <one sentence explanation>\n` +
    `SUGGESTION: <suggested string if inadequate, or "none">`
  );
}

/**
 * Build the explanation prompt for a rule
 */
function buildExplainPrompt(ruleId: string, detectedFrameworks: string[]): string {
  const frameworks = detectedFrameworks.length > 0
    ? detectedFrameworks.join(', ')
    : 'unknown frameworks';

  return (
    `You are an iOS App Store Review expert. An app using [${frameworks}] triggered the rule "${ruleId}". ` +
    `Provide a contextual suggestion for fixing this issue, considering the specific frameworks detected. ` +
    `Be concise (2-3 sentences). Focus on what purpose string to write and why it matters for this specific app.`
  );
}

/**
 * Parse the evaluation response from the LLM
 */
function parseEvaluationResponse(text: string, opts: SamplingOptions): PurposeStringEvaluation {
  const isAdequate = /VERDICT:\s*ADEQUATE/i.test(text) && !/INADEQUATE/i.test(text.split('VERDICT:')[1]?.split('\n')[0] || '');

  const evaluationMatch = text.match(/EVALUATION:\s*(.+)/i);
  const suggestionMatch = text.match(/SUGGESTION:\s*(.+)/i);

  const evaluation = evaluationMatch?.[1]?.trim() || text.trim();
  const suggestion = suggestionMatch?.[1]?.trim();

  return {
    permission: opts.permission,
    currentString: opts.purposeString,
    isAdequate,
    evaluation,
    suggestedString: suggestion && suggestion.toLowerCase() !== 'none' ? suggestion : undefined,
  };
}

/**
 * Evaluate a purpose string using MCP sampling.
 * Returns null if sampling is not supported or fails.
 */
export async function evaluatePurposeString(
  server: Server,
  opts: SamplingOptions,
): Promise<PurposeStringEvaluation | null> {
  try {
    const result = await server.createMessage({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: buildEvaluationPrompt(opts),
          },
        },
      ],
      maxTokens: 256,
    }) as CreateMessageResult;

    const text = typeof result.content === 'object' && 'text' in result.content
      ? result.content.text
      : String(result.content);

    return parseEvaluationResponse(text, opts);
  } catch {
    // Sampling not supported or failed — graceful fallback
    return null;
  }
}

/**
 * Get an AI-powered contextual suggestion for a rule explanation.
 * Returns null if sampling is not supported or fails.
 */
export async function getContextualSuggestion(
  server: Server,
  ruleId: string,
  detectedFrameworks: string[],
): Promise<string | null> {
  try {
    const result = await server.createMessage({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: buildExplainPrompt(ruleId, detectedFrameworks),
          },
        },
      ],
      maxTokens: 256,
    }) as CreateMessageResult;

    const text = typeof result.content === 'object' && 'text' in result.content
      ? result.content.text
      : String(result.content);

    return text.trim() || null;
  } catch {
    return null;
  }
}

// Export for testing
export { buildEvaluationPrompt, buildExplainPrompt, parseEvaluationResponse };
