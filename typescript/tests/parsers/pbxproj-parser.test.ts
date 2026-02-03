/**
 * Tests for pbxproj-parser.ts
 * 
 * P1/P2 Fix: Tests for target-aware parsing that uses productType
 * instead of name-based heuristics.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  parsePbxprojTargets,
  getMainAppTarget,
  getTargetBuildSettings,
  normalizeXcodePath,
  getMainTargetArtifacts,
  getProductTypePriority,
  isApplicationType,
  isTestType,
  ProductType,
  parseBuildConfigurations,
  parseConfigurationLists,
} from '../../src/parsers/pbxproj-parser';

describe('pbxproj-parser', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reviewshield-pbxproj-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('parsePbxprojTargets', () => {
    it('should parse a single app target', () => {
      const content = `
/* Begin PBXNativeTarget section */
    A1B2C3D4E5F6A1B2C3D4E5F6 /* MyApp */ = {
      isa = PBXNativeTarget;
      buildConfigurationList = D1E2F3A4B5C6D1E2F3A4B5C6;
      name = MyApp;
      productType = "com.apple.product-type.application";
    };
/* End PBXNativeTarget section */`;

      const targets = parsePbxprojTargets(content);

      expect(targets).toHaveLength(1);
      expect(targets[0].id).toBe('A1B2C3D4E5F6A1B2C3D4E5F6');
      expect(targets[0].name).toBe('MyApp');
      expect(targets[0].productType).toBe('com.apple.product-type.application');
      expect(targets[0].buildConfigurationListId).toBe('D1E2F3A4B5C6D1E2F3A4B5C6');
    });

    it('should parse multiple targets (app + extension + tests)', () => {
      const content = `
/* Begin PBXNativeTarget section */
    111111111111111111111111 /* MyApp */ = {
      isa = PBXNativeTarget;
      buildConfigurationList = AAAAAAAAAAAAAAAAAAAAAAAA;
      name = MyApp;
      productType = "com.apple.product-type.application";
    };
    222222222222222222222222 /* MyAppExtension */ = {
      isa = PBXNativeTarget;
      buildConfigurationList = BBBBBBBBBBBBBBBBBBBBBBBB;
      name = MyAppExtension;
      productType = "com.apple.product-type.app-extension";
    };
    333333333333333333333333 /* MyAppTests */ = {
      isa = PBXNativeTarget;
      buildConfigurationList = CCCCCCCCCCCCCCCCCCCCCCCC;
      name = MyAppTests;
      productType = "com.apple.product-type.bundle.unit-test";
    };
    444444444444444444444444 /* MyAppUITests */ = {
      isa = PBXNativeTarget;
      buildConfigurationList = DDDDDDDDDDDDDDDDDDDDDDDD;
      name = MyAppUITests;
      productType = "com.apple.product-type.bundle.ui-testing";
    };
/* End PBXNativeTarget section */`;

      const targets = parsePbxprojTargets(content);

      expect(targets).toHaveLength(4);
      expect(targets.map(t => t.name)).toEqual(['MyApp', 'MyAppExtension', 'MyAppTests', 'MyAppUITests']);
      expect(targets.map(t => t.productType)).toEqual([
        'com.apple.product-type.application',
        'com.apple.product-type.app-extension',
        'com.apple.product-type.bundle.unit-test',
        'com.apple.product-type.bundle.ui-testing',
      ]);
    });

    it('should extract productName when present', () => {
      const content = `
/* Begin PBXNativeTarget section */
    A1B2C3D4E5F6A1B2C3D4E5F6 /* MyApp */ = {
      isa = PBXNativeTarget;
      buildConfigurationList = D1E2F3A4B5C6D1E2F3A4B5C6;
      name = MyApp;
      productName = "My Awesome App";
      productType = "com.apple.product-type.application";
    };
