/**
 * Rules module - exports all rules and registry
 */
import type { Rule } from '../types/index.js';

// Privacy rules
export * from './privacy/index.js';

// Auth rules
export * from './auth/index.js';

// Metadata rules
export * from './metadata/index.js';

// Config rules
export * from './config/index.js';

// Base utilities
export * from './base.js';

// Import all rules for registry
import { MissingCameraPurposeRule } from './privacy/missing-camera-purpose.js';
import { MissingLocationPurposeRule } from './privacy/missing-location-purpose.js';
import { LocationAlwaysUnjustifiedRule } from './privacy/location-always-unjustified.js';
import { ATTTrackingMismatchRule } from './privacy/att-tracking-mismatch.js';
import { MissingPhotoLibraryPurposeRule } from './privacy/missing-photo-library-purpose.js';
import { MissingMicrophonePurposeRule } from './privacy/missing-microphone-purpose.js';
import { MissingContactsPurposeRule } from './privacy/missing-contacts-purpose.js';
import { ThirdPartyLoginNoSIWARule } from './auth/third-party-login-no-siwa.js';
import { MissingPrivacyManifestRule } from './metadata/missing-privacy-manifest.js';
import { ATSExceptionWithoutJustificationRule } from './config/ats-exception-without-justification.js';
import { MissingEncryptionFlagRule } from './config/missing-encryption-flag.js';
import { MissingLaunchStoryboardRule } from './config/missing-launch-storyboard.js';
import { MissingBluetoothPurposeRule } from './privacy/missing-bluetooth-purpose.js';
import { MissingFaceIdPurposeRule } from './privacy/missing-face-id-purpose.js';
import { MissingSupportedOrientationsRule } from './metadata/missing-supported-orientations.js';
import { RequiredReasonAPIRule } from './privacy/required-reason-api.js';

/**
 * All available rules
 */
export const allRules: Rule[] = [
  MissingCameraPurposeRule,
  MissingLocationPurposeRule,
  LocationAlwaysUnjustifiedRule,
  ATTTrackingMismatchRule,
  MissingPhotoLibraryPurposeRule,
  MissingMicrophonePurposeRule,
  MissingContactsPurposeRule,
  MissingBluetoothPurposeRule,
  MissingFaceIdPurposeRule,
  ThirdPartyLoginNoSIWARule,
  MissingPrivacyManifestRule,
  MissingSupportedOrientationsRule,
  ATSExceptionWithoutJustificationRule,
  MissingEncryptionFlagRule,
  MissingLaunchStoryboardRule,
  RequiredReasonAPIRule,
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
 * Result of rule lookup with validation info
 */
export interface RuleLookupResult {
  rules: Rule[];
  unknownIds: string[];
}

/**
 * Get rules by IDs with validation (returns all if no IDs specified)
 * Returns both found rules and list of unknown IDs for validation
 */
export function getRulesWithValidation(ids?: string[]): RuleLookupResult {
  if (!ids || ids.length === 0) {
    return { rules: allRules, unknownIds: [] };
  }
  
  const rules: Rule[] = [];
  const unknownIds: string[] = [];
  
  for (const id of ids) {
    const rule = ruleRegistry.get(id);
    if (rule) {
      rules.push(rule);
    } else {
      unknownIds.push(id);
    }
  }
  
  return { rules, unknownIds };
}

/**
 * Get rules by IDs (returns all if no IDs specified)
 * @deprecated Use getRulesWithValidation for proper error handling
 */
export function getRules(ids?: string[]): Rule[] {
  return getRulesWithValidation(ids).rules;
}

/**
 * Get rules excluding specified IDs
 */
export function getRulesExcluding(excludeIds: string[]): Rule[] {
  const excludeSet = new Set(excludeIds);
  return allRules.filter(rule => !excludeSet.has(rule.id));
}
