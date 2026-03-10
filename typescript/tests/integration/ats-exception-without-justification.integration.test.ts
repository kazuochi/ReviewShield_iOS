/**
 * Integration test: ATS Exception Without Justification
 *
 * Tests the config-001-ats-exception-without-justification rule which detects
 * insecure App Transport Security configurations in Info.plist.
 */
import { FixtureBuilder } from '../helpers/fixture-builder';
import { withFixture, runScan, hasFinding, hasNoFinding } from '../helpers/integration-runner';

const RULE_ID = 'config-001-ats-exception-without-justification';

describe('Integration: ATS Exception Without Justification', () => {
  // ── Positive cases: should flag ──────────────────────────────────────────

  it('should flag NSAllowsArbitraryLoads=true without exception domains', async () => {
    await withFixture(async (tmpDir) => {
      const fixture = new FixtureBuilder('ATSInsecureApp')
        .withInfoPlistKey('ITSAppUsesNonExemptEncryption', false)
        .withInfoPlistKey('NSAppTransportSecurity', {
          NSAllowsArbitraryLoads: true,
        })
        .withPrivacyManifest()
        .build(tmpDir);

      const result = await runScan(fixture.projectDir);

      expect(hasFinding(result, RULE_ID)).toBe(true);
      const finding = result.findings.find((f) => f.ruleId === RULE_ID)!;
      expect(finding.title).toContain('Arbitrary Loads Enabled');
    });
  });

  it('should flag redundant config: NSAllowsArbitraryLoads=true WITH exception domains', async () => {
    await withFixture(async (tmpDir) => {
      const fixture = new FixtureBuilder('ATSRedundantApp')
        .withInfoPlistKey('ITSAppUsesNonExemptEncryption', false)
        .withInfoPlistKey('NSAppTransportSecurity', {
          NSAllowsArbitraryLoads: true,
          NSExceptionDomains: {
            'api.example.com': {
              NSExceptionAllowsInsecureHTTPLoads: true,
            },
          },
        })
        .withPrivacyManifest()
        .build(tmpDir);

      const result = await runScan(fixture.projectDir);

      expect(hasFinding(result, RULE_ID)).toBe(true);
      const finding = result.findings.find((f) => f.ruleId === RULE_ID)!;
      expect(finding.title).toContain('Redundant ATS Configuration');
    });
  });

  it('should flag NSAllowsArbitraryLoadsInWebContent=true', async () => {
    await withFixture(async (tmpDir) => {
      const fixture = new FixtureBuilder('ATSWebViewApp')
        .withInfoPlistKey('ITSAppUsesNonExemptEncryption', false)
        .withInfoPlistKey('NSAppTransportSecurity', {
          NSAllowsArbitraryLoadsInWebContent: true,
        })
        .withPrivacyManifest()
        .build(tmpDir);

      const result = await runScan(fixture.projectDir);

      expect(hasFinding(result, RULE_ID)).toBe(true);
      const finding = result.findings.find((f) => f.ruleId === RULE_ID)!;
      expect(finding.title).toContain('ATS Disabled for Web Content');
    });
  });

  it('should flag exception domain with insecure HTTP but no minimum TLS version', async () => {
    await withFixture(async (tmpDir) => {
      const fixture = new FixtureBuilder('ATSNoTLSApp')
        .withInfoPlistKey('ITSAppUsesNonExemptEncryption', false)
        .withInfoPlistKey('NSAppTransportSecurity', {
          NSExceptionDomains: {
            'legacy-api.example.com': {
              NSExceptionAllowsInsecureHTTPLoads: true,
            },
          },
        })
        .withPrivacyManifest()
        .build(tmpDir);

      const result = await runScan(fixture.projectDir);

      expect(hasFinding(result, RULE_ID)).toBe(true);
      const finding = result.findings.find((f) => f.ruleId === RULE_ID)!;
      expect(finding.title).toContain('Insecure HTTP Allowed for legacy-api.example.com');
    });
  });

  // ── Negative cases: should NOT flag ──────────────────────────────────────

  it('should NOT flag when no ATS configuration exists', async () => {
    await withFixture(async (tmpDir) => {
      const fixture = new FixtureBuilder('NoATSApp')
        .withInfoPlistKey('ITSAppUsesNonExemptEncryption', false)
        .withPrivacyManifest()
        .build(tmpDir);

      const result = await runScan(fixture.projectDir);

      expect(hasNoFinding(result, RULE_ID)).toBe(true);
    });
  });

  it('should NOT flag when NSAllowsArbitraryLoads is false', async () => {
    await withFixture(async (tmpDir) => {
      const fixture = new FixtureBuilder('ATSSecureApp')
        .withInfoPlistKey('ITSAppUsesNonExemptEncryption', false)
        .withInfoPlistKey('NSAppTransportSecurity', {
          NSAllowsArbitraryLoads: false,
        })
        .withPrivacyManifest()
        .build(tmpDir);

      const result = await runScan(fixture.projectDir);

      expect(hasNoFinding(result, RULE_ID)).toBe(true);
    });
  });

  it('should NOT flag exception domain with insecure HTTP AND minimum TLS version', async () => {
    await withFixture(async (tmpDir) => {
      const fixture = new FixtureBuilder('ATSProperExceptionApp')
        .withInfoPlistKey('ITSAppUsesNonExemptEncryption', false)
        .withInfoPlistKey('NSAppTransportSecurity', {
          NSExceptionDomains: {
            'legacy-api.example.com': {
              NSExceptionAllowsInsecureHTTPLoads: true,
              NSExceptionMinimumTLSVersion: 'TLSv1.2',
            },
          },
        })
        .withPrivacyManifest()
        .build(tmpDir);

      const result = await runScan(fixture.projectDir);

      expect(hasNoFinding(result, RULE_ID)).toBe(true);
    });
  });

  it('should NOT flag exception domains with only HTTPS configuration', async () => {
    await withFixture(async (tmpDir) => {
      const fixture = new FixtureBuilder('ATSHttpsOnlyApp')
        .withInfoPlistKey('ITSAppUsesNonExemptEncryption', false)
        .withInfoPlistKey('NSAppTransportSecurity', {
          NSExceptionDomains: {
            'api.example.com': {
              NSExceptionMinimumTLSVersion: 'TLSv1.2',
            },
          },
        })
        .withPrivacyManifest()
        .build(tmpDir);

      const result = await runScan(fixture.projectDir);

      expect(hasNoFinding(result, RULE_ID)).toBe(true);
    });
  });
});