/* End PBXNativeTarget section */`;

      const targets = parsePbxprojTargets(content);

      expect(targets[0].productName).toBe('My Awesome App');
    });

    it('should handle empty content', () => {
      const targets = parsePbxprojTargets('');
      expect(targets).toHaveLength(0);
    });
  });

  describe('getMainAppTarget', () => {
    it('should select application over extension', () => {
      const targets = [
        { id: '1', name: 'Extension', productType: 'com.apple.product-type.app-extension', buildConfigurationListId: 'a' },
        { id: '2', name: 'MyApp', productType: 'com.apple.product-type.application', buildConfigurationListId: 'b' },
      ];

      const main = getMainAppTarget(targets);

      expect(main?.name).toBe('MyApp');
    });

    it('should select application over tests', () => {
      const targets = [
        { id: '1', name: 'MyAppTests', productType: 'com.apple.product-type.bundle.unit-test', buildConfigurationListId: 'a' },
        { id: '2', name: 'MyAppUITests', productType: 'com.apple.product-type.bundle.ui-testing', buildConfigurationListId: 'b' },
        { id: '3', name: 'MyApp', productType: 'com.apple.product-type.application', buildConfigurationListId: 'c' },
      ];

      const main = getMainAppTarget(targets);

      expect(main?.name).toBe('MyApp');
    });

    it('should select application over framework', () => {
      const targets = [
        { id: '1', name: 'SharedFramework', productType: 'com.apple.product-type.framework', buildConfigurationListId: 'a' },
        { id: '2', name: 'MyApp', productType: 'com.apple.product-type.application', buildConfigurationListId: 'b' },
      ];

      const main = getMainAppTarget(targets);

      expect(main?.name).toBe('MyApp');
    });

    it('should prefer name matching project name when multiple apps exist', () => {
      const targets = [
        { id: '1', name: 'SampleApp', productType: 'com.apple.product-type.application', buildConfigurationListId: 'a' },
        { id: '2', name: 'MyApp', productType: 'com.apple.product-type.application', buildConfigurationListId: 'b' },
      ];

      const main = getMainAppTarget(targets, 'MyApp');

      expect(main?.name).toBe('MyApp');
    });

    it('should prefer shorter name when no project name provided (less likely to be Tests)', () => {
      const targets = [
        { id: '1', name: 'MyAppTests', productType: 'com.apple.product-type.application', buildConfigurationListId: 'a' },
        { id: '2', name: 'MyApp', productType: 'com.apple.product-type.application', buildConfigurationListId: 'b' },
      ];

      const main = getMainAppTarget(targets);

      expect(main?.name).toBe('MyApp');
    });

    it('should return undefined for empty targets', () => {
      const main = getMainAppTarget([]);
      expect(main).toBeUndefined();
    });

    it('should work with extension when no app exists', () => {
      const targets = [
        { id: '1', name: 'MyExtension', productType: 'com.apple.product-type.app-extension', buildConfigurationListId: 'a' },
        { id: '2', name: 'MyTests', productType: 'com.apple.product-type.bundle.unit-test', buildConfigurationListId: 'b' },
      ];

      const main = getMainAppTarget(targets);

      expect(main?.name).toBe('MyExtension');
    });
  });

  describe('getProductTypePriority', () => {
    it('should return highest priority for applications', () => {
      const appPriority = getProductTypePriority(ProductType.Application);
      const testPriority = getProductTypePriority(ProductType.UnitTest);
      const extPriority = getProductTypePriority(ProductType.AppExtension);
      
      expect(appPriority).toBeGreaterThan(extPriority);
      expect(appPriority).toBeGreaterThan(testPriority);
    });

    it('should return 0 for unknown types', () => {
      expect(getProductTypePriority('com.apple.unknown')).toBe(0);
    });
  });

  describe('isApplicationType', () => {
    it('should return true for application types', () => {
      expect(isApplicationType(ProductType.Application)).toBe(true);
      expect(isApplicationType(ProductType.ApplicationOnDemandInstall)).toBe(true);
    });

    it('should return false for non-application types', () => {
      expect(isApplicationType(ProductType.AppExtension)).toBe(false);
      expect(isApplicationType(ProductType.UnitTest)).toBe(false);
      expect(isApplicationType(ProductType.Framework)).toBe(false);
    });
  });

  describe('isTestType', () => {
    it('should return true for test types', () => {
      expect(isTestType(ProductType.UnitTest)).toBe(true);
      expect(isTestType(ProductType.UITest)).toBe(true);
    });

    it('should return false for non-test types', () => {
      expect(isTestType(ProductType.Application)).toBe(false);
      expect(isTestType(ProductType.AppExtension)).toBe(false);
    });
  });

  describe('normalizeXcodePath', () => {
    it('should remove $(SRCROOT)/ prefix', () => {
      expect(normalizeXcodePath('$(SRCROOT)/MyApp/Info.plist')).toBe('MyApp/Info.plist');
    });

    it('should remove ${SRCROOT}/ prefix', () => {
      expect(normalizeXcodePath('${SRCROOT}/MyApp/Info.plist')).toBe('MyApp/Info.plist');
    });

    it('should remove $(PROJECT_DIR)/ prefix', () => {
      expect(normalizeXcodePath('$(PROJECT_DIR)/Info.plist')).toBe('Info.plist');
    });

    it('should replace $(TARGET_NAME) with context value', () => {
      expect(normalizeXcodePath('$(TARGET_NAME)/Info.plist', { targetName: 'MyApp' }))
        .toBe('MyApp/Info.plist');
    });

    it('should replace $(PRODUCT_NAME) with context value', () => {
      expect(normalizeXcodePath('$(PRODUCT_NAME).entitlements', { productName: 'MyApp' }))
        .toBe('MyApp.entitlements');
    });

    it('should handle paths without variables', () => {
      expect(normalizeXcodePath('MyApp/Info.plist')).toBe('MyApp/Info.plist');
    });

    it('should clean up double slashes', () => {
      expect(normalizeXcodePath('$(SRCROOT)//Info.plist')).toBe('Info.plist');
    });
  });

  describe('parseBuildConfigurations', () => {
    it('should parse Debug and Release configs', () => {
      const content = `
