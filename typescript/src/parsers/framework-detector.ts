/**
 * Utility to detect linked frameworks and dependencies in iOS projects
 */
import * as fs from 'fs';
import * as path from 'path';
import { Dependency, DependencySource } from '../types/index.js';

/**
 * Known tracking SDK patterns for ATT detection
 */
export const trackingSDKPatterns: Array<{ pattern: string; name: string }> = [
  // Facebook/Meta
  { pattern: 'FBSDKCoreKit', name: 'Facebook SDK' },
  { pattern: 'FacebookCore', name: 'Facebook SDK' },
  { pattern: 'FBAudienceNetwork', name: 'Facebook Audience Network' },
  // Google
  { pattern: 'GoogleAnalytics', name: 'Google Analytics' },
  { pattern: 'FirebaseAnalytics', name: 'Firebase Analytics' },
  { pattern: 'Firebase/Analytics', name: 'Firebase Analytics' },
  { pattern: 'Google-Mobile-Ads-SDK', name: 'Google Mobile Ads' },
  { pattern: 'GoogleMobileAds', name: 'Google Mobile Ads' },
  // Attribution/Analytics
  { pattern: 'Adjust', name: 'Adjust' },
  { pattern: 'AppsFlyer', name: 'AppsFlyer' },
  { pattern: 'AppsFlyerFramework', name: 'AppsFlyer' },
  { pattern: 'Branch', name: 'Branch.io' },
  { pattern: 'Amplitude', name: 'Amplitude' },
  { pattern: 'amplitude-ios', name: 'Amplitude' },
  { pattern: 'Mixpanel', name: 'Mixpanel' },
  { pattern: 'Segment', name: 'Segment' },
  { pattern: 'Singular', name: 'Singular' },
  { pattern: 'Kochava', name: 'Kochava' },
  { pattern: 'Tenjin', name: 'Tenjin' },
];

/**
 * Known social login SDK patterns for SIWA detection
 */
export const socialLoginSDKPatterns: Array<{ pattern: string; name: string }> = [
  // Google Sign-In
  { pattern: 'GoogleSignIn', name: 'Google Sign-In' },
  { pattern: 'GIDSignIn', name: 'Google Sign-In' },
  // Facebook Login
  { pattern: 'FBSDKLoginKit', name: 'Facebook Login' },
  { pattern: 'FacebookLogin', name: 'Facebook Login' },
  // Twitter/X
  { pattern: 'TwitterKit', name: 'Twitter Login' },
  // Firebase Auth (may include social)
  { pattern: 'FirebaseAuth', name: 'Firebase Auth' },
  { pattern: 'Firebase/Auth', name: 'Firebase Auth' },
  // Auth0
  { pattern: 'Auth0', name: 'Auth0' },
  // Amazon
  { pattern: 'LoginWithAmazon', name: 'Login with Amazon' },
  // LinkedIn
  { pattern: 'linkedin-sdk', name: 'LinkedIn Login' },
];

/**
 * Location-related frameworks
 */
export const locationFrameworks: Set<string> = new Set([
  'CoreLocation',
  'MapKit',
]);

/**
 * Camera-related frameworks
 */
export const cameraFrameworks: Set<string> = new Set([
  'AVFoundation',
  'AVKit',
  'VisionKit',
]);

/**
 * Parses Podfile.lock to extract CocoaPods dependencies
 */
export function parsePodfileLock(filePath: string): Dependency[] {
  if (!fs.existsSync(filePath)) {
    return [];
  }
  
  const content = fs.readFileSync(filePath, 'utf-8');
  return parsePodfileLockContent(content);
}

/**
 * Parses Podfile.lock content string
 */
export function parsePodfileLockContent(content: string): Dependency[] {
  const dependencies: Dependency[] = [];
  const lines = content.split('\n');
  const seenNames = new Set<string>();
  
  let inPodsSection = false;
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Start of PODS section
    if (trimmed === 'PODS:') {
      inPodsSection = true;
      continue;
    }
    
    // End of PODS section (next top-level key)
    if (inPodsSection && !line.startsWith(' ') && !line.startsWith('\t') && trimmed.endsWith(':')) {
      break;
    }
    
    // Parse pod entry
    if (inPodsSection && line.startsWith('  - ')) {
      const entry = line.slice(4); // Remove "  - "
      
      // Match: "PodName (version)" or "PodName/Subspec (version)"
      const match = entry.match(/^([^\s(]+)\s*\(([^)]+)\)/);
      if (match) {
        const fullName = match[1];
        const version = match[2];
        
        // Get base name (without subspec)
        const baseName = fullName.split('/')[0];
        
        // Add base name if not seen
        if (!seenNames.has(baseName)) {
          seenNames.add(baseName);
          dependencies.push({
            name: baseName,
            version,
            source: DependencySource.CocoaPods,
          });
        }
        
        // Also track the full name for subspec matching
        if (fullName.includes('/') && !seenNames.has(fullName)) {
          seenNames.add(fullName);
          dependencies.push({
            name: fullName,
            version,
            source: DependencySource.CocoaPods,
          });
        }
      }
    }
  }
  
  return dependencies;
}

