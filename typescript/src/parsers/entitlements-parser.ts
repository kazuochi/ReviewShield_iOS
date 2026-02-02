/**
 * Parser for entitlements (.entitlements) files
 */
import * as fs from 'fs';
import plist from 'plist';

/**
 * Well-known entitlement keys
 */
export const EntitlementKeys = {
  signInWithApple: 'com.apple.developer.applesignin',
  pushNotifications: 'aps-environment',
  iCloudContainer: 'com.apple.developer.icloud-container-identifiers',
  appGroups: 'com.apple.security.application-groups',
  associatedDomains: 'com.apple.developer.associated-domains',
  healthKit: 'com.apple.developer.healthkit',
  homeKit: 'com.apple.developer.homekit',
  networkExtensions: 'com.apple.developer.networking.networkextension',
} as const;

/**
 * Parses an entitlements file at the given path
 */
export function parseEntitlements(filePath: string): Record<string, unknown> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Entitlements file not found at: ${filePath}`);
  }
  
  const content = fs.readFileSync(filePath, 'utf-8');
  
  try {
    const parsed = plist.parse(content);
    if (typeof parsed !== 'object' || parsed === null) {
      throw new Error('Root is not a dictionary');
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    throw new Error(`Invalid entitlements format at ${filePath}: ${error}`);
  }
}

/**
 * Parses entitlements from a string
 */
export function parseEntitlementsString(content: string): Record<string, unknown> {
  try {
    const parsed = plist.parse(content);
    if (typeof parsed !== 'object' || parsed === null) {
      throw new Error('Root is not a dictionary');
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    throw new Error(`Invalid entitlements format: ${error}`);
  }
}

/**
 * Checks if Sign in with Apple capability is enabled
 */
export function hasSignInWithApple(entitlements: Record<string, unknown>): boolean {
  const siwaValue = entitlements[EntitlementKeys.signInWithApple];
  
  if (Array.isArray(siwaValue)) {
    return siwaValue.includes('Default');
  }
  
  return siwaValue !== undefined && siwaValue !== null;
}