/* Begin XCBuildConfiguration section */
    A1A1A1A1A1A1A1A1A1A1A1A1 /* Debug */ = {
      isa = XCBuildConfiguration;
      buildSettings = {
        INFOPLIST_FILE = "MyApp/Info-Debug.plist";
        PRODUCT_NAME = "$(TARGET_NAME)";
      };
      name = Debug;
    };
    B2B2B2B2B2B2B2B2B2B2B2B2 /* Release */ = {
      isa = XCBuildConfiguration;
      buildSettings = {
        INFOPLIST_FILE = "MyApp/Info.plist";
        CODE_SIGN_ENTITLEMENTS = "MyApp/MyApp.entitlements";
      };
      name = Release;
    };
/* End XCBuildConfiguration section */`;

      const configs = parseBuildConfigurations(content);

      expect(configs.size).toBe(2);
      
      const debug = configs.get('A1A1A1A1A1A1A1A1A1A1A1A1');
      expect(debug?.name).toBe('Debug');
      expect(debug?.buildSettings.INFOPLIST_FILE).toBe('MyApp/Info-Debug.plist');
      
      const release = configs.get('B2B2B2B2B2B2B2B2B2B2B2B2');
      expect(release?.name).toBe('Release');
      expect(release?.buildSettings.CODE_SIGN_ENTITLEMENTS).toBe('MyApp/MyApp.entitlements');
    });
  });

  describe('parseConfigurationLists', () => {
    it('should parse configuration list with build config IDs', () => {
      const content = `
/* Begin XCConfigurationList section */
    C1C1C1C1C1C1C1C1C1C1C1C1 /* Build configuration list for PBXNativeTarget "MyApp" */ = {
      isa = XCConfigurationList;
      buildConfigurations = (
        A1A1A1A1A1A1A1A1A1A1A1A1 /* Debug */,
        B2B2B2B2B2B2B2B2B2B2B2B2 /* Release */,
      );
      defaultConfigurationIsVisible = 0;
      defaultConfigurationName = Release;
    };
/* End XCConfigurationList section */`;

      const lists = parseConfigurationLists(content);

      expect(lists.size).toBe(1);
      const list = lists.get('C1C1C1C1C1C1C1C1C1C1C1C1');
      expect(list?.buildConfigurationIds).toEqual([
        'A1A1A1A1A1A1A1A1A1A1A1A1',
        'B2B2B2B2B2B2B2B2B2B2B2B2',
      ]);
    });
  });

  describe('getTargetBuildSettings', () => {
    it('should prefer Release config when preferRelease is true', () => {
      const content = `
/* Begin XCBuildConfiguration section */
    A1A1A1A1A1A1A1A1A1A1A1A1 /* Debug */ = {
      isa = XCBuildConfiguration;
      buildSettings = {
        INFOPLIST_FILE = "MyApp/Info-Debug.plist";
      };
      name = Debug;
    };
    B2B2B2B2B2B2B2B2B2B2B2B2 /* Release */ = {
      isa = XCBuildConfiguration;
      buildSettings = {
        INFOPLIST_FILE = "MyApp/Info.plist";
      };
      name = Release;
    };
