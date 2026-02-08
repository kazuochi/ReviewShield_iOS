/**
 * Tests for RequiredReasonAPIRule
 */
import { RequiredReasonAPIRule } from '../../src/rules/privacy/required-reason-api';
import {
  findSourceFiles,
  detectRequiredReasonAPIs,
  parseDeclaredAPICategories,
  findPrivacyManifest,
} from '../../src/rules/privacy/required-reason-api';
import { createContextObject } from '../../src/parsers/project-parser';
import { Severity, Confidence, DependencySource } from '../../src/types';
import * as fs from 'fs';
import * as path from 'path';

// Mock fs module
jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('RequiredReasonAPIRule', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function setupMockFs(options: {
    sourceFiles?: Record<string, string>;
    privacyManifest?: string | null;
    dirs?: string[];
  }) {
    const { sourceFiles = {}, privacyManifest = null, dirs = [] } = options;

    // existsSync — check privacy manifest paths
    mockFs.existsSync.mockImplementation((p) => {
      const ps = p as string;
      if (ps.endsWith('PrivacyInfo.xcprivacy') && privacyManifest !== null) {
        return ps === path.join('/test/project', 'PrivacyInfo.xcprivacy');
      }
      return false;
    });

    // readdirSync — return directory entries for source file walking
    mockFs.readdirSync.mockImplementation(((p: string, opts?: any) => {
      if (opts?.withFileTypes) {
        if (p === '/test/project') {
          const entries: any[] = [];
          // Add dirs
          for (const d of dirs) {
            entries.push({ name: d, isDirectory: () => true, isFile: () => false });
          }
          // Add root-level source files
          for (const filePath of Object.keys(sourceFiles)) {
            const relative = path.relative('/test/project', filePath);
            if (!relative.includes(path.sep)) {
              entries.push({ name: relative, isDirectory: () => false, isFile: () => true });
            }
          }
          return entries;
        }
        // Subdirectories
        const entries: any[] = [];
        for (const filePath of Object.keys(sourceFiles)) {
          const dir = path.dirname(filePath);
          if (dir === p) {
            entries.push({
              name: path.basename(filePath),
              isDirectory: () => false,
              isFile: () => true,
            });
          }
        }
        return entries;
      }
      // Non-withFileTypes call (from findPrivacyManifest)
      const entries: string[] = [];
      for (const d of dirs) {
        entries.push(d);
      }
      return entries;
    }) as any);

    mockFs.statSync.mockImplementation(((p: string) => {
      for (const d of dirs) {
        if (p === path.join('/test/project', d)) {
          return { isDirectory: () => true } as fs.Stats;
        }
      }
      return { isDirectory: () => false } as fs.Stats;
    }) as any);

    mockFs.readFileSync.mockImplementation(((p: string, encoding?: string) => {
      if (sourceFiles[p]) return sourceFiles[p];
      if (
        privacyManifest !== null &&
        (p as string).endsWith('PrivacyInfo.xcprivacy')
      ) {
        return privacyManifest;
      }
      throw new Error(`ENOENT: ${p}`);
    }) as any);
  }

  describe('No Required Reason APIs used', () => {
    it('should return no findings when no source files use Required Reason APIs', async () => {
      setupMockFs({
        sourceFiles: {
          '/test/project/App.swift': 'import UIKit\nclass App {}',
        },
      });

      const context = createContextObject(
        '/test/project',
        {},
        {},
        new Set(),
        []
      );

      const findings = await RequiredReasonAPIRule.evaluate(context);
      expect(findings).toEqual([]);
    });
  });

  describe('APIs used without manifest', () => {
    it('should find missing manifest when UserDefaults is used', async () => {
      setupMockFs({
        sourceFiles: {
          '/test/project/Settings.swift':
            'let defaults = UserDefaults.standard\ndefaults.set(true, forKey: "key")',
        },
      });

      const context = createContextObject(
        '/test/project',
        {},
        {},
        new Set(),
        []
      );

      const findings = await RequiredReasonAPIRule.evaluate(context);
      expect(findings.length).toBe(1);
      expect(findings[0].ruleId).toBe('privacy-010-required-reason-api');
      expect(findings[0].title).toBe('Required Reason APIs Used Without Privacy Manifest');
      expect(findings[0].description).toContain('UserDefaults');
    });

    it('should find missing manifest when systemUptime is used', async () => {
      setupMockFs({
        sourceFiles: {
          '/test/project/Timer.swift':
            'let uptime = ProcessInfo.processInfo.systemUptime',
        },
      });

      const context = createContextObject(
        '/test/project',
        {},
        {},
        new Set(),
        []
      );

      const findings = await RequiredReasonAPIRule.evaluate(context);
      expect(findings.length).toBe(1);
      expect(findings[0].description).toContain('System Boot Time');
    });

    it('should find missing manifest when disk space APIs are used', async () => {
      setupMockFs({
        sourceFiles: {
          '/test/project/Storage.swift':
            'let key = URLResourceKey.volumeAvailableCapacityKey',
        },
      });

      const context = createContextObject(
        '/test/project',
        {},
        {},
        new Set(),
        []
      );

      const findings = await RequiredReasonAPIRule.evaluate(context);
      expect(findings.length).toBe(1);
      expect(findings[0].description).toContain('Disk Space');
    });

    it('should report multiple categories in single finding when no manifest', async () => {
      setupMockFs({
        sourceFiles: {
          '/test/project/App.swift':
            'UserDefaults.standard.set(1, forKey: "x")\nlet t = ProcessInfo.processInfo.systemUptime',
        },
      });

      const context = createContextObject(
        '/test/project',
        {},
        {},
        new Set(),
        []
      );

      const findings = await RequiredReasonAPIRule.evaluate(context);
      expect(findings.length).toBe(1);
      expect(findings[0].description).toContain('UserDefaults');
      expect(findings[0].description).toContain('System Boot Time');
    });
  });

  describe('APIs used with complete manifest', () => {
    it('should return no findings when all used APIs are declared', async () => {
      const manifest = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>NSPrivacyAccessedAPITypes</key>
    <array>
        <dict>
            <key>NSPrivacyAccessedAPIType</key>
            <string>NSPrivacyAccessedAPICategoryUserDefaults</string>
            <key>NSPrivacyAccessedAPITypeReasons</key>
            <array>
                <string>CA92.1</string>
            </array>
        </dict>
    </array>
</dict>
</plist>`;

      setupMockFs({
        sourceFiles: {
          '/test/project/Settings.swift': 'UserDefaults.standard.set(true, forKey: "k")',
        },
        privacyManifest: manifest,
      });

      const context = createContextObject(
        '/test/project',
        {},
        {},
        new Set(),
        []
      );

      const findings = await RequiredReasonAPIRule.evaluate(context);
      expect(findings).toEqual([]);
    });
  });

  describe('APIs used with incomplete manifest', () => {
    it('should find undeclared categories when manifest is incomplete', async () => {
      const manifest = `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0">
<dict>
    <key>NSPrivacyAccessedAPITypes</key>
    <array>
        <dict>
            <key>NSPrivacyAccessedAPIType</key>
            <string>NSPrivacyAccessedAPICategoryUserDefaults</string>
            <key>NSPrivacyAccessedAPITypeReasons</key>
            <array><string>CA92.1</string></array>
        </dict>
    </array>
</dict>
</plist>`;

      setupMockFs({
        sourceFiles: {
          '/test/project/App.swift':
            'UserDefaults.standard.set(1, forKey: "x")\nlet t = ProcessInfo.processInfo.systemUptime',
        },
        privacyManifest: manifest,
      });

      const context = createContextObject(
        '/test/project',
        {},
        {},
        new Set(),
        []
      );

      const findings = await RequiredReasonAPIRule.evaluate(context);
      // UserDefaults is declared, systemUptime is NOT
      expect(findings.length).toBe(1);
      expect(findings[0].title).toContain('System Boot Time');
      expect(findings[0].description).toContain('NSPrivacyAccessedAPICategorySystemBootTime');
    });

    it('should find multiple undeclared categories', async () => {
      const manifest = `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0">
<dict>
    <key>NSPrivacyAccessedAPITypes</key>
    <array/>
</dict>
</plist>`;

      setupMockFs({
        sourceFiles: {
          '/test/project/App.swift': 'UserDefaults.standard\nlet t = mach_absolute_time()\nlet k = activeInputModes',
        },
        privacyManifest: manifest,
      });

      const context = createContextObject(
        '/test/project',
        {},
        {},
        new Set(),
        []
      );

      const findings = await RequiredReasonAPIRule.evaluate(context);
      expect(findings.length).toBe(3); // UserDefaults, SystemBootTime, ActiveKeyboards
    });
  });

  describe('File timestamp detection', () => {
    it('should detect NSFileModificationDate usage', async () => {
      setupMockFs({
        sourceFiles: {
          '/test/project/FileHelper.swift':
            'let date = try FileManager.default.attributesOfItem(atPath: p)[FileAttributeKey.modificationDate]',
        },
      });

      const context = createContextObject('/test/project', {}, {}, new Set(), []);
      const findings = await RequiredReasonAPIRule.evaluate(context);
      expect(findings.length).toBe(1);
      expect(findings[0].description).toContain('File Timestamp');
    });
  });

  describe('Active keyboards detection', () => {
    it('should detect activeInputModes usage', async () => {
      setupMockFs({
        sourceFiles: {
          '/test/project/Keyboard.swift':
            'let modes = UITextInputMode.activeInputModes',
        },
      });

      const context = createContextObject('/test/project', {}, {}, new Set(), []);
      const findings = await RequiredReasonAPIRule.evaluate(context);
      expect(findings.length).toBe(1);
      expect(findings[0].description).toContain('Active Keyboards');
    });
  });

  describe('ObjC file detection', () => {
    it('should detect NSUserDefaults in .m files', async () => {
      setupMockFs({
        sourceFiles: {
          '/test/project/Settings.m':
            '[[NSUserDefaults standardUserDefaults] setObject:@"val" forKey:@"key"];',
        },
      });

      const context = createContextObject('/test/project', {}, {}, new Set(), []);
      const findings = await RequiredReasonAPIRule.evaluate(context);
      expect(findings.length).toBe(1);
      expect(findings[0].description).toContain('UserDefaults');
    });
  });

  describe('parseDeclaredAPICategories', () => {
    it('should parse multiple declared categories', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0">
<dict>
    <key>NSPrivacyAccessedAPITypes</key>
    <array>
        <dict>
            <key>NSPrivacyAccessedAPIType</key>
            <string>NSPrivacyAccessedAPICategoryUserDefaults</string>
            <key>NSPrivacyAccessedAPITypeReasons</key>
            <array><string>CA92.1</string></array>
        </dict>
        <dict>
            <key>NSPrivacyAccessedAPIType</key>
            <string>NSPrivacyAccessedAPICategoryFileTimestamp</string>
            <key>NSPrivacyAccessedAPITypeReasons</key>
            <array><string>DDA9.1</string></array>
        </dict>
    </array>
</dict>
</plist>`;

      mockFs.readFileSync.mockReturnValue(xml as any);
      const result = parseDeclaredAPICategories('/test/PrivacyInfo.xcprivacy');
      expect(result.size).toBe(2);
      expect(result.has('NSPrivacyAccessedAPICategoryUserDefaults')).toBe(true);
      expect(result.has('NSPrivacyAccessedAPICategoryFileTimestamp')).toBe(true);
    });
  });

  describe('Rule metadata', () => {
    it('should have correct metadata', () => {
      expect(RequiredReasonAPIRule.id).toBe('privacy-010-required-reason-api');
      expect(RequiredReasonAPIRule.severity).toBe(Severity.High);
      expect(RequiredReasonAPIRule.confidence).toBe(Confidence.High);
    });
  });
});
