/**
 * Parser for Xcode project structure
 * 
 * P1/P2 Fix: Now parses actual project files instead of relying on directory heuristics.
 * - Workspaces: Parses contents.xcworkspacedata for project references
 * - Projects: Parses project.pbxproj for explicit artifact paths (Info.plist, entitlements)
 * - Uses product type to identify main app target (not name-based heuristics)
 * - Falls back to directory heuristics only when parsing fails
 */
import * as fs from 'fs';
import * as path from 'path';
import { parsePlist } from './plist-parser.js';
import { parseEntitlements } from './entitlements-parser.js';
import { parseProjectFrameworks, loadAllDependencies } from './framework-detector.js';
import { getWorkspaceProjects, parseWorkspaceData } from './workspace-parser.js';
import { getMainTargetArtifacts, normalizeXcodePath } from './pbxproj-parser.js';
import type { Dependency, ScanContext } from '../types/index.js';

/**
 * Result of project discovery
 */
export interface ProjectDiscovery {
  projectPath: string;
  /** P2 FIX: Scoped directory for artifacts (parent of .xcodeproj) to prevent monorepo mixing */
  projectScopeDir?: string;
  infoPlistPath?: string;
  entitlementsPath?: string;
  pbxprojPath?: string;
  isWorkspace: boolean;
  /** P1/P2: All projects found in workspace (when applicable) */
  workspaceProjects?: string[];
}

/**
 * Artifact paths extracted from project.pbxproj
 */
export interface PbxprojArtifacts {
  infoPlistPath?: string;
  entitlementsPath?: string;
  /** The target name these artifacts came from */
  targetName?: string;
}

/**
 * Maximum depth for recursive directory searches
 */
const MAX_SEARCH_DEPTH = 5;

/**
 * Recursively find files matching a pattern
 */
function findFilesRecursive(
  dir: string,
  predicate: (name: string, fullPath: string) => boolean,
  maxDepth: number = MAX_SEARCH_DEPTH,
  currentDepth: number = 0
): string[] {
  if (currentDepth >= maxDepth) return [];
  
  const results: string[] = [];
  
  try {
    const entries = fs.readdirSync(dir);
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry);
      
      // Skip common non-project directories for performance
      if (entry === 'node_modules' || entry === '.git' || entry === 'Pods' || 
          entry === 'build' || entry === 'DerivedData' || entry === '.build') {
        continue;
      }
      
      if (predicate(entry, fullPath)) {
        results.push(fullPath);
      }
      
      // Recurse into directories (but not into .xcodeproj/.xcworkspace bundles)
      try {
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory() && 
            !entry.endsWith('.xcodeproj') && 
            !entry.endsWith('.xcworkspace') &&
            !entry.endsWith('.app') &&
            !entry.endsWith('.framework')) {
          results.push(...findFilesRecursive(fullPath, predicate, maxDepth, currentDepth + 1));
        }
      } catch {
        // Ignore stat errors (permissions, etc.)
      }
    }
  } catch {
    // Ignore readdir errors
  }
  
  return results;
}

/**
 * P1/P2 FIX: Parse project.pbxproj to extract explicit artifact paths
 * 
 * Now uses proper target graph parsing to:
 * 1. Find all PBXNativeTarget entries
 * 2. Select main app target by productType (not name heuristics)
 * 3. Get build settings from the correct target's configuration
 * 4. Handle Xcode path variables properly
 * 
 * @param pbxprojPath Path to project.pbxproj file
 * @param projectDir Directory containing the .xcodeproj
 * @returns Resolved artifact paths
 */