/* End XCBuildConfiguration section */
/* Begin XCConfigurationList section */
    C1C1C1C1C1C1C1C1C1C1C1C1 /* Build configuration list */ = {
      isa = XCConfigurationList;
      buildConfigurations = (
        A1A1A1A1A1A1A1A1A1A1A1A1 /* Debug */,
        B2B2B2B2B2B2B2B2B2B2B2B2 /* Release */,
      );
    };
/* End XCConfigurationList section */`;

      const target = {
        id: 'X',
        name: 'MyApp',
        productType: 'com.apple.product-type.application',
        buildConfigurationListId: 'C1C1C1C1C1C1C1C1C1C1C1C1',
      };

      const settings = getTargetBuildSettings(content, target, true);

      expect(settings.configName).toBe('Release');
      expect(settings.infoPlistPath).toBe('MyApp/Info.plist');
    });

    it('should prefer Debug config when preferRelease is false', () => {
      const content = `
/* Begin XCBuildConfiguration section */
    A1A1A1A1A1A1A1A1A1A1A1A1 /* Debug */ = {
      isa = XCBuildConfiguration;
      buildSettings = {
        INFOPLIST_FILE = "MyApp/Info-Debug.plist";
      };
      name = Debug;
    };
    B2B2B2B2B2B2B2B2B2B2B2B2 /* Release */ = {
      isa = XCBuildConfiguration;
      buildSettings = {
        INFOPLIST_FILE = "MyApp/Info.plist";
      };
      name = Release;
    };
/* End XCBuildConfiguration section */
/* Begin XCConfigurationList section */
    C1C1C1C1C1C1C1C1C1C1C1C1 /* Build configuration list */ = {
      isa = XCConfigurationList;
      buildConfigurations = (
        A1A1A1A1A1A1A1A1A1A1A1A1 /* Debug */,
        B2B2B2B2B2B2B2B2B2B2B2B2 /* Release */,
      );
    };
/* End XCConfigurationList section */`;

      const target = {
        id: 'X',
        name: 'MyApp',
        productType: 'com.apple.product-type.application',
        buildConfigurationListId: 'C1C1C1C1C1C1C1C1C1C1C1C1',
      };

      const settings = getTargetBuildSettings(content, target, false);

      expect(settings.configName).toBe('Debug');
      expect(settings.infoPlistPath).toBe('MyApp/Info-Debug.plist');
    });

    it('should fall back to Debug if only Debug config exists', () => {
      const content = `
/* Begin XCBuildConfiguration section */
    A1A1A1A1A1A1A1A1A1A1A1A1 /* Debug */ = {
      isa = XCBuildConfiguration;
      buildSettings = {
        INFOPLIST_FILE = "MyApp/Info.plist";
      };
      name = Debug;
    };
/* End XCBuildConfiguration section */
/* Begin XCConfigurationList section */
    C1C1C1C1C1C1C1C1C1C1C1C1 /* Build configuration list */ = {
      isa = XCConfigurationList;
      buildConfigurations = (
        A1A1A1A1A1A1A1A1A1A1A1A1 /* Debug */,
      );
    };
/* End XCConfigurationList section */`;

      const target = {
        id: 'X',
        name: 'MyApp',
        productType: 'com.apple.product-type.application',
        buildConfigurationListId: 'C1C1C1C1C1C1C1C1C1C1C1C1',
      };

      const settings = getTargetBuildSettings(content, target, true);

      expect(settings.configName).toBe('Debug');
    });
  });

  describe('getMainTargetArtifacts', () => {
    it('should extract artifacts from main app target in multi-target project', () => {
      // This is the P1 scenario: app + extension + tests
      const content = `
/* Begin PBXNativeTarget section */
    111111111111111111111111 /* MyAppExtension */ = {
      isa = PBXNativeTarget;
      buildConfigurationList = AAAAAAAAAAAAAAAAAAAAAAAA;
      name = MyAppExtension;
      productType = "com.apple.product-type.app-extension";
    };
    222222222222222222222222 /* MyAppTests */ = {
      isa = PBXNativeTarget;
      buildConfigurationList = BBBBBBBBBBBBBBBBBBBBBBBB;
      name = MyAppTests;
      productType = "com.apple.product-type.bundle.unit-test";
    };
    333333333333333333333333 /* MyApp */ = {
      isa = PBXNativeTarget;
      buildConfigurationList = CCCCCCCCCCCCCCCCCCCCCCCC;
      name = MyApp;
      productType = "com.apple.product-type.application";
    };
