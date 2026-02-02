/**
 * Parser for Xcode project structure
 */
import * as fs from 'fs';
import * as path from 'path';
import { parsePlist } from './plist-parser.js';
import { parseEntitlements } from './entitlements-parser.js';
import { parseProjectFrameworks, loadAllDependencies } from './framework-detector.js';
import type { Dependency, ScanContext } from '../types/index.js';

/**
 * Result of project discovery
 */
export interface ProjectDiscovery {
  projectPath: string;
  infoPlistPath?: string;
  entitlementsPath?: string;
  pbxprojPath?: string;
  isWorkspace: boolean;
}

/**
 * Discovers project files in a directory
 */
export function discoverProject(inputPath: string): ProjectDiscovery {
  const stat = fs.statSync(inputPath);
  
  if (stat.isFile() && inputPath.endsWith('.ipa')) {
    throw new Error('IPA scanning is not yet supported. Please extract the IPA and point to the extracted app.');
  }
  
  const basePath = stat.isDirectory() ? inputPath : path.dirname(inputPath);
  
  const discovery: ProjectDiscovery = {
    projectPath: basePath,
    isWorkspace: false,
  };
  
  // Look for xcworkspace or xcodeproj
  const entries = fs.readdirSync(basePath);
  
  for (const entry of entries) {
    const fullPath = path.join(basePath, entry);
    
    if (entry.endsWith('.xcworkspace')) {
      discovery.isWorkspace = true;
    } else if (entry.endsWith('.xcodeproj')) {
      const pbxprojPath = path.join(fullPath, 'project.pbxproj');
      if (fs.existsSync(pbxprojPath)) {
        discovery.pbxprojPath = pbxprojPath;
      }
    }
  }
  
  // Look for Info.plist in common locations
  const infoPlistLocations = [
    path.join(basePath, 'Info.plist'),
    ...entries
      .filter(e => fs.statSync(path.join(basePath, e)).isDirectory())
      .map(e => path.join(basePath, e, 'Info.plist')),
  ];
  
  for (const loc of infoPlistLocations) {
    if (fs.existsSync(loc)) {
      discovery.infoPlistPath = loc;
      break;
    }
  }
  
  // Look for entitlements files
  const entitlementsPatterns = ['*.entitlements', '**/*.entitlements'];
  for (const entry of entries) {
    if (entry.endsWith('.entitlements')) {
      discovery.entitlementsPath = path.join(basePath, entry);
      break;
    }
    
    const fullPath = path.join(basePath, entry);
    if (fs.statSync(fullPath).isDirectory()) {
      const subEntries = fs.readdirSync(fullPath);
      for (const subEntry of subEntries) {
        if (subEntry.endsWith('.entitlements')) {
          discovery.entitlementsPath = path.join(fullPath, subEntry);
          break;
        }
      }
    }
    
    if (discovery.entitlementsPath) break;
  }
  
  return discovery;
}

/**
 * Creates a scan context from discovered project
 */
export function createScanContext(discovery: ProjectDiscovery): ScanContext {
  let infoPlist: Record<string, unknown> = {};
  let entitlements: Record<string, unknown> = {};
  let linkedFrameworks = new Set<string>();
  let dependencies: Dependency[] = [];
  
  // Parse Info.plist
  if (discovery.infoPlistPath) {
    try {
      infoPlist = parsePlist(discovery.infoPlistPath);
    } catch (error) {
      console.warn(`Warning: Could not parse Info.plist: ${error}`);
    }
  }
  
  // Parse entitlements
  if (discovery.entitlementsPath) {
    try {
      entitlements = parseEntitlements(discovery.entitlementsPath);
    } catch (error) {
      console.warn(`Warning: Could not parse entitlements: ${error}`);
    }
  }
  
  // Parse frameworks from pbxproj
  if (discovery.pbxprojPath) {
    try {
      linkedFrameworks = parseProjectFrameworks(discovery.pbxprojPath);
    } catch (error) {
      console.warn(`Warning: Could not parse project frameworks: ${error}`);
    }
  }
  
  // Load dependencies
  try {
    dependencies = loadAllDependencies(discovery.projectPath);
  } catch (error) {
    console.warn(`Warning: Could not load dependencies: ${error}`);
  }
  
  return createContextObject(
    discovery.projectPath,
    infoPlist,
    entitlements,
    linkedFrameworks,
    dependencies
  );
}

/**
 * Creates a ScanContext object with helper methods
 */
export function createContextObject(
  projectPath: string,
  infoPlist: Record<string, unknown>,
  entitlements: Record<string, unknown>,
  linkedFrameworks: Set<string>,
  dependencies: Dependency[]
): ScanContext {
  return {
    projectPath,
    infoPlist,
    entitlements,
    linkedFrameworks,
    dependencies,
    
    plistString(key: string): string | undefined {
      const value = this.infoPlist[key];
      return typeof value === 'string' ? value : undefined;
    },
    
    plistArray(key: string): unknown[] | undefined {
      const value = this.infoPlist[key];
      return Array.isArray(value) ? value : undefined;
    },
    
    plistBool(key: string): boolean | undefined {
      const value = this.infoPlist[key];
      return typeof value === 'boolean' ? value : undefined;
    },
    
    hasPlistKey(key: string): boolean {
      return key in this.infoPlist;
    },
    
    hasFramework(name: string): boolean {
      return this.linkedFrameworks.has(name);
    },
    
    hasEntitlement(key: string): boolean {
      return key in this.entitlements;
    },
    
    entitlementString(key: string): string | undefined {
      const value = this.entitlements[key];
      return typeof value === 'string' ? value : undefined;
    },
    
    entitlementArray(key: string): unknown[] | undefined {
      const value = this.entitlements[key];
      return Array.isArray(value) ? value : undefined;
    },
  };
}
