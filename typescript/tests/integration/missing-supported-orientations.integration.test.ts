/**
 * Integration test: Missing Supported Orientations
 *
 * Tests the metadata-002-missing-supported-orientations rule which detects
 * when UISupportedInterfaceOrientations is missing or empty in Info.plist.
 */
import { FixtureBuilder } from '../helpers/fixture-builder';
import { withFixture, runScan, hasFinding, hasNoFinding } from '../helpers/integration-runner';

const RULE_ID = 'metadata-002-missing-supported-orientations';

describe('Integration: Missing Supported Orientations', () => {
  // ── Positive cases: should flag ──────────────────────────────────────────

  it('should flag when UISupportedInterfaceOrientations is completely missing', async () => {
    await withFixture(async (tmpDir) => {
      // Use generated Info.plist mode without orientation build settings —
      // no Info.plist file is created and no INFOPLIST_KEY_UISupportedInterfaceOrientations*
      // build settings are set, so the rule should fire.
      const fixture = new FixtureBuilder('NoOrientations')
        .withGeneratedInfoPlist()
        .withPrivacyManifest()
        .withInfoPlistKey('ITSAppUsesNonExemptEncryption', false)
        .build(tmpDir);

      const result = await runScan(fixture.projectDir);

      expect(hasFinding(result, RULE_ID)).toBe(true);

      const finding = result.findings.find((f) => f.ruleId === RULE_ID)!;
      expect(finding.description).toContain('UISupportedInterfaceOrientations');
    });
  });

  it('should flag when UISupportedInterfaceOrientations is an empty array', async () => {
    await withFixture(async (tmpDir) => {
      const fixture = new FixtureBuilder('EmptyOrientations')
        .withInfoPlistKey('ITSAppUsesNonExemptEncryption', false)
        .withInfoPlistKey('UISupportedInterfaceOrientations', [])
        .withPrivacyManifest()
        .build(tmpDir);

      const result = await runScan(fixture.projectDir);

      expect(hasFinding(result, RULE_ID)).toBe(true);

      const finding = result.findings.find((f) => f.ruleId === RULE_ID)!;
      expect(finding.title).toContain('Empty Supported Orientations');
    });
  });

  // ── Negative cases: should NOT flag ──────────────────────────────────────

  it('should NOT flag when UISupportedInterfaceOrientations is present in Info.plist', async () => {
    await withFixture(async (tmpDir) => {
      // Default FixtureBuilder includes UISupportedInterfaceOrientations with 3 orientations
      const fixture = new FixtureBuilder('HasOrientations')
        .withInfoPlistKey('ITSAppUsesNonExemptEncryption', false)
        .withPrivacyManifest()
        .build(tmpDir);

      const result = await runScan(fixture.projectDir);

      expect(hasNoFinding(result, RULE_ID)).toBe(true);
    });
  });

  it('should NOT flag when orientation is configured via iPhone build setting', async () => {
    await withFixture(async (tmpDir) => {
      const fixture = new FixtureBuilder('OrientationBuildSetting')
        .withGeneratedInfoPlist()
        .withBuildSetting(
          'INFOPLIST_KEY_UISupportedInterfaceOrientations_iPhone',
          'UIInterfaceOrientationPortrait',
        )
        .withInfoPlistKey('ITSAppUsesNonExemptEncryption', false)
        .withPrivacyManifest()
        .build(tmpDir);

      const result = await runScan(fixture.projectDir);

      expect(hasNoFinding(result, RULE_ID)).toBe(true);
    });
  });

  it('should NOT flag when orientation is configured via iPad build setting', async () => {
    await withFixture(async (tmpDir) => {
      const fixture = new FixtureBuilder('OrientationIPadBuildSetting')
        .withGeneratedInfoPlist()
        .withBuildSetting(
          'INFOPLIST_KEY_UISupportedInterfaceOrientations_iPad',
          'UIInterfaceOrientationPortrait UIInterfaceOrientationLandscapeLeft',
        )
        .withInfoPlistKey('ITSAppUsesNonExemptEncryption', false)
        .withPrivacyManifest()
        .build(tmpDir);

      const result = await runScan(fixture.projectDir);

      expect(hasNoFinding(result, RULE_ID)).toBe(true);
    });
  });

  it('should NOT flag when orientation is configured via generic build setting', async () => {
    await withFixture(async (tmpDir) => {
      const fixture = new FixtureBuilder('OrientationGenericBuildSetting')
        .withGeneratedInfoPlist()
        .withBuildSetting(
          'INFOPLIST_KEY_UISupportedInterfaceOrientations',
          'UIInterfaceOrientationPortrait',
        )
        .withInfoPlistKey('ITSAppUsesNonExemptEncryption', false)
        .withPrivacyManifest()
        .build(tmpDir);

      const result = await runScan(fixture.projectDir);

      expect(hasNoFinding(result, RULE_ID)).toBe(true);
    });
  });
});