/* End PBXNativeTarget section */
/* Begin XCBuildConfiguration section */
    D1D1D1D1D1D1D1D1D1D1D1D1 /* Release */ = {
      isa = XCBuildConfiguration;
      buildSettings = {
        INFOPLIST_FILE = "Extension/Info.plist";
      };
      name = Release;
    };
    E2E2E2E2E2E2E2E2E2E2E2E2 /* Release */ = {
      isa = XCBuildConfiguration;
      buildSettings = {
        INFOPLIST_FILE = "Tests/Info.plist";
      };
      name = Release;
    };
    F3F3F3F3F3F3F3F3F3F3F3F3 /* Release */ = {
      isa = XCBuildConfiguration;
      buildSettings = {
        INFOPLIST_FILE = "MyApp/Info.plist";
        CODE_SIGN_ENTITLEMENTS = "MyApp/MyApp.entitlements";
      };
      name = Release;
    };
/* End XCBuildConfiguration section */
/* Begin XCConfigurationList section */
    AAAAAAAAAAAAAAAAAAAAAAAA /* Extension */ = {
      isa = XCConfigurationList;
      buildConfigurations = (
        D1D1D1D1D1D1D1D1D1D1D1D1 /* Release */,
      );
    };
    BBBBBBBBBBBBBBBBBBBBBBBB /* Tests */ = {
      isa = XCConfigurationList;
      buildConfigurations = (
        E2E2E2E2E2E2E2E2E2E2E2E2 /* Release */,
      );
    };
    CCCCCCCCCCCCCCCCCCCCCCCC /* App */ = {
      isa = XCConfigurationList;
      buildConfigurations = (
        F3F3F3F3F3F3F3F3F3F3F3F3 /* Release */,
      );
    };
