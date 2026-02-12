// Mock chalk to avoid ESM issues in Jest
const passthrough = (text: string) => text;
const handler: ProxyHandler<any> = {
  get: (_target: any, prop: string) => {
    if (prop === 'default') return new Proxy(passthrough, handler);
    if (prop === '__esModule') return true;
    if (prop === 'then') return undefined; // prevent Promise-like behavior
    return new Proxy(passthrough, handler);
  },
  apply: (_target: any, _thisArg: any, args: any[]) => args[0],
};
jest.mock('chalk', () => new Proxy(passthrough, handler));

import { formatText } from '../../src/formatters/text.js';
import { Severity, Confidence } from '../../src/types/index.js';
import type { ScanResult, Finding } from '../../src/types/index.js';

function makeFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    ruleId: 'test-001',
    severity: Severity.Info,
    confidence: Confidence.Medium,
    title: 'Test finding',
    description: 'A test finding',
    guideline: '1.0',
    fixGuidance: 'Fix it',
    ...overrides,
  };
}

function makeResult(findings: Finding[]): ScanResult {
  return {
    projectPath: '/test/project',
    timestamp: new Date('2026-01-01'),
    findings,
    suppressedFindings: [],
    rulesRun: ['test-001'],
    duration: 100,
    projectType: 'xcodeproj',
    frameworkDetectionMethod: 'pbxproj',
    frameworksDetected: [],
    targetCount: 1,
  };
}

describe('Verdict banner logic', () => {
  test('INFO-only findings → PASS (never NOT READY)', async () => {
    const result = makeResult([
      makeFinding({ severity: Severity.Info, ruleId: 'code-002', title: 'Stripe SDK detected' }),
    ]);
    const output = await formatText(result);
    expect(output).toContain('PASS');
    expect(output).not.toContain('NOT READY');
  });

  test('MEDIUM findings, no CRITICAL → REVIEW (never NOT READY)', async () => {
    const result = makeResult([
      makeFinding({ severity: Severity.Medium, title: 'Some medium issue' }),
    ]);
    const output = await formatText(result);
    expect(output).toContain('REVIEW');
    expect(output).not.toContain('NOT READY');
  });

  test('HIGH findings, no CRITICAL → REVIEW (never NOT READY)', async () => {
    const result = makeResult([
      makeFinding({ severity: Severity.High, title: 'Some high issue' }),
    ]);
    const output = await formatText(result);
    expect(output).toContain('REVIEW');
    expect(output).not.toContain('NOT READY');
  });

  test('CRITICAL finding → NOT READY', async () => {
    const result = makeResult([
      makeFinding({ severity: Severity.Critical, title: 'Critical problem' }),
    ]);
    const output = await formatText(result);
    expect(output).toContain('NOT READY');
  });

  test('mixed INFO + CRITICAL → NOT READY', async () => {
    const result = makeResult([
      makeFinding({ severity: Severity.Info, title: 'Just info' }),
      makeFinding({ severity: Severity.Critical, title: 'Critical problem' }),
    ]);
    const output = await formatText(result);
    expect(output).toContain('NOT READY');
  });

  test('no findings → PASS', async () => {
    const result = makeResult([]);
    const output = await formatText(result);
    expect(output).toContain('PASS');
    expect(output).not.toContain('NOT READY');
  });
});
