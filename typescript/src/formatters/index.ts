/**
 * Formatters module exports
 */
import type { ScanResult } from '../types/index.js';
import { OutputFormat } from '../types/index.js';
import { formatText } from './text.js';
import { formatJSON } from './json.js';
import { formatSARIF } from './sarif.js';

export { formatText } from './text.js';
export { formatJSON, formatJSONCompact } from './json.js';
export { formatSARIF } from './sarif.js';

/**
 * Format scan results based on output format
 */
export async function format(result: ScanResult, outputFormat: OutputFormat): Promise<string> {
  switch (outputFormat) {
    case OutputFormat.Text:
      return formatText(result);
    case OutputFormat.JSON:
      return formatJSON(result);
    case OutputFormat.SARIF:
      return formatSARIF(result);
  }
}