export function parsePbxprojForArtifacts(pbxprojPath: string, projectDir: string): PbxprojArtifacts {
  const result: PbxprojArtifacts = {};
  
  if (!fs.existsSync(pbxprojPath)) {
    return result;
  }
  
  try {
    const content = fs.readFileSync(pbxprojPath, 'utf-8');
    
    // Extract project name from the directory path for target matching
    const projectName = path.basename(path.dirname(pbxprojPath)).replace('.xcodeproj', '');
    
    // Use the new target-aware parsing
    const artifacts = getMainTargetArtifacts(content, projectName, projectDir);
    
    if (artifacts.target) {
      result.targetName = artifacts.target.name;
    }
    
    // Validate paths exist before returning them
    if (artifacts.infoPlistPath && fs.existsSync(artifacts.infoPlistPath)) {
      result.infoPlistPath = artifacts.infoPlistPath;
    }
    
    if (artifacts.entitlementsPath && fs.existsSync(artifacts.entitlementsPath)) {
      result.entitlementsPath = artifacts.entitlementsPath;
    }
    
    // If target-aware parsing didn't find paths, fall back to simple regex
    // This handles edge cases where the pbxproj format is unusual
    if (!result.infoPlistPath || !result.entitlementsPath) {
      const fallback = parsePbxprojForArtifactsFallback(content, projectDir);
      if (!result.infoPlistPath && fallback.infoPlistPath) {
        result.infoPlistPath = fallback.infoPlistPath;
      }
      if (!result.entitlementsPath && fallback.entitlementsPath) {
        result.entitlementsPath = fallback.entitlementsPath;
      }
    }
    
  } catch (error) {
    // Parsing failed - return empty result, caller will fall back to heuristics
    console.warn(`Warning: Could not parse pbxproj for artifacts: ${error}`);
  }
  
  return result;
}

/**
 * Fallback parser using simple regex (for unusual pbxproj formats)
 * 
 * This is the old implementation, kept as fallback.
 */
function parsePbxprojForArtifactsFallback(content: string, projectDir: string): PbxprojArtifacts {
  const result: PbxprojArtifacts = {};
  
  // Find INFOPLIST_FILE - may have quotes or not
  const infoPlistMatch = content.match(/INFOPLIST_FILE\s*=\s*"?([^";]+)"?\s*;/);
  if (infoPlistMatch) {
    let plistPath = normalizeXcodePath(infoPlistMatch[1].trim());
    const resolvedPath = path.resolve(projectDir, plistPath);
    if (fs.existsSync(resolvedPath)) {
      result.infoPlistPath = resolvedPath;
    }
  }
  
  // Find CODE_SIGN_ENTITLEMENTS
  const entitlementsMatch = content.match(/CODE_SIGN_ENTITLEMENTS\s*=\s*"?([^";]+)"?\s*;/);
  if (entitlementsMatch) {
    let entPath = normalizeXcodePath(entitlementsMatch[1].trim());
    const resolvedPath = path.resolve(projectDir, entPath);
    if (fs.existsSync(resolvedPath)) {
      result.entitlementsPath = resolvedPath;
    }
  }
  
  return result;
}

/**
 * Discovers project files in a directory
 * 
 * P1/P2 Fix: Now uses workspace parsing and explicit artifact paths
 */
