/**
 * Rule: Third-Party Login Without Sign in with Apple
 * 
 * Detects when an app includes social login SDKs but doesn't implement
 * Sign in with Apple as an equivalent option.
 * 
 * App Store Review Guideline: 4.8
 */
import type { Rule, Finding, ScanContext } from '../../types/index.js';
import { Severity, Confidence, RuleCategory } from '../../types/index.js';
import { detectSocialLoginSDKs } from '../../parsers/framework-detector.js';
import { EntitlementKeys } from '../../parsers/entitlements-parser.js';
import { makeFinding, makeCustomFinding } from '../base.js';

const AUTH_SERVICES_FRAMEWORK = 'AuthenticationServices';

// SDKs that definitively indicate social login
const DEFINITIVE_SOCIAL_SDKS = ['Google Sign-In', 'Facebook Login', 'Twitter Login', 'Login with Amazon', 'LinkedIn Login'];

// SDKs that may be used for email/password only
const AMBIGUOUS_SDKS = ['Firebase Auth', 'Auth0'];

export const ThirdPartyLoginNoSIWARule: Rule = {
  id: 'auth-001-third-party-login-no-siwa',
  name: 'Third-Party Login Without Sign in with Apple',
  description: 'Checks for social login SDKs without Sign in with Apple implementation',
  category: RuleCategory.Auth,
  severity: Severity.Critical,
  confidence: Confidence.High,
  guidelineReference: '4.8',

  async evaluate(context: ScanContext): Promise<Finding[]> {
    // Detect social login SDKs
    const detectedSDKs = detectSocialLoginSDKs(context.dependencies);
    
    if (detectedSDKs.length === 0) {
      return [];
    }

    // Separate definitive and ambiguous SDKs
    const definitiveSocialSDKs = detectedSDKs.filter(sdk => DEFINITIVE_SOCIAL_SDKS.includes(sdk));
    const ambiguousSDKs = detectedSDKs.filter(sdk => AMBIGUOUS_SDKS.includes(sdk));

    // Check for SIWA capability
    const hasSIWAEntitlement = context.hasEntitlement(EntitlementKeys.signInWithApple);
    
    // Check for AuthenticationServices framework
    const hasAuthServices = context.hasFramework(AUTH_SERVICES_FRAMEWORK);

    const findings: Finding[] = [];

    // If definitive social SDKs are present (Google Sign-In, Facebook Login, etc.)
    if (definitiveSocialSDKs.length > 0) {
      // Case 1: No SIWA entitlement
      if (!hasSIWAEntitlement) {
        findings.push(makeFinding(this, {
          description: `Your app includes third-party social login SDKs (${definitiveSocialSDKs.join(', ')}) ` +
            `but the Sign in with Apple capability is not configured. According to App Store Review ` +
            `Guideline 4.8, apps that offer third-party social login must also offer Sign in with Apple ` +
            `as an equivalent option.`,
          location: 'Entitlements',
          fixGuidance: `Add Sign in with Apple to your app:

1. In Xcode, select your app target → Signing & Capabilities
2. Click "+ Capability" and add "Sign in with Apple"
3. Implement the SIWA UI alongside your existing login options:

import AuthenticationServices

// Add the Apple sign-in button to your login screen
let button = ASAuthorizationAppleIDButton(type: .signIn, style: .black)
button.addTarget(self, action: #selector(handleAppleSignIn), for: .touchUpInside)

@objc func handleAppleSignIn() {
    let provider = ASAuthorizationAppleIDProvider()
    let request = provider.createRequest()
    request.requestedScopes = [.fullName, .email]
    
    let controller = ASAuthorizationController(authorizationRequests: [request])
    controller.delegate = self
    controller.performRequests()
}

Important: Sign in with Apple must be presented as an equivalent option - same ` +
            `prominence as other social login buttons.`,
          documentationURL: 'https://developer.apple.com/sign-in-with-apple/',
        }));
      }
      // Case 2: Has entitlement but no AuthenticationServices framework
      else if (!hasAuthServices) {
        findings.push(makeCustomFinding(this, Severity.Medium, Confidence.Medium, {
          title: 'Sign in with Apple May Not Be Implemented',
          description: `Your app has the Sign in with Apple capability enabled but ` +
            `AuthenticationServices framework doesn't appear to be linked. This may indicate ` +
            `an incomplete SIWA implementation.`,
          location: 'Project',
          fixGuidance: `Ensure you're importing AuthenticationServices and implementing the sign-in flow:

import AuthenticationServices

// Present the sign-in button and handle the flow
// See Apple's documentation for complete implementation

Note: If you're using a third-party library that wraps SIWA, you can ignore ` +
            `this finding.`,
          documentationURL: 'https://developer.apple.com/sign-in-with-apple/',
        }));
      }
    }

    // If only ambiguous SDKs (Firebase Auth, Auth0) - lower confidence
    if (definitiveSocialSDKs.length === 0 && ambiguousSDKs.length > 0 && !hasSIWAEntitlement) {
      findings.push(makeCustomFinding(this, Severity.Medium, Confidence.Medium, {
        title: 'Potential Social Login Without Sign in with Apple',
        description: `Your app includes authentication SDKs (${ambiguousSDKs.join(', ')}) that may ` +
          `be configured for social login. If you offer Google, Facebook, or other social login ` +
          `options, you must also offer Sign in with Apple.`,
        location: 'Entitlements',
        fixGuidance: `Review your authentication implementation:

**If you use social login (Google, Facebook, etc.):**
Add Sign in with Apple capability and implement it as an equivalent option.

**If you only use email/password authentication:**
You're exempt from Guideline 4.8. Sign in with Apple is not required for ` +
          `apps that don't offer third-party social login.

**If using Firebase Auth with social providers:**
Firebase supports Sign in with Apple - add it as a provider:
https://firebase.google.com/docs/auth/ios/apple`,
        documentationURL: 'https://developer.apple.com/sign-in-with-apple/',
      }));
    }

    return findings;
  },
};