/**
 * Parses Package.resolved to extract SPM dependencies
 */
export function parsePackageResolved(filePath: string): Dependency[] {
  if (!fs.existsSync(filePath)) {
    return [];
  }
  
  const content = fs.readFileSync(filePath, 'utf-8');
  
  try {
    const json = JSON.parse(content);
    return parsePackageResolvedData(json);
  } catch {
    return [];
  }
}

/**
 * Parses Package.resolved JSON data
 */
export function parsePackageResolvedData(json: Record<string, unknown>): Dependency[] {
  const dependencies: Dependency[] = [];
  
  // Try version 2 format first (newer)
  const pins = json['pins'] as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(pins)) {
    for (const pin of pins) {
      const identity = pin['identity'] as string;
      const state = pin['state'] as Record<string, unknown> | undefined;
      if (identity) {
        dependencies.push({
          name: identity,
          version: state?.['version'] as string | undefined,
          source: DependencySource.SPM,
        });
      }
    }
    return dependencies;
  }
  
  // Try version 1 format (older)
  const object = json['object'] as Record<string, unknown> | undefined;
  const v1Pins = object?.['pins'] as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(v1Pins)) {
    for (const pin of v1Pins) {
      const pkg = pin['package'] as string;
      const state = pin['state'] as Record<string, unknown> | undefined;
      if (pkg) {
        dependencies.push({
          name: pkg,
          version: state?.['version'] as string | undefined,
          source: DependencySource.SPM,
        });
      }
    }
  }
  
  return dependencies;
}

/**
 * Parses project.pbxproj to extract linked frameworks
 */
export function parseProjectFrameworks(filePath: string): Set<string> {
  if (!fs.existsSync(filePath)) {
    return new Set();
  }
  
  const content = fs.readFileSync(filePath, 'utf-8');
  return parseProjectFrameworksContent(content);
}

/**
 * Parses project.pbxproj content to extract linked frameworks
 */
export function parseProjectFrameworksContent(content: string): Set<string> {
  const frameworks = new Set<string>();
  
  // Pattern: Framework file references like "AVFoundation.framework"
  const frameworkPattern = /(\w+)\.framework/g;
  let match;
  
  while ((match = frameworkPattern.exec(content)) !== null) {
    frameworks.add(match[1]);
  }
  
  return frameworks;
}

/**
 * Detects tracking SDKs from a list of dependencies
 */
export function detectTrackingSDKs(dependencies: Dependency[]): string[] {
  const detected: string[] = [];
  
  for (const { pattern, name } of trackingSDKPatterns) {
    const found = dependencies.some(dep => 
      dep.name.toLowerCase().includes(pattern.toLowerCase())
    );
    if (found && !detected.includes(name)) {
      detected.push(name);
    }
  }
  
  return detected;
}

/**
 * Detects social login SDKs from a list of dependencies
 */
export function detectSocialLoginSDKs(dependencies: Dependency[]): string[] {
  const detected: string[] = [];
  
  for (const { pattern, name } of socialLoginSDKPatterns) {
    const found = dependencies.some(dep => 
      dep.name.toLowerCase().includes(pattern.toLowerCase())
    );
    if (found && !detected.includes(name)) {
      detected.push(name);
    }
  }
  
  return detected;
}

/**
 * Loads all dependencies from a project directory
 */
export function loadAllDependencies(projectDir: string): Dependency[] {
  const all: Dependency[] = [];
  
  // Try Podfile.lock
  const podfileLock = path.join(projectDir, 'Podfile.lock');
  all.push(...parsePodfileLock(podfileLock));
  
  // Try Package.resolved in various locations
  const packageResolvedLocations = [
    path.join(projectDir, 'Package.resolved'),
    path.join(projectDir, '.swiftpm', 'Package.resolved'),
  ];
  
  for (const location of packageResolvedLocations) {
    const spmDeps = parsePackageResolved(location);
    if (spmDeps.length > 0) {
      all.push(...spmDeps);
      break;
    }
  }
  
  return all;
}
