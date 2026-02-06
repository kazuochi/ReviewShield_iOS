/**
 * Rule: ATS Exception Without Justification
 * 
 * Detects when an app disables App Transport Security without proper
 * exception configuration. NSAllowsArbitraryLoads = true is a security
 * risk and commonly flagged during App Store review.
 * 
 * App Store Review Guideline: 2.1 (App Completeness)
 */
import type { Rule, Finding, ScanContext } from '../../types/index.js';
import { Severity, Confidence, RuleCategory } from '../../types/index.js';
import { makeFinding, makeCustomFinding } from '../base.js';

const ATS_KEY = 'NSAppTransportSecurity';
const ALLOWS_ARBITRARY_LOADS_KEY = 'NSAllowsArbitraryLoads';
const ALLOWS_ARBITRARY_LOADS_WEBVIEW_KEY = 'NSAllowsArbitraryLoadsInWebContent';
const EXCEPTION_DOMAINS_KEY = 'NSExceptionDomains';

export const ATSExceptionWithoutJustificationRule: Rule = {
  id: 'config-001-ats-exception-without-justification',
  name: 'ATS Exception Without Justification',
  description: 'Checks for insecure App Transport Security configuration',
  category: RuleCategory.Config,
  severity: Severity.High,
  confidence: Confidence.High,
  guidelineReference: '2.1',

  async evaluate(context: ScanContext): Promise<Finding[]> {
    const atsConfig = context.infoPlist[ATS_KEY] as Record<string, unknown> | undefined;
    
    if (!atsConfig) {
      // No ATS configuration, defaults are secure
      return [];
    }

    const findings: Finding[] = [];
    const location = context.infoPlistPath || 'Info.plist';
    
    const allowsArbitraryLoads = atsConfig[ALLOWS_ARBITRARY_LOADS_KEY] as boolean | undefined;
    const allowsArbitraryLoadsWebView = atsConfig[ALLOWS_ARBITRARY_LOADS_WEBVIEW_KEY] as boolean | undefined;
    const exceptionDomains = atsConfig[EXCEPTION_DOMAINS_KEY] as Record<string, unknown> | undefined;

    // Case 1: NSAllowsArbitraryLoads = true without exception domains
    if (allowsArbitraryLoads === true) {
      const hasExceptionDomains = exceptionDomains && Object.keys(exceptionDomains).length > 0;
      
      if (!hasExceptionDomains) {
        findings.push(makeFinding(this, {
          title: 'Insecure ATS Configuration - Arbitrary Loads Enabled',
          description: `Your app has NSAllowsArbitraryLoads set to true without specifying NSExceptionDomains. ` +
            `This disables App Transport Security for ALL network connections, which is a significant ` +
            `security risk. Apple will require justification during App Store review and may reject ` +
            `your app if there's no valid reason.`,
          location,
          fixGuidance: `Instead of disabling ATS entirely, configure specific exceptions for domains that ` +
            `require HTTP:

OPTION 1: Remove NSAllowsArbitraryLoads entirely (recommended)
Apple strongly recommends using HTTPS for all connections.

OPTION 2: Use targeted exceptions for specific domains
<key>NSAppTransportSecurity</key>
<dict>
    <key>NSExceptionDomains</key>
    <dict>
        <key>legacy-api.example.com</key>
        <dict>
            <key>NSExceptionAllowsInsecureHTTPLoads</key>
            <true/>
            <key>NSExceptionMinimumTLSVersion</key>
            <string>TLSv1.2</string>
        </dict>
    </dict>
</dict>

If you must use NSAllowsArbitraryLoads, you'll need to provide App Store Connect with a justification. ` +
            `Valid reasons include: connecting to servers you don't control, media streaming requirements, ` +
            `or supporting legacy enterprise systems.`,
          documentationURL: 'https://developer.apple.com/documentation/security/preventing_insecure_network_connections',
        }));
      } else {
        // Has exception domains, but also has global disable - unusual config
        findings.push(makeCustomFinding(this, Severity.Medium, Confidence.Medium, {
          title: 'Redundant ATS Configuration',
          description: `Your app has both NSAllowsArbitraryLoads = true AND specific NSExceptionDomains. ` +
            `This is an unusual configuration. If you're using exception domains, you likely don't ` +
            `need NSAllowsArbitraryLoads at all.`,
          location,
          fixGuidance: `Consider removing NSAllowsArbitraryLoads and keeping only NSExceptionDomains for ` +
            `the specific domains that need HTTP access. This provides better security by limiting ` +
            `insecure connections to only the domains you've explicitly allowed.

Current configuration appears redundant:
- NSAllowsArbitraryLoads = true (allows everything)
- NSExceptionDomains configured (allows specific domains)

The exception domains are ignored when NSAllowsArbitraryLoads is true.`,
          documentationURL: 'https://developer.apple.com/documentation/security/preventing_insecure_network_connections',
        }));
      }
    }

    // Case 2: NSAllowsArbitraryLoadsInWebContent = true
    if (allowsArbitraryLoadsWebView === true) {
      findings.push(makeCustomFinding(this, Severity.Medium, Confidence.High, {
        title: 'ATS Disabled for Web Content',
        description: `NSAllowsArbitraryLoadsInWebContent is set to true, allowing web views to load ` +
          `insecure HTTP content. While this is less severe than NSAllowsArbitraryLoads, it still ` +
          `represents a security consideration.`,
        location,
        fixGuidance: `If your app needs to display arbitrary web content (like a browser), this setting ` +
          `may be justified. However, if your web views only load content from known sources, consider:

1. Using NSExceptionDomains for specific domains instead
2. Ensuring your web content servers support HTTPS

<key>NSAppTransportSecurity</key>
<dict>
    <key>NSExceptionDomains</key>
    <dict>
        <key>trusted-content.example.com</key>
        <dict>
            <key>NSExceptionAllowsInsecureHTTPLoads</key>
            <true/>
        </dict>
    </dict>
</dict>`,
        documentationURL: 'https://developer.apple.com/documentation/security/preventing_insecure_network_connections',
      }));
    }

    // Case 3: Check for overly permissive exception domains
    if (exceptionDomains && typeof exceptionDomains === 'object') {
      for (const [domain, config] of Object.entries(exceptionDomains)) {
        const domainConfig = config as Record<string, unknown>;
        
        // Check for wildcard or overly broad domains
        if (domain.startsWith('*') || domain === 'localhost') {
          continue; // Wildcard and localhost are sometimes valid
        }
        
        // Check if exception requires minimum TLS version
        const allowsInsecure = domainConfig['NSExceptionAllowsInsecureHTTPLoads'] as boolean;
        // NSExceptionRequiresForwardSecrecy available in domainConfig if needed
        const minTLS = domainConfig['NSExceptionMinimumTLSVersion'] as string;
        
        if (allowsInsecure === true && !minTLS) {
          findings.push(makeCustomFinding(this, Severity.Low, Confidence.Medium, {
            title: `Insecure HTTP Allowed for ${domain}`,
            description: `Domain "${domain}" allows insecure HTTP connections without specifying ` +
              `a minimum TLS version. Consider if this domain can support HTTPS.`,
            location,
            fixGuidance: `If the server supports TLS, add NSExceptionMinimumTLSVersion:

<key>${domain}</key>
<dict>
    <key>NSExceptionAllowsInsecureHTTPLoads</key>
    <true/>
    <key>NSExceptionMinimumTLSVersion</key>
    <string>TLSv1.2</string>
</dict>

Better yet, work with the server operator to enable HTTPS and remove this exception entirely.`,
            documentationURL: 'https://developer.apple.com/documentation/bundleresources/information_property_list/nsapptransportsecurity/nsexceptiondomains',
          }));
        }
      }
    }

    return findings;
  },
};
