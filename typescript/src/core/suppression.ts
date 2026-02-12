/**
 * Suppression support for ShipLint
 * 
 * Two mechanisms:
 * 1. Inline comments: // shiplint-disable-next-line [rule-id]
 * 2. .shiplintignore file: rule-id or rule-id:path/to/file.swift
 */
import * as fs from 'fs';
import * as path from 'path';
import type { Finding } from '../types/index.js';

const DISABLE_NEXT_LINE_PATTERN = /shiplint-disable-next-line(?:\s+(\S+))?/;

export interface IgnoreEntry {
  ruleId: string;
  filePath?: string; // if specified, only suppress in this file
}

/**
 * Parse a .shiplintignore file
 */
export function parseShiplintIgnore(content: string): IgnoreEntry[] {
  const entries: IgnoreEntry[] = [];
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      entries.push({
        ruleId: line.substring(0, colonIndex),
        filePath: line.substring(colonIndex + 1),
      });
    } else {
      entries.push({ ruleId: line });
    }
  }
  return entries;
}

/**
 * Load .shiplintignore from project root
 */
export function loadShiplintIgnore(projectPath: string): IgnoreEntry[] {
  const ignorePath = path.join(projectPath, '.shiplintignore');
  if (!fs.existsSync(ignorePath)) return [];
  const content = fs.readFileSync(ignorePath, 'utf-8');
  return parseShiplintIgnore(content);
}

/**
 * Check if a finding is suppressed by .shiplintignore
 */
function isSuppressedByIgnoreFile(
  finding: Finding,
  ignoreEntries: IgnoreEntry[],
  projectPath: string,
): string | null {
  for (const entry of ignoreEntries) {
    if (entry.ruleId !== finding.ruleId) continue;
    
    if (!entry.filePath) {
      // Rule suppressed everywhere
      return `.shiplintignore: ${entry.ruleId}`;
    }
    
    // Rule suppressed in specific file - check if finding's location matches
    if (finding.location) {
      const findingRelPath = path.isAbsolute(finding.location)
        ? path.relative(projectPath, finding.location)
        : finding.location;
      if (findingRelPath === entry.filePath || finding.location === entry.filePath) {
        return `.shiplintignore: ${entry.ruleId}:${entry.filePath}`;
      }
    }
  }
  return null;
}

// Cache for file contents used in inline suppression checks
const fileContentCache = new Map<string, string[]>();

function getFileLines(filePath: string): string[] | null {
  if (fileContentCache.has(filePath)) return fileContentCache.get(filePath)!;
  try {
    if (!fs.existsSync(filePath)) return null;
    const lines = fs.readFileSync(filePath, 'utf-8').split('\n');
    fileContentCache.set(filePath, lines);
    return lines;
  } catch {
    return null;
  }
}

/**
 * Check if a finding is suppressed by an inline comment
 */
function isSuppressedByInlineComment(
  finding: Finding,
  projectPath: string,
): string | null {
  if (!finding.location || !finding.line || finding.line <= 1) return null;
  
  const filePath = path.isAbsolute(finding.location)
    ? finding.location
    : path.join(projectPath, finding.location);
  
  const lines = getFileLines(filePath);
  if (!lines) return null;
  
  // Check line N-1 (0-indexed: finding.line - 2)
  const prevLineIndex = finding.line - 2;
  if (prevLineIndex < 0 || prevLineIndex >= lines.length) return null;
  
  const prevLine = lines[prevLineIndex];
  const match = prevLine.match(DISABLE_NEXT_LINE_PATTERN);
  if (!match) return null;
  
  const specifiedRuleId = match[1];
  if (!specifiedRuleId) {
    // No rule ID = suppress all rules on next line
    return 'inline: shiplint-disable-next-line';
  }
  if (specifiedRuleId === finding.ruleId) {
    return `inline: shiplint-disable-next-line ${specifiedRuleId}`;
  }
  
  // Rule ID doesn't match
  return null;
}

export interface SuppressionResult {
  activeFindings: Finding[];
  suppressedFindings: Finding[];
}

/**
 * Apply suppression rules to findings.
 * Returns active and suppressed findings separately.
 */
export function applySuppression(
  findings: Finding[],
  projectPath: string,
): SuppressionResult {
  // Clear file content cache
  fileContentCache.clear();
  
  const ignoreEntries = loadShiplintIgnore(projectPath);
  const activeFindings: Finding[] = [];
  const suppressedFindings: Finding[] = [];
  
  for (const finding of findings) {
    // Check .shiplintignore first
    let reason = isSuppressedByIgnoreFile(finding, ignoreEntries, projectPath);
    
    // Check inline comment
    if (!reason) {
      reason = isSuppressedByInlineComment(finding, projectPath);
    }
    
    if (reason) {
      suppressedFindings.push({
        ...finding,
        suppressed: true,
        suppressionReason: reason,
      });
    } else {
      activeFindings.push(finding);
    }
  }
  
  // Clear cache after use
  fileContentCache.clear();
  
  return { activeFindings, suppressedFindings };
}
