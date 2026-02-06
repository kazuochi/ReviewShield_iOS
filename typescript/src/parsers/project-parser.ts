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
import { getWorkspaceProjects } from './workspace-parser.js';
import { getMainTargetArtifacts, normalizeXcodePath } from './pbxproj-parser.js';
import type { Dependency, ScanContext } from '../types/index.js';

/**
 * Result of project discovery
 */
export interface ProjectDiscovery {
  projectPath: string;
  /** P2 FIX: Scoped directory for artifacts (parent of .xcodeproj) to prevent monorepo mixing */
  projectScopeDir?: string;
  /** P2-A FIX: Scoped directory for dependency lockfile discovery (the .xcodeproj path itself) */
  dependencyScopeDir?: string;
  infoPlistPath?: string;
  entitlementsPath?: string;
  pbxprojPath?: string;
  isWorkspace: boolean;
  /** P1/P2: All projects found in workspace (when applicable) */
  workspaceProjects?: string[];
  /** P2 FIX: Target name from pbxproj parsing (for scoped fallback discovery) */
  targetName?: string;
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
 * Options for findFilesRecursive
 */
interface FindFilesOptions {
  maxDepth?: number;
  /** Path to the current project's .xcodeproj (to exclude sibling project directories) */
  currentXcodeprojPath?: string;
}

/**
 * Check if a directory contains a .xcodeproj that is different from the current one
 */
function containsSiblingXcodeproj(dir: string, currentXcodeprojPath?: string): boolean {
  if (!currentXcodeprojPath) return false;
  
  try {
    const entries = fs.readdirSync(dir);
    for (const entry of entries) {
      if (entry.endsWith('.xcodeproj')) {
        const xcprojPath = path.join(dir, entry);
        // Normalize paths for comparison
        if (path.resolve(xcprojPath) !== path.resolve(currentXcodeprojPath)) {
          return true;
        }
      }
    }
  } catch {
    // Ignore errors
  }
  return false;
}

/**
 * P2-C FIX: Check if a directory contains multiple .xcodeproj bundles (monorepo indicator)
 * Used to skip root-level artifact fallback checks in monorepos
 */
function hasMultipleXcodeprojs(dir: string): boolean {
  try {
    const entries = fs.readdirSync(dir);
    let count = 0;
    for (const entry of entries) {
      if (entry.endsWith('.xcodeproj') && !entry.includes('Pods')) {
        count++;
        if (count >= 2) return true;
      }
    }
  } catch {
    // Ignore errors
  }
  return false;
}

/**
 * Recursively find files matching a pattern
 * P2-B FIX: Can exclude directories containing sibling .xcodeproj files
 */
function findFilesRecursive(
  dir: string,
  predicate: (name: string, fullPath: string) => boolean,
  options: FindFilesOptions = {},
  currentDepth: number = 0
): string[] {
  const maxDepth = options.maxDepth ?? MAX_SEARCH_DEPTH;
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
          // P2-B FIX: Skip directories that contain a different .xcodeproj (sibling projects)
          if (options.currentXcodeprojPath && containsSiblingXcodeproj(fullPath, options.currentXcodeprojPath)) {
            continue;
          }
          results.push(...findFilesRecursive(fullPath, predicate, options, currentDepth + 1));
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
    const plistPath = normalizeXcodePath(infoPlistMatch[1].trim());
    const resolvedPath = path.resolve(projectDir, plistPath);
    if (fs.existsSync(resolvedPath)) {
      result.infoPlistPath = resolvedPath;
    }
  }
  