export function discoverProject(inputPath: string): ProjectDiscovery {
  const stat = fs.statSync(inputPath);
  
  if (stat.isFile() && inputPath.endsWith('.ipa')) {
    throw new Error('IPA scanning is not yet supported. Please extract the IPA and point to the extracted app.');
  }
  
  // BUG FIX #1: Handle direct .xcodeproj path
  // If the input IS a .xcodeproj directory, use it directly
  if (stat.isDirectory() && inputPath.endsWith('.xcodeproj')) {
    const pbxprojPath = path.join(inputPath, 'project.pbxproj');
    const basePath = path.dirname(inputPath);
    
    const discovery: ProjectDiscovery = {
      projectPath: basePath,
      // P2 FIX: Scope is the parent of .xcodeproj
      projectScopeDir: basePath,
      isWorkspace: false,
    };
    
    if (fs.existsSync(pbxprojPath)) {
      discovery.pbxprojPath = pbxprojPath;
      
      // P2 FIX: Try to get explicit artifact paths from pbxproj
      const artifacts = parsePbxprojForArtifacts(pbxprojPath, basePath);
      if (artifacts.infoPlistPath) {
        discovery.infoPlistPath = artifacts.infoPlistPath;
      }
      if (artifacts.entitlementsPath) {
        discovery.entitlementsPath = artifacts.entitlementsPath;
      }
    }
    
    // Fall back to directory search if artifacts not found via parsing
    if (!discovery.infoPlistPath) {
      discoverInfoPlist(basePath, discovery);
    }
    if (!discovery.entitlementsPath) {
      discoverEntitlements(basePath, discovery);
    }
    
    return discovery;
  }
  
  // P1 FIX: Handle .xcworkspace by parsing contents.xcworkspacedata
  if (stat.isDirectory() && inputPath.endsWith('.xcworkspace')) {
    const basePath = path.dirname(inputPath);
    
    const discovery: ProjectDiscovery = {
      projectPath: basePath,
      isWorkspace: true,
    };
    
    // P1 FIX: Parse workspace data to get actual project references
    try {
      const workspaceProjects = getWorkspaceProjects(inputPath);
      discovery.workspaceProjects = workspaceProjects;
      
      if (workspaceProjects.length > 0) {
        // Use the first main project
        const mainProject = workspaceProjects[0];
        const pbxprojPath = path.join(mainProject, 'project.pbxproj');
        
        if (fs.existsSync(pbxprojPath)) {
          discovery.pbxprojPath = pbxprojPath;
          discovery.projectScopeDir = path.dirname(mainProject);
          
          // P2 FIX: Get artifacts from pbxproj
          const artifacts = parsePbxprojForArtifacts(pbxprojPath, path.dirname(mainProject));
          if (artifacts.infoPlistPath) {
            discovery.infoPlistPath = artifacts.infoPlistPath;
          }
          if (artifacts.entitlementsPath) {
            discovery.entitlementsPath = artifacts.entitlementsPath;
          }
        }
      }
    } catch (error) {
      // Workspace parsing failed - fall back to directory scan
      console.warn(`Warning: Workspace parsing failed, using directory scan: ${error}`);
    }
    
    // Fall back to directory scan if workspace parsing didn't find projects
    if (!discovery.pbxprojPath) {
      const xcodeprojs = findFilesRecursive(basePath, (name) => name.endsWith('.xcodeproj'), MAX_SEARCH_DEPTH);
      // Filter out Pods
      const mainXcodeprojs = xcodeprojs.filter(p => !p.includes('/Pods/') && !p.endsWith('Pods.xcodeproj'));
      const projectList = mainXcodeprojs.length > 0 ? mainXcodeprojs : xcodeprojs;
      
      for (const xcodeprojPath of projectList) {
        const pbxprojPath = path.join(xcodeprojPath, 'project.pbxproj');
        if (fs.existsSync(pbxprojPath)) {
          discovery.pbxprojPath = pbxprojPath;
          discovery.projectScopeDir = path.dirname(xcodeprojPath);
          
          // P2 FIX: Try to get artifacts from pbxproj
          const artifacts = parsePbxprojForArtifacts(pbxprojPath, path.dirname(xcodeprojPath));
          if (artifacts.infoPlistPath) {
            discovery.infoPlistPath = artifacts.infoPlistPath;
          }
          if (artifacts.entitlementsPath) {
            discovery.entitlementsPath = artifacts.entitlementsPath;
          }
          break;
        }
      }
    }
    
    // P2 FIX: Search for artifacts within the project scope, not the entire basePath
    const artifactSearchDir = discovery.projectScopeDir || basePath;
    if (!discovery.infoPlistPath) {
      discoverInfoPlist(artifactSearchDir, discovery);
    }
    if (!discovery.entitlementsPath) {
      discoverEntitlements(artifactSearchDir, discovery);
    }
    
    return discovery;
  }
  
  const basePath = stat.isDirectory() ? inputPath : path.dirname(inputPath);
  
  const discovery: ProjectDiscovery = {
    projectPath: basePath,
    isWorkspace: false,
  };
  
  // BUG FIX #3: Recursive search for xcworkspace and xcodeproj
  const xcworkspaces = findFilesRecursive(basePath, (name) => name.endsWith('.xcworkspace'));
  if (xcworkspaces.length > 0) {
    discovery.isWorkspace = true;
    
    // P1 FIX: If workspace found, try to parse it for project references
    try {
      const workspaceProjects = getWorkspaceProjects(xcworkspaces[0]);
      discovery.workspaceProjects = workspaceProjects;
      
      if (workspaceProjects.length > 0) {
        const mainProject = workspaceProjects[0];
        const pbxprojPath = path.join(mainProject, 'project.pbxproj');
        
        if (fs.existsSync(pbxprojPath)) {
          discovery.pbxprojPath = pbxprojPath;
          discovery.projectScopeDir = path.dirname(mainProject);
          
          // P2 FIX: Get artifacts from pbxproj
          const artifacts = parsePbxprojForArtifacts(pbxprojPath, path.dirname(mainProject));
          if (artifacts.infoPlistPath) {
            discovery.infoPlistPath = artifacts.infoPlistPath;
          }
          if (artifacts.entitlementsPath) {
            discovery.entitlementsPath = artifacts.entitlementsPath;
          }
        }
      }
    } catch {
      // Fall through to directory scan
    }
  }
  
  // Fall back to directory scan for xcodeproj
  if (!discovery.pbxprojPath) {
    const xcodeprojs = findFilesRecursive(basePath, (name) => name.endsWith('.xcodeproj'));
    // Filter out Pods
    const mainXcodeprojs = xcodeprojs.filter(p => !p.includes('/Pods/') && !p.endsWith('Pods.xcodeproj'));
    const projectList = mainXcodeprojs.length > 0 ? mainXcodeprojs : xcodeprojs;
    
    for (const xcodeprojPath of projectList) {
      const pbxprojPath = path.join(xcodeprojPath, 'project.pbxproj');
      if (fs.existsSync(pbxprojPath)) {
        discovery.pbxprojPath = pbxprojPath;
        // P2 FIX: Scope artifact search to project's directory
        discovery.projectScopeDir = path.dirname(xcodeprojPath);
        
        // P2 FIX: Try to get artifacts from pbxproj
        const artifacts = parsePbxprojForArtifacts(pbxprojPath, path.dirname(xcodeprojPath));
        if (artifacts.infoPlistPath) {
          discovery.infoPlistPath = artifacts.infoPlistPath;
        }
        if (artifacts.entitlementsPath) {
          discovery.entitlementsPath = artifacts.entitlementsPath;
        }
        break;
      }
    }
  }
  
  // P2 FIX: Search for artifacts within the project scope to avoid monorepo mixing
  const artifactSearchDir = discovery.projectScopeDir || basePath;
  if (!discovery.infoPlistPath) {
    discoverInfoPlist(artifactSearchDir, discovery);
  }
  if (!discovery.entitlementsPath) {
    discoverEntitlements(artifactSearchDir, discovery);
  }
  
  return discovery;
}

