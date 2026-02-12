/**
 * ShipLint - App Store Pre-Submission Linter
 * 
 * Main library entry point for programmatic usage
 */

// Types
export * from './types/index.js';

// Parsers
export * from './parsers/index.js';

// Rules
export { 
  allRules, 
  ruleRegistry, 
  getRule, 
  getRules, 
  getRulesExcluding,
  MissingCameraPurposeRule,
  MissingLocationPurposeRule,
  LocationAlwaysUnjustifiedRule,
  ATTTrackingMismatchRule,
  ThirdPartyLoginNoSIWARule,
} from './rules/index.js';

// Core
export { scan, scanWithContext } from './core/scanner.js';
export { applySuppression, parseShiplintIgnore, loadShiplintIgnore } from './core/suppression.js';

// Formatters
export { format, formatText, formatJSON, formatSARIF } from './formatters/index.js';
