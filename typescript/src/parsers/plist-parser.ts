/**
 * Parser for Info.plist files
 */
import * as fs from 'fs';
import plist from 'plist';
import type { ParsedInfoPlist } from '../types/index.js';

/**
 * Parses an Info.plist file at the given path
 */
export function parsePlist(filePath: string): Record<string, unknown> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Info.plist not found at: ${filePath}`);
  }
  
  const content = fs.readFileSync(filePath, 'utf-8');
  
  try {
    const parsed = plist.parse(content);
    if (typeof parsed !== 'object' || parsed === null) {
      throw new Error('Root is not a dictionary');
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    throw new Error(`Invalid Info.plist format at ${filePath}: ${error}`);
  }
}

/**
 * Parses Info.plist from a string
 */
export function parsePlistString(content: string): Record<string, unknown> {
  try {
    const parsed = plist.parse(content);
    if (typeof parsed !== 'object' || parsed === null) {
      throw new Error('Root is not a dictionary');
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    throw new Error(`Invalid plist format: ${error}`);
  }
}

/**
 * Parses Info.plist and returns structured data
 */
export function parseStructuredPlist(filePath: string): ParsedInfoPlist {
  const raw = parsePlist(filePath);
  return structurePlistData(raw);
}

/**
 * Converts raw plist dict to structured format
 */
export function structurePlistData(raw: Record<string, unknown>): ParsedInfoPlist {
  const usageDescriptions: Record<string, string> = {};
  
  for (const [key, value] of Object.entries(raw)) {
    if (key.startsWith('NS') && key.endsWith('UsageDescription')) {
      if (typeof value === 'string') {
        usageDescriptions[key] = value;
      }
    }
  }
  
  return {
    bundleIdentifier: raw['CFBundleIdentifier'] as string | undefined,
    displayName: (raw['CFBundleDisplayName'] as string) || (raw['CFBundleName'] as string),
    bundleName: raw['CFBundleName'] as string | undefined,
    minimumOSVersion: raw['MinimumOSVersion'] as string | undefined,
    requiredDeviceCapabilities: (raw['UIRequiredDeviceCapabilities'] as string[]) || [],
    backgroundModes: (raw['UIBackgroundModes'] as string[]) || [],
    usageDescriptions,
    raw,
  };
}

/**
 * Known usage description keys and their associated frameworks
 */
export const knownUsageDescriptionKeys: Record<string, string[]> = {
  'NSCameraUsageDescription': ['AVFoundation', 'UIImagePickerController'],
  'NSMicrophoneUsageDescription': ['AVFoundation', 'AVAudioSession'],
  'NSPhotoLibraryUsageDescription': ['PhotosUI', 'Photos', 'UIImagePickerController'],
  'NSPhotoLibraryAddUsageDescription': ['PhotosUI', 'Photos'],
  'NSLocationWhenInUseUsageDescription': ['CoreLocation'],
  'NSLocationAlwaysUsageDescription': ['CoreLocation'],
  'NSLocationAlwaysAndWhenInUseUsageDescription': ['CoreLocation'],
  'NSContactsUsageDescription': ['Contacts', 'ContactsUI'],
  'NSCalendarsUsageDescription': ['EventKit', 'EventKitUI'],
  'NSRemindersUsageDescription': ['EventKit'],
  'NSBluetoothAlwaysUsageDescription': ['CoreBluetooth'],
  'NSBluetoothPeripheralUsageDescription': ['CoreBluetooth'],
  'NSHealthShareUsageDescription': ['HealthKit'],
  'NSHealthUpdateUsageDescription': ['HealthKit'],
  'NSMotionUsageDescription': ['CoreMotion'],
  'NSSpeechRecognitionUsageDescription': ['Speech'],
  'NSFaceIDUsageDescription': ['LocalAuthentication'],
  'NSHomeKitUsageDescription': ['HomeKit'],
  'NSSiriUsageDescription': ['Intents'],
  'NSAppleMusicUsageDescription': ['MediaPlayer', 'StoreKit'],
  'NSUserTrackingUsageDescription': ['AppTrackingTransparency'],
};

/**
 * Checks if a usage description appears to be a placeholder
 */
export function isPlaceholder(value: string): boolean {
  // Localized strings from InfoPlist.strings are not placeholders
  if (value === '[localized in InfoPlist.strings]') {
    return false;
  }

  const lowercased = value.toLowerCase().trim();
  
  // Empty or very short (less than 20 chars is too generic)
  if (lowercased.length < 20) {
    return true;
  }
  
  // Obvious placeholder patterns - always flag these
  // Use word boundary regex to avoid false positives (e.g., "Mastodon" matching "todo")
  const obviousPlaceholderPatterns = [
    /lorem ipsum/,
    /\btodo\b/,
    /\bfixme\b/,
    /\bplaceholder\b/,
    /description here/,
    /add description/,
    /\bxxx\b/,
    /^\.\.\.$/,
  ];
  
  if (obviousPlaceholderPatterns.some(p => p.test(lowercased))) {
    return true;
  }
  
  // Generic patterns that need context check
  // "This app needs camera" = bad, "This app uses the camera to scan QR codes" = good
  const genericStarters = ['your app', 'this app', 'testing', 'test '];
  const hasGenericStarter = genericStarters.some(p => lowercased.includes(p));
  
  if (hasGenericStarter) {
    // If it's short or doesn't explain WHY, it's a placeholder
    // Good descriptions usually have 40+ chars and explain the purpose
    const explainsPurpose = lowercased.length >= 40 && 
      (lowercased.includes(' to ') || lowercased.includes(' for ') || 
       lowercased.includes(' so ') || lowercased.includes(' in order to'));
    return !explainsPurpose;
  }
  
  return false;
}
