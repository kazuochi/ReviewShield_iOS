/**
 * Integration test: Missing Launch Storyboard
 *
 * A project whose Info.plist is missing UILaunchStoryboardName.
 * Should trigger: config-003-missing-launch-storyboard
 */
import { FixtureBuilder } from '../helpers/fixture-builder';
import { withFixture, runScan, hasFinding, hasNoFinding } from '../helpers/integration-runner';

const RULE_ID = 'config-003-missing-launch-storyboard';

describe('Integration: Missing Launch Storyboard', () => {
  it('should flag a project without UILaunchStoryboardName', async () => {
    await withFixture(async (tmpDir) => {
      // Use generated Info.plist mode without setting launch storyboard keys —
      // no Info.plist file is created, and no INFOPLIST_KEY_UILaunchStoryboardName
      // build setting is set, so the rule should fire.
      const fixture = new FixtureBuilder('NoLaunchStoryboard')
        .withGeneratedInfoPlist()
        .withPrivacyManifest()
        .withInfoPlistKey('ITSAppUsesNonExemptEncryption', false)
        .build(tmpDir);

      const result = await runScan(fixture.projectDir);

      expect(hasFinding(result, RULE_ID)).toBe(true);

      const finding = result.findings.find((f) => f.ruleId === RULE_ID)!;
      expect(finding.description).toContain('UILaunchStoryboardName');
    });
  });

  it('should NOT flag when UILaunchStoryboardName is present in Info.plist', async () => {
    await withFixture(async (tmpDir) => {
      // Default FixtureBuilder includes UILaunchStoryboardName: "LaunchScreen"
      const fixture = new FixtureBuilder('HasLaunchStoryboard')
        .withInfoPlistKey('ITSAppUsesNonExemptEncryption', false)
        .withPrivacyManifest()
        .build(tmpDir);

      const result = await runScan(fixture.projectDir);

      expect(hasNoFinding(result, RULE_ID)).toBe(true);
    });
  });

  it('should NOT flag when UILaunchStoryboardName is empty string (SwiftUI lifecycle)', async () => {
    await withFixture(async (tmpDir) => {
      // SwiftUI apps often use an empty UILaunchStoryboardName
      const fixture = new FixtureBuilder('SwiftUIApp')
        .withInfoPlistKey('UILaunchStoryboardName', '')
        .withInfoPlistKey('ITSAppUsesNonExemptEncryption', false)
        .withPrivacyManifest()
        .build(tmpDir);

      const result = await runScan(fixture.projectDir);

      expect(hasNoFinding(result, RULE_ID)).toBe(true);
    });
  });

  it('should NOT flag when UILaunchScreen generation is configured via build settings', async () => {
    await withFixture(async (tmpDir) => {
      // INFOPLIST_KEY_UILaunchScreen_Generation is the modern Xcode 14+ way
      // to configure UILaunchScreen without a traditional Info.plist entry
      const fixture = new FixtureBuilder('LaunchScreenGeneration')
        .withGeneratedInfoPlist()
        .withBuildSetting('INFOPLIST_KEY_UILaunchScreen_Generation', 'YES')
        .withInfoPlistKey('ITSAppUsesNonExemptEncryption', false)
        .withPrivacyManifest()
        .build(tmpDir);

      const result = await runScan(fixture.projectDir);

      expect(hasNoFinding(result, RULE_ID)).toBe(true);
    });
  });

  it('should NOT flag when launch storyboard is configured via build settings', async () => {
    await withFixture(async (tmpDir) => {
      // Xcode 14+ projects can set the launch storyboard via build settings
      const fixture = new FixtureBuilder('BuildSettingsLaunch')
        .withGeneratedInfoPlist()
        .withBuildSetting('INFOPLIST_KEY_UILaunchStoryboardName', 'LaunchScreen')
        .withInfoPlistKey('ITSAppUsesNonExemptEncryption', false)
        .withPrivacyManifest()
        .build(tmpDir);

      const result = await runScan(fixture.projectDir);

      expect(hasNoFinding(result, RULE_ID)).toBe(true);
    });
  });
});
