/**
 * Tests for suppression support
 */
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { applySuppression, parseShiplintIgnore } from '../../src/core/suppression';
import type { Finding } from '../../src/types';
import { Severity, Confidence } from '../../src/types';

function makeFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    ruleId: 'code-001-private-api-usage',
    severity: Severity.Critical,
    confidence: Confidence.High,
    title: 'UIWebView Usage',
    description: 'UIWebView detected',
    guideline: '2.5.1',
    fixGuidance: 'Replace with WKWebView',
    ...overrides,
  };
}

describe('parseShiplintIgnore', () => {
  it('should parse rule ID only entries', () => {
    const entries = parseShiplintIgnore('code-001-private-api-usage\ncode-002-external-payment');
    expect(entries).toEqual([
      { ruleId: 'code-001-private-api-usage' },
      { ruleId: 'code-002-external-payment' },
    ]);
  });

  it('should parse rule ID with file path', () => {
    const entries = parseShiplintIgnore('code-001-private-api-usage:Sources/Legacy/OldWebView.swift');
    expect(entries).toEqual([
      { ruleId: 'code-001-private-api-usage', filePath: 'Sources/Legacy/OldWebView.swift' },
    ]);
  });

  it('should ignore comments and blank lines', () => {
    const content = `# This is a comment
code-001-private-api-usage

# Another comment

code-002-external-payment
`;
    const entries = parseShiplintIgnore(content);
    expect(entries).toEqual([
      { ruleId: 'code-001-private-api-usage' },
      { ruleId: 'code-002-external-payment' },
    ]);
  });

  it('should handle empty content', () => {
    expect(parseShiplintIgnore('')).toEqual([]);
    expect(parseShiplintIgnore('# only comments\n\n')).toEqual([]);
  });
});

