/**
 * JSON formatter for machine-readable output
 */
import type { ScanResult } from '../types/index.js';

/**
 * Format scan results as JSON
 */
export function formatJSON(result: ScanResult): string {
  return JSON.stringify(result, null, 2);
}

/**
 * Format scan results as compact JSON (single line)
 */
export function formatJSONCompact(result: ScanResult): string {
  return JSON.stringify(result);
}
