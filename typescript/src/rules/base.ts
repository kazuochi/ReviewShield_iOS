/**
 * Base utilities for rules
 */
import type { Rule, Finding, Severity, Confidence } from '../types/index.js';

/**
 * Helper to create a finding with common rule properties
 */
export function makeFinding(
  rule: Pick<Rule, 'id' | 'name' | 'severity' | 'confidence' | 'guidelineReference'>,
  options: {
    title?: string;
    description: string;
    location?: string;
    line?: number;
    fixGuidance: string;
    documentationURL?: string;
  }
): Finding {
  return {
    ruleId: rule.id,
    severity: rule.severity,
    confidence: rule.confidence,
    title: options.title ?? rule.name,
    description: options.description,
    location: options.location,
    line: options.line,
    guideline: rule.guidelineReference,
    fixGuidance: options.fixGuidance,
    documentationURL: options.documentationURL,
  };
}

/**
 * Creates a finding with custom severity/confidence
 */
export function makeCustomFinding(
  rule: Pick<Rule, 'id' | 'guidelineReference'>,
  severity: Severity,
  confidence: Confidence,
  options: {
    title: string;
    description: string;
    location?: string;
    line?: number;
    fixGuidance: string;
    documentationURL?: string;
  }
): Finding {
  return {
    ruleId: rule.id,
    severity,
    confidence,
    title: options.title,
    description: options.description,
    location: options.location,
    line: options.line,
    guideline: rule.guidelineReference,
    fixGuidance: options.fixGuidance,
    documentationURL: options.documentationURL,
  };
}
