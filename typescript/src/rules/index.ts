/**
 * Rules module - exports all rules and registry
 */
import type { Rule } from '../types/index.js';

// Privacy rules
export * from './privacy/index.js';

// Auth rules
export * from './auth/index.js';

// Base utilities
export * from './base.js';

// Import all rules for registry
import { MissingCameraPurposeRule } from './privacy/missing-camera-purpose.js';
import { MissingLocationPurposeRule } from './privacy/missing-location-purpose.js';
import { LocationAlwaysUnjustifiedRule } from './privacy/location-always-unjustified.js';
import { ATTTrackingMismatchRule } from './privacy/att-tracking-mismatch.js';
import { ThirdPartyLoginNoSIWARule } from './auth/third-party-login-no-siwa.js';

/**
 * All available rules
 */
export const allRules: Rule[] = [
  MissingCameraPurposeRule,
  MissingLocationPurposeRule,
  LocationAlwaysUnjustifiedRule,
  ATTTrackingMismatchRule,
  ThirdPartyLoginNoSIWARule,
];

/**
 * Rule registry - maps rule IDs to rule instances
 */
export const ruleRegistry: Map<string, Rule> = new Map(
  allRules.map(rule => [rule.id, rule])
);

/**
 * Get a rule by ID
 */
export function getRule(id: string): Rule | undefined {
  return ruleRegistry.get(id);
}

/**
 * Get rules by IDs (returns all if no IDs specified)
 */
export function getRules(ids?: string[]): Rule[] {
  if (!ids || ids.length === 0) {
    return allRules;
  }
  
  return ids
    .map(id => ruleRegistry.get(id))
    .filter((rule): rule is Rule => rule !== undefined);
}

/**
 * Get rules excluding specified IDs
 */
export function getRulesExcluding(excludeIds: string[]): Rule[] {
  const excludeSet = new Set(excludeIds);
  return allRules.filter(rule => !excludeSet.has(rule.id));
}