/* End XCConfigurationList section */`;

      const result = getMainTargetArtifacts(content, 'MyApp');

      expect(result.target?.name).toBe('MyApp');
      expect(result.settings.infoPlistPath).toBe('MyApp/Info.plist');
      expect(result.settings.entitlementsPath).toBe('MyApp/MyApp.entitlements');
    });
  });

  describe('P2 Fix: App names containing "test"', () => {
    it('should NOT skip apps named "Contest", "Latest", "BestApp" etc', () => {
      // These are real app names that contain "test" as a substring
      // but are NOT test targets
      const targets = [
        { id: '1', name: 'ContestApp', productType: 'com.apple.product-type.application', buildConfigurationListId: 'a' },
        { id: '2', name: 'LatestNews', productType: 'com.apple.product-type.application', buildConfigurationListId: 'b' },
        { id: '3', name: 'BestAppTests', productType: 'com.apple.product-type.bundle.unit-test', buildConfigurationListId: 'c' },
      ];

      const main = getMainAppTarget(targets);

      // Should pick an application, not the test target
      expect(main?.productType).toBe('com.apple.product-type.application');
      // Both apps are valid - productType-based selection doesn't incorrectly filter them
      expect(['ContestApp', 'LatestNews']).toContain(main?.name);
    });

    it('should identify real test targets by productType, not name', () => {
      const targets = [
        { id: '1', name: 'NotATest', productType: 'com.apple.product-type.bundle.unit-test', buildConfigurationListId: 'a' },
        { id: '2', name: 'TestApp', productType: 'com.apple.product-type.application', buildConfigurationListId: 'b' },
      ];

      const main = getMainAppTarget(targets);

      // TestApp is an application (by productType), so it should be selected
      expect(main?.name).toBe('TestApp');
    });
  });

  describe('Integration: Full pbxproj parsing', () => {
    it('should handle real-world pbxproj structure', () => {
      // Simulates a real Xcode project with typical structure
      const projectDir = path.join(tempDir, 'MyApp');
      const xcodeprojDir = path.join(projectDir, 'MyApp.xcodeproj');
      fs.mkdirSync(xcodeprojDir, { recursive: true });
      
      // Create Info.plist
      fs.mkdirSync(path.join(projectDir, 'MyApp'), { recursive: true });
      fs.writeFileSync(path.join(projectDir, 'MyApp', 'Info.plist'), '<?xml version="1.0"?>');
      
      // Create entitlements
      fs.writeFileSync(path.join(projectDir, 'MyApp', 'MyApp.entitlements'), '<?xml version="1.0"?>');
      
      // Create realistic pbxproj
      const pbxprojContent = `// !$*UTF8*$!
{
  archiveVersion = 1;
  objectVersion = 56;
  objects = {
/* Begin PBXNativeTarget section */
    111111111111111111111111 /* MyAppTests */ = {
      isa = PBXNativeTarget;
      buildConfigurationList = AAAAAAAAAAAAAAAAAAAAAAAA;
      name = MyAppTests;
      productType = "com.apple.product-type.bundle.unit-test";
    };
    222222222222222222222222 /* MyApp */ = {
      isa = PBXNativeTarget;
      buildConfigurationList = BBBBBBBBBBBBBBBBBBBBBBBB;
      name = MyApp;
      productType = "com.apple.product-type.application";
    };
/* End PBXNativeTarget section */
/* Begin XCBuildConfiguration section */
    CCCCCCCCCCCCCCCCCCCCCCCC /* Debug */ = {
      isa = XCBuildConfiguration;
      buildSettings = {
        INFOPLIST_FILE = "Tests/Info.plist";
      };
      name = Debug;
    };
    DDDDDDDDDDDDDDDDDDDDDDDD /* Release */ = {
      isa = XCBuildConfiguration;
      buildSettings = {
        INFOPLIST_FILE = "Tests/Info.plist";
      };
      name = Release;
    };
    EEEEEEEEEEEEEEEEEEEEEEEE /* Debug */ = {
      isa = XCBuildConfiguration;
      buildSettings = {
        INFOPLIST_FILE = "MyApp/Info.plist";
        CODE_SIGN_ENTITLEMENTS = "MyApp/MyApp.entitlements";
      };
      name = Debug;
    };
    FFFFFFFFFFFFFFFFFFFFFFFF /* Release */ = {
      isa = XCBuildConfiguration;
      buildSettings = {
        INFOPLIST_FILE = "MyApp/Info.plist";
        CODE_SIGN_ENTITLEMENTS = "MyApp/MyApp.entitlements";
      };
      name = Release;
    };
/* End XCBuildConfiguration section */
/* Begin XCConfigurationList section */
    AAAAAAAAAAAAAAAAAAAAAAAA /* Tests */ = {
      isa = XCConfigurationList;
      buildConfigurations = (
        CCCCCCCCCCCCCCCCCCCCCCCC /* Debug */,
        DDDDDDDDDDDDDDDDDDDDDDDD /* Release */,
      );
    };
    BBBBBBBBBBBBBBBBBBBBBBBB /* App */ = {
      isa = XCConfigurationList;
      buildConfigurations = (
        EEEEEEEEEEEEEEEEEEEEEEEE /* Debug */,
        FFFFFFFFFFFFFFFFFFFFFFFF /* Release */,
      );
    };
/* End XCConfigurationList section */
  };
}`;
      fs.writeFileSync(path.join(xcodeprojDir, 'project.pbxproj'), pbxprojContent);

      const result = getMainTargetArtifacts(pbxprojContent, 'MyApp', projectDir);

      expect(result.target?.name).toBe('MyApp');
      expect(result.target?.productType).toBe('com.apple.product-type.application');
      expect(result.infoPlistPath).toBe(path.join(projectDir, 'MyApp', 'Info.plist'));
      expect(result.entitlementsPath).toBe(path.join(projectDir, 'MyApp', 'MyApp.entitlements'));
    });
  });

  describe('Multi-app workspace scenarios', () => {
    it('should select correct app when multiple apps exist', () => {
      // Workspace with two real apps: MyApp and SampleApp
      const targets = [
        { id: '1', name: 'SampleApp', productType: 'com.apple.product-type.application', buildConfigurationListId: 'a' },
        { id: '2', name: 'MyApp', productType: 'com.apple.product-type.application', buildConfigurationListId: 'b' },
        { id: '3', name: 'SharedFramework', productType: 'com.apple.product-type.framework', buildConfigurationListId: 'c' },
      ];

      // When project name is provided, prefer matching name
      const mainWithHint = getMainAppTarget(targets, 'MyApp');
      expect(mainWithHint?.name).toBe('MyApp');

      // When no project name, prefer shorter name (less likely to be sample)
      const mainNoHint = getMainAppTarget(targets);
      expect(mainNoHint?.name).toBe('MyApp');
    });
  });
});