describe('applySuppression', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shiplint-suppress-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('.shiplintignore', () => {
    it('should suppress rule everywhere when rule ID only', () => {
      fs.writeFileSync(path.join(tempDir, '.shiplintignore'), 'code-001-private-api-usage\n');
      const findings = [
        makeFinding({ location: 'Sources/A.swift' }),
        makeFinding({ location: 'Sources/B.swift' }),
      ];
      const result = applySuppression(findings, tempDir);
      expect(result.activeFindings).toHaveLength(0);
      expect(result.suppressedFindings).toHaveLength(2);
      expect(result.suppressedFindings[0].suppressed).toBe(true);
      expect(result.suppressedFindings[0].suppressionReason).toContain('.shiplintignore');
    });

    it('should suppress rule only in specific file', () => {
      fs.writeFileSync(
        path.join(tempDir, '.shiplintignore'),
        'code-001-private-api-usage:Sources/Legacy/OldWebView.swift\n'
      );
      const findings = [
        makeFinding({ location: 'Sources/Legacy/OldWebView.swift' }),
        makeFinding({ location: 'Sources/Other.swift' }),
      ];
      const result = applySuppression(findings, tempDir);
      expect(result.activeFindings).toHaveLength(1);
      expect(result.activeFindings[0].location).toBe('Sources/Other.swift');
      expect(result.suppressedFindings).toHaveLength(1);
      expect(result.suppressedFindings[0].location).toBe('Sources/Legacy/OldWebView.swift');
    });

    it('should not suppress when rule ID does not match', () => {
      fs.writeFileSync(path.join(tempDir, '.shiplintignore'), 'code-002-external-payment\n');
      const findings = [makeFinding()];
      const result = applySuppression(findings, tempDir);
      expect(result.activeFindings).toHaveLength(1);
      expect(result.suppressedFindings).toHaveLength(0);
    });

    it('should handle missing .shiplintignore gracefully', () => {
      const findings = [makeFinding()];
      const result = applySuppression(findings, tempDir);
      expect(result.activeFindings).toHaveLength(1);
      expect(result.suppressedFindings).toHaveLength(0);
    });
  });

  describe('inline disable-next-line', () => {
    it('should suppress with matching rule ID', () => {
      const srcDir = path.join(tempDir, 'Sources');
      fs.mkdirSync(srcDir, { recursive: true });
      const filePath = path.join(srcDir, 'Test.swift');
      fs.writeFileSync(filePath, [
        'import UIKit',
        '// shiplint-disable-next-line code-001-private-api-usage',
        'let webView = UIWebView()',
      ].join('\n'));

      const findings = [makeFinding({ location: 'Sources/Test.swift', line: 3 })];
      const result = applySuppression(findings, tempDir);
      expect(result.activeFindings).toHaveLength(0);
      expect(result.suppressedFindings).toHaveLength(1);
      expect(result.suppressedFindings[0].suppressionReason).toContain('shiplint-disable-next-line');
    });

    it('should suppress all rules when no rule ID specified', () => {
      const srcDir = path.join(tempDir, 'Sources');
      fs.mkdirSync(srcDir, { recursive: true });
      const filePath = path.join(srcDir, 'Test.swift');
      fs.writeFileSync(filePath, [
        'import UIKit',
        '// shiplint-disable-next-line',
        'let webView = UIWebView()',
      ].join('\n'));

      const findings = [makeFinding({ location: 'Sources/Test.swift', line: 3 })];
      const result = applySuppression(findings, tempDir);
      expect(result.activeFindings).toHaveLength(0);
      expect(result.suppressedFindings).toHaveLength(1);
    });

    it('should NOT suppress when rule ID does not match', () => {
      const srcDir = path.join(tempDir, 'Sources');
      fs.mkdirSync(srcDir, { recursive: true });
      const filePath = path.join(srcDir, 'Test.swift');
      fs.writeFileSync(filePath, [
        'import UIKit',
        '// shiplint-disable-next-line code-002-external-payment',
        'let webView = UIWebView()',
      ].join('\n'));

      const findings = [makeFinding({ location: 'Sources/Test.swift', line: 3 })];
      const result = applySuppression(findings, tempDir);
      expect(result.activeFindings).toHaveLength(1);
      expect(result.suppressedFindings).toHaveLength(0);
    });

    it('should support block comment style /* */', () => {
      const srcDir = path.join(tempDir, 'Sources');
      fs.mkdirSync(srcDir, { recursive: true });
      const filePath = path.join(srcDir, 'Test.m');
      fs.writeFileSync(filePath, [
        '#import <UIKit/UIKit.h>',
        '/* shiplint-disable-next-line code-001-private-api-usage */',
        'UIWebView *webView = [[UIWebView alloc] init];',
      ].join('\n'));

      const findings = [makeFinding({ location: 'Sources/Test.m', line: 3 })];
      const result = applySuppression(findings, tempDir);
      expect(result.activeFindings).toHaveLength(0);
      expect(result.suppressedFindings).toHaveLength(1);
    });

    it('should not suppress when no inline comment on previous line', () => {
      const srcDir = path.join(tempDir, 'Sources');
      fs.mkdirSync(srcDir, { recursive: true });
      const filePath = path.join(srcDir, 'Test.swift');
      fs.writeFileSync(filePath, [
        'import UIKit',
        '',
        'let webView = UIWebView()',
      ].join('\n'));

      const findings = [makeFinding({ location: 'Sources/Test.swift', line: 3 })];
      const result = applySuppression(findings, tempDir);
      expect(result.activeFindings).toHaveLength(1);
      expect(result.suppressedFindings).toHaveLength(0);
    });

    it('should not suppress findings without line numbers', () => {
      const srcDir = path.join(tempDir, 'Sources');
      fs.mkdirSync(srcDir, { recursive: true });
      fs.writeFileSync(path.join(srcDir, 'Test.swift'), '// shiplint-disable-next-line\nlet x = 1\n');

      const findings = [makeFinding({ location: 'Sources/Test.swift' })]; // no line number
      const result = applySuppression(findings, tempDir);
      expect(result.activeFindings).toHaveLength(1);
      expect(result.suppressedFindings).toHaveLength(0);
    });
  });

  describe('combined suppression', () => {
    it('should apply both .shiplintignore and inline suppression', () => {
      // .shiplintignore suppresses code-002 everywhere
      fs.writeFileSync(path.join(tempDir, '.shiplintignore'), 'code-002-external-payment\n');

      // Inline suppresses code-001 at a specific line
      const srcDir = path.join(tempDir, 'Sources');
      fs.mkdirSync(srcDir, { recursive: true });
      fs.writeFileSync(path.join(srcDir, 'Test.swift'), [
        'import UIKit',
        '// shiplint-disable-next-line code-001-private-api-usage',
        'let webView = UIWebView()',
        'let webView2 = UIWebView()',
      ].join('\n'));

      const findings = [
        makeFinding({ ruleId: 'code-001-private-api-usage', location: 'Sources/Test.swift', line: 3 }),
        makeFinding({ ruleId: 'code-001-private-api-usage', location: 'Sources/Test.swift', line: 4 }),
        makeFinding({ ruleId: 'code-002-external-payment', location: 'Sources/Test.swift' }),
      ];

      const result = applySuppression(findings, tempDir);
      expect(result.activeFindings).toHaveLength(1); // line 4, code-001
      expect(result.suppressedFindings).toHaveLength(2); // line 3 (inline) + code-002 (ignore file)
    });
  });
});

describe('suppressed count in output', () => {
  it('suppressedFindings should have suppressed flag and reason', () => {
    const tempDir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'shiplint-suppress-output-'));
    try {
      fs.writeFileSync(path.join(tempDir2, '.shiplintignore'), 'code-001-private-api-usage\n');
      const findings = [makeFinding({ location: 'test.swift' })];
      const result = applySuppression(findings, tempDir2);
      expect(result.suppressedFindings).toHaveLength(1);
      expect(result.suppressedFindings[0].suppressed).toBe(true);
      expect(result.suppressedFindings[0].suppressionReason).toBeDefined();
    } finally {
      fs.rmSync(tempDir2, { recursive: true, force: true });
    }
  });
});