  // Find CODE_SIGN_ENTITLEMENTS
  const entitlementsMatch = content.match(/CODE_SIGN_ENTITLEMENTS\s*=\s*"?([^";]+)"?\s*;/);
  if (entitlementsMatch) {
    const entPath = normalizeXcodePath(entitlementsMatch[1].trim());
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
      // P2-A FIX: Dependency scope is the .xcodeproj itself to prevent picking up sibling lockfiles
      dependencyScopeDir: inputPath,
      isWorkspace: false,
    };
    
    if (fs.existsSync(pbxprojPath)) {
      discovery.pbxprojPath = pbxprojPath;
      
      // P2 FIX: Try to get explicit artifact paths from pbxproj
      const artifacts = parsePbxprojForArtifacts(pbxprojPath, basePath);
      if (artifacts.targetName) {
        discovery.targetName = artifacts.targetName;
      }
      if (artifacts.infoPlistPath) {
        discovery.infoPlistPath = artifacts.infoPlistPath;
      }
      if (artifacts.entitlementsPath) {
        discovery.entitlementsPath = artifacts.entitlementsPath;
      }
    }
    
    // Fall back to directory search if artifacts not found via parsing
    // P2 FIX: Pass targetName to scope the search and prevent monorepo bleeding
    if (!discovery.infoPlistPath) {
      discoverInfoPlist(basePath, discovery, discovery.targetName);
    }
    if (!discovery.entitlementsPath) {
      discoverEntitlements(basePath, discovery, discovery.targetName);
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
          // P1 FIX: Set dependencyScopeDir for workspace scans to prevent picking up sibling lockfiles
          discovery.dependencyScopeDir = mainProject;
          
          // P2 FIX: Get artifacts from pbxproj
          const artifacts = parsePbxprojForArtifacts(pbxprojPath, path.dirname(mainProject));
          if (artifacts.targetName) {
            discovery.targetName = artifacts.targetName;
          }
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
      const xcodeprojs = findFilesRecursive(basePath, (name) => name.endsWith('.xcodeproj'));
      // Filter out Pods
      const mainXcodeprojs = xcodeprojs.filter(p => !p.includes('/Pods/') && !p.endsWith('Pods.xcodeproj'));
      const projectList = mainXcodeprojs.length > 0 ? mainXcodeprojs : xcodeprojs;
      
      for (const xcodeprojPath of projectList) {
        const pbxprojPath = path.join(xcodeprojPath, 'project.pbxproj');
        if (fs.existsSync(pbxprojPath)) {
          discovery.pbxprojPath = pbxprojPath;
          discovery.projectScopeDir = path.dirname(xcodeprojPath);
          // P1 FIX: Set dependencyScopeDir for workspace fallback scans
          discovery.dependencyScopeDir = xcodeprojPath;
          
          // P2 FIX: Try to get artifacts from pbxproj
          const artifacts = parsePbxprojForArtifacts(pbxprojPath, path.dirname(xcodeprojPath));
          if (artifacts.targetName) {
            discovery.targetName = artifacts.targetName;
          }
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
    // Pass targetName to scope the search and prevent monorepo bleeding
    const artifactSearchDir = discovery.projectScopeDir || basePath;
    if (!discovery.infoPlistPath) {
      discoverInfoPlist(artifactSearchDir, discovery, discovery.targetName);
    }
    if (!discovery.entitlementsPath) {
      discoverEntitlements(artifactSearchDir, discovery, discovery.targetName);
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
          // P1 FIX: Set dependencyScopeDir for root-level workspace discovery
          discovery.dependencyScopeDir = mainProject;
          
          // P2 FIX: Get artifacts from pbxproj
          const artifacts = parsePbxprojForArtifacts(pbxprojPath, path.dirname(mainProject));
          if (artifacts.targetName) {
            discovery.targetName = artifacts.targetName;
          }
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
        // P1 FIX: Set dependencyScopeDir for root-level xcodeproj discovery
        discovery.dependencyScopeDir = xcodeprojPath;
        
        // P2 FIX: Try to get artifacts from pbxproj
        const artifacts = parsePbxprojForArtifacts(pbxprojPath, path.dirname(xcodeprojPath));
        if (artifacts.targetName) {
          discovery.targetName = artifacts.targetName;
        }
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
  // Pass targetName to scope the search and prevent monorepo bleeding
  const artifactSearchDir = discovery.projectScopeDir || basePath;
  if (!discovery.infoPlistPath) {
    discoverInfoPlist(artifactSearchDir, discovery, discovery.targetName);
  }
  if (!discovery.entitlementsPath) {
    discoverEntitlements(artifactSearchDir, discovery, discovery.targetName);
  }
  
  return discovery;
}

/**
 * Discovers Info.plist in project directory (recursive)
 * This is the fallback when pbxproj parsing doesn't yield a path
 * 
 * P2 FIX: If targetName is provided, first try searching only in the target's subdirectory
 * to avoid picking up Info.plist from sibling projects in monorepos
 * 
 * P2-B FIX: Excludes directories containing a different .xcodeproj (sibling projects)
 */
function discoverInfoPlist(basePath: string, discovery: ProjectDiscovery, targetName?: string): void {
  // Get the current xcodeproj path for sibling exclusion
  const currentXcodeprojPath = discovery.pbxprojPath ? path.dirname(discovery.pbxprojPath) : undefined;
  const findOptions: FindFilesOptions = { currentXcodeprojPath };
  
  // P2 FIX: If we have a target name, first try the target-specific subdirectory
  if (targetName) {
    const targetDir = path.join(basePath, targetName);
    if (fs.existsSync(targetDir) && fs.statSync(targetDir).isDirectory()) {
      // Check target root first
      const targetPlist = path.join(targetDir, 'Info.plist');
      if (fs.existsSync(targetPlist)) {
        discovery.infoPlistPath = targetPlist;
        return;
      }
      // Recursive search within target directory only
      const plists = findFilesRecursive(targetDir, (name) => name === 'Info.plist', findOptions);
      if (plists.length > 0) {
        plists.sort((a, b) => a.split(path.sep).length - b.split(path.sep).length);
        discovery.infoPlistPath = plists[0];
        return;
      }
    }
  }
  
  // P2-C FIX: Skip root-level check if basePath contains multiple .xcodeproj bundles (monorepo)
  // This prevents picking up a sibling app's Info.plist that happens to be at root
  const isMonorepoRoot = hasMultipleXcodeprojs(basePath);
  if (!isMonorepoRoot) {
    // First check root (only safe in single-project directories)
    const rootPlist = path.join(basePath, 'Info.plist');
    if (fs.existsSync(rootPlist)) {
      discovery.infoPlistPath = rootPlist;
      return;
    }
  }
  
  // P2-B FIX: Recursive search with sibling project exclusion
  let plists = findFilesRecursive(basePath, (name) => name === 'Info.plist', findOptions);
  
  // P2-C FIX: If monorepo root, filter out root-level Info.plist from recursive results too
  // (recursive search finds files in basePath directory as well)
  if (isMonorepoRoot) {
    const rootPlist = path.join(basePath, 'Info.plist');
    plists = plists.filter(p => path.resolve(p) !== path.resolve(rootPlist));
  }
  
  if (plists.length > 0) {
    // Prefer shorter paths (closer to root)
    plists.sort((a, b) => a.split(path.sep).length - b.split(path.sep).length);
    discovery.infoPlistPath = plists[0];
  }
}

/**
 * Discovers entitlements file in project directory (recursive)
 * This is the fallback when pbxproj parsing doesn't yield a path
 * 
 * P2 FIX: If targetName is provided, first try searching only in the target's subdirectory
 * to avoid picking up entitlements from sibling projects in monorepos
 * 
 * P2-B FIX: Excludes directories containing a different .xcodeproj (sibling projects)
 * 
 * P2-C FIX: If basePath contains multiple .xcodeproj bundles (monorepo), filter out
 * root-level entitlements files to prevent selecting sibling project entitlements
 */
function discoverEntitlements(basePath: string, discovery: ProjectDiscovery, targetName?: string): void {
  // Get the current xcodeproj path for sibling exclusion
  const currentXcodeprojPath = discovery.pbxprojPath ? path.dirname(discovery.pbxprojPath) : undefined;
  const findOptions: FindFilesOptions = { currentXcodeprojPath };
  
  // P2 FIX: If we have a target name, first try the target-specific subdirectory
  if (targetName) {
    const targetDir = path.join(basePath, targetName);
    if (fs.existsSync(targetDir) && fs.statSync(targetDir).isDirectory()) {
      const entitlements = findFilesRecursive(targetDir, (name) => name.endsWith('.entitlements'), findOptions);
      if (entitlements.length > 0) {
        entitlements.sort((a, b) => a.split(path.sep).length - b.split(path.sep).length);
        discovery.entitlementsPath = entitlements[0];
        return;
      }
    }
  }
  
  // P2-C FIX: Check if basePath has multiple xcodeprojs (monorepo indicator)
  // This prevents picking up root-level entitlements from sibling projects
  const isMonorepoRoot = hasMultipleXcodeprojs(basePath);

  // P2-B FIX: Recursive search with sibling project exclusion
  let entitlements = findFilesRecursive(basePath, (name) => name.endsWith('.entitlements'), findOptions);
  
  // P2-C FIX: If monorepo root, filter out root-level entitlements files
  // (recursive search finds files in basePath directory as well)
  if (isMonorepoRoot && entitlements.length > 0) {
    entitlements = entitlements.filter(p => path.dirname(path.resolve(p)) !== path.resolve(basePath));
  }
  
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
  
  // Load dependencies (P2-A FIX: scope to dependencyScopeDir to prevent picking up sibling project lockfiles)
  try {
    dependencies = loadAllDependencies(discovery.dependencyScopeDir ?? discovery.projectScopeDir ?? discovery.projectPath);
  } catch (error) {
    console.warn(`Warning: Could not load dependencies: ${error}`);
  }
  
  return createContextObject(
    discovery.projectPath,
    infoPlist,
    entitlements,
    linkedFrameworks,
    dependencies,
    discovery.infoPlistPath,
    discovery.entitlementsPath,
    discovery.pbxprojPath
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
  dependencies: Dependency[],
  infoPlistPath?: string,
  entitlementsPath?: string,
  pbxprojPath?: string
): ScanContext {
  return {
    projectPath,
    infoPlist,
    infoPlistPath,
    entitlements,
    entitlementsPath,
    pbxprojPath,
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
