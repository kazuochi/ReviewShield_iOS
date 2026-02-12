#!/usr/bin/env node
/**
 * ShipLint CLI
 * 
 * App Store Review Guideline scanner for iOS projects
 */
import { Command } from 'commander';
import { scan } from '../core/scanner.js';
import { format } from '../formatters/index.js';
import { allRules } from '../rules/index.js';
import { OutputFormat } from '../types/index.js';
import { startMcpServer } from '../mcp/server.js';
import { ping, buildEnhancedPayload } from './analytics.js';
import packageJson from '../../package.json';

const program = new Command();

program
  .name('shiplint')
  .description('App Store Review Guideline scanner for iOS projects')
  .version(packageJson.version);

program
  .command('scan')
  .description('Scan an Xcode project for potential App Store Review issues')
  .argument('<path>', 'Path to Xcode project, workspace, or directory')
  .option('-f, --format <format>', 'Output format: text, json, sarif', 'text')
  .option('-v, --verbose', 'Show verbose output', false)
  .option('-r, --rules <rules...>', 'Only run specific rules (by ID)')
  .option('-e, --exclude <rules...>', 'Exclude specific rules (by ID)')
  .option('--show-suppressed', 'Show suppressed findings in output', false)
  .action(async (path: string, options) => {
    try {
      const outputFormat = parseOutputFormat(options.format);
      
      const result = await scan({
        path,
        format: outputFormat,
        verbose: options.verbose,
        rules: options.rules,
        exclude: options.exclude,
      });
      
      const output = await format(result, outputFormat);
      console.log(output);
      
      // Anonymous analytics ping (fire-and-forget, opt-out with SHIPLINT_NO_TELEMETRY=1)
      ping(buildEnhancedPayload({
        version: packageJson.version,
        findings: result.findings,
        scanDurationMs: result.duration,
        scanMode: 'cli',
        projectType: result.projectType,
        frameworkDetectionMethod: result.frameworkDetectionMethod,
        frameworksDetected: result.frameworksDetected,
        targetCount: result.targetCount,
      }));
      
      // Exit with error code if critical issues found
      const hasCritical = result.findings.some(f => f.severity === 'critical');
      if (hasCritical) {
        process.exit(1);
      }
    } catch (error) {
      if (error instanceof Error) {
        console.error(`Error: ${error.message}`);
        if (options.verbose) {
          console.error(error.stack);
        }
      } else {
        console.error('An unknown error occurred');
      }
      process.exit(1);
    }
  });

program
  .command('rules')
  .description('List all available rules')
  .option('-f, --format <format>', 'Output format: text, json', 'text')
  .action((options) => {
    if (options.format === 'json') {
      const rules = allRules.map(rule => ({
        id: rule.id,
        name: rule.name,
        description: rule.description,
        category: rule.category,
        severity: rule.severity,
        guideline: rule.guidelineReference,
      }));
      console.log(JSON.stringify(rules, null, 2));
    } else {
      console.log('\n🛡️  ShipLint Rules\n');
      console.log('=' .repeat(60));
      
      for (const rule of allRules) {
        console.log(`\n${rule.id}`);
        console.log(`  Name:        ${rule.name}`);
        console.log(`  Category:    ${rule.category}`);
        console.log(`  Severity:    ${rule.severity}`);
        console.log(`  Guideline:   ${rule.guidelineReference}`);
        console.log(`  Description: ${rule.description}`);
      }
      console.log('\n');
    }
  });

program
  .command('mcp')
  .description('Start MCP (Model Context Protocol) server for AI agent integration')
  .action(async () => {
    try {
      await startMcpServer();
    } catch (error) {
      if (error instanceof Error) {
        console.error(`Error: ${error.message}`);
      } else {
        console.error('An unknown error occurred');
      }
      process.exit(1);
    }
  });

function parseOutputFormat(format: string): OutputFormat {
  switch (format.toLowerCase()) {
    case 'text':
      return OutputFormat.Text;
    case 'json':
      return OutputFormat.JSON;
    case 'sarif':
      return OutputFormat.SARIF;
    default:
      throw new Error(`Unknown output format: ${format}. Use text, json, or sarif.`);
  }
}

program.parse();
