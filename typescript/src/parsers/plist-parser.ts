/**
 * Parser for Info.plist files
 */
import * as fs from 'fs';
import * as path from 'path';
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
  const lowercased = value.toLowerCase().trim();
  
  // Empty or very short
  if (lowercased.length < 10) {
    return true;
  }
  
  // Common placeholder patterns
  const placeholders = [
    'lorem ipsum',
    'todo',
    'fixme',
    'placeholder',
    'description here',
    'add description',
    'your app',
    'this app',
    'test',
    'testing',
    'xxx',
    '...',
  ];
  
  return placeholders.some(p => lowercased.includes(p));
}