/**
 * Discovers Info.plist in project directory (recursive)
 * This is the fallback when pbxproj parsing doesn't yield a path
 */
function discoverInfoPlist(basePath: string, discovery: ProjectDiscovery): void {
  // First check root
  const rootPlist = path.join(basePath, 'Info.plist');
  if (fs.existsSync(rootPlist)) {
    discovery.infoPlistPath = rootPlist;
    return;
  }
  
  // Recursive search
  const plists = findFilesRecursive(basePath, (name) => name === 'Info.plist');
  if (plists.length > 0) {
    // Prefer shorter paths (closer to root)
    plists.sort((a, b) => a.split(path.sep).length - b.split(path.sep).length);
    discovery.infoPlistPath = plists[0];
  }
}

/**
 * Discovers entitlements file in project directory (recursive)
 * This is the fallback when pbxproj parsing doesn't yield a path
 */
function discoverEntitlements(basePath: string, discovery: ProjectDiscovery): void {
  const entitlements = findFilesRecursive(basePath, (name) => name.endsWith('.entitlements'));
  if (entitlements.length > 0) {
    // Prefer shorter paths (closer to root)
    entitlements.sort((a, b) => a.split(path.sep).length - b.split(path.sep).length);
    discovery.entitlementsPath = entitlements[0];
  }
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
  
  // Load dependencies (P2 FIX: scope to project directory to prevent monorepo mixing)
  try {
    dependencies = loadAllDependencies(discovery.projectScopeDir || discovery.projectPath);
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
