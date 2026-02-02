/**
 * Tests for ThirdPartyLoginNoSIWARule
 */
import { ThirdPartyLoginNoSIWARule } from '../../src/rules/auth/third-party-login-no-siwa';
import { createContextObject } from '../../src/parsers/project-parser';
import { Severity, Confidence, DependencySource } from '../../src/types';

describe('ThirdPartyLoginNoSIWARule', () => {
  it('should return no findings when no social login SDK is present', async () => {
    const context = createContextObject(
      '/test/project',
      { CFBundleIdentifier: 'com.example.app' },
      {},
      new Set(['UIKit']),
      [
        { name: 'Alamofire', version: '5.6.4', source: DependencySource.CocoaPods },
      ]
    );

    const findings = await ThirdPartyLoginNoSIWARule.evaluate(context);
    
    expect(findings).toEqual([]);
  });

  it('should find missing SIWA when Google Sign-In is present', async () => {
    const context = createContextObject(
      '/test/project',
      { CFBundleIdentifier: 'com.example.app' },
      {},
      new Set(['UIKit']),
      [
        { name: 'GoogleSignIn', version: '6.0.0', source: DependencySource.CocoaPods },
      ]
    );

    const findings = await ThirdPartyLoginNoSIWARule.evaluate(context);
    
    expect(findings).toHaveLength(1);
    expect(findings[0].ruleId).toBe('auth-001-third-party-login-no-siwa');
    expect(findings[0].severity).toBe(Severity.Critical);
    expect(findings[0].confidence).toBe(Confidence.High);
  });

  it('should find missing SIWA when Facebook Login is present', async () => {
    const context = createContextObject(
      '/test/project',
      { CFBundleIdentifier: 'com.example.app' },
      {},
      new Set(['UIKit']),
      [
        { name: 'FBSDKLoginKit', version: '14.0.0', source: DependencySource.CocoaPods },
      ]
    );

    const findings = await ThirdPartyLoginNoSIWARule.evaluate(context);
    
    expect(findings).toHaveLength(1);
  });

  it('should return no findings when SIWA entitlement is present', async () => {
    const context = createContextObject(
      '/test/project',
      { CFBundleIdentifier: 'com.example.app' },
      { 'com.apple.developer.applesignin': ['Default'] },
      new Set(['UIKit', 'AuthenticationServices']),
      [
        { name: 'GoogleSignIn', version: '6.0.0', source: DependencySource.CocoaPods },
      ]
    );

    const findings = await ThirdPartyLoginNoSIWARule.evaluate(context);
    
    expect(findings).toEqual([]);
  });

  it('should warn about missing AuthenticationServices when SIWA entitlement exists', async () => {
    const context = createContextObject(
      '/test/project',
      { CFBundleIdentifier: 'com.example.app' },
      { 'com.apple.developer.applesignin': ['Default'] },
      new Set(['UIKit']),  // No AuthenticationServices
      [
        { name: 'GoogleSignIn', version: '6.0.0', source: DependencySource.CocoaPods },
      ]
    );

    const findings = await ThirdPartyLoginNoSIWARule.evaluate(context);
    
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe(Severity.Medium);
    expect(findings[0].title).toBe('Sign in with Apple May Not Be Implemented');
  });

  it('should have lower confidence for Firebase Auth only', async () => {
    const context = createContextObject(
      '/test/project',
      { CFBundleIdentifier: 'com.example.app' },
      {},
      new Set(['UIKit']),
      [
        { name: 'FirebaseAuth', version: '10.0.0', source: DependencySource.CocoaPods },
      ]
    );

    const findings = await ThirdPartyLoginNoSIWARule.evaluate(context);
    
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe(Severity.Medium);
    expect(findings[0].confidence).toBe(Confidence.Medium);
    expect(findings[0].title).toBe('Potential Social Login Without Sign in with Apple');
  });
});
