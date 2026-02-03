/**
 * Parser for Xcode workspace files
 * 
 * Parses contents.xcworkspacedata to extract project references.
 * This allows us to find the correct project(s) instead of relying
 * on directory heuristics that can pick the wrong project in monorepos.
 */
import * as fs from 'fs';
import * as path from 'path';

/**
 * A project reference extracted from workspace data
 */
export interface WorkspaceProjectRef {
  /** The location string as it appears in the XML (e.g., "group:MyApp/MyApp.xcodeproj") */
  rawLocation: string;
  /** The location type (group, absolute, container, self) */
  locationType: 'group' | 'absolute' | 'container' | 'self' | 'unknown';
  /** The relative or absolute path to the project */
  projectPath: string;
  /** Whether this is a Pods project (dependency, not the main app) */
  isPods: boolean;
  /** Whether this is a test/example project */
  isTestOrExample: boolean;
}

/**
 * Parsed workspace data
 */
export interface ParsedWorkspace {
  /** Version from the Workspace element */
  version: string;
  /** All project references found */
  projectRefs: WorkspaceProjectRef[];
  /** Main project refs (excluding Pods, tests, examples) */
  mainProjectRefs: WorkspaceProjectRef[];
}

/**
 * Parses the contents.xcworkspacedata file
 * 
 * The file is XML with structure:
 * ```xml
 * <?xml version="1.0" encoding="UTF-8"?>
 * <Workspace version="1.0">
 *    <FileRef location="group:MyApp/MyApp.xcodeproj"/>
 *    <FileRef location="group:Pods/Pods.xcodeproj"/>
 * </Workspace>
 * ```
 * 
 * Location types:
 * - group: relative to workspace directory
 * - absolute: absolute filesystem path
 * - container: relative to containing project (rare)
 * - self: the workspace itself (rare)
 */
export function parseWorkspaceData(workspacePath: string): ParsedWorkspace {
  // Find the contents.xcworkspacedata file
  let dataPath: string;
  if (workspacePath.endsWith('.xcworkspace')) {
    dataPath = path.join(workspacePath, 'contents.xcworkspacedata');
  } else if (workspacePath.endsWith('contents.xcworkspacedata')) {
    dataPath = workspacePath;
  } else {
    throw new Error(`Invalid workspace path: ${workspacePath}`);
  }
  
  if (!fs.existsSync(dataPath)) {
    // Return empty result if no workspace data file
    return {
      version: '',
      projectRefs: [],
      mainProjectRefs: [],
    };
  }
  
  const content = fs.readFileSync(dataPath, 'utf-8');
  return parseWorkspaceDataString(content);
}

/**
 * Parses workspace data from a string (for testing)
 */
export function parseWorkspaceDataString(content: string): ParsedWorkspace {
  // Extract version from Workspace element
  const versionMatch = content.match(/<Workspace\s+version="([^"]+)"/);
  const version = versionMatch ? versionMatch[1] : '';
  
  // Extract all FileRef locations
  const fileRefRegex = /<FileRef\s+location="([^"]+)"\s*\/>/g;
  const projectRefs: WorkspaceProjectRef[] = [];
  
  let match;
  while ((match = fileRefRegex.exec(content)) !== null) {
    const rawLocation = match[1];
    const ref = parseLocationString(rawLocation);
    
    // Only include .xcodeproj references
    if (ref.projectPath.endsWith('.xcodeproj')) {
      projectRefs.push(ref);
    }
  }
  
  // Filter to main projects (non-Pods, non-test, non-example)
  const mainProjectRefs = projectRefs.filter(
    ref => !ref.isPods && !ref.isTestOrExample
  );
  
  return {
    version,
    projectRefs,
    mainProjectRefs,
  };
}

/**
 * Parses a location string into its components
 */
function parseLocationString(rawLocation: string): WorkspaceProjectRef {
  // Split on first colon
  const colonIndex = rawLocation.indexOf(':');
  
  let locationType: WorkspaceProjectRef['locationType'];
  let projectPath: string;
  
  if (colonIndex === -1) {
    // No colon = treat as relative path
    locationType = 'unknown';
    projectPath = rawLocation;
  } else {
    const typeStr = rawLocation.substring(0, colonIndex);
    projectPath = rawLocation.substring(colonIndex + 1);
    
    switch (typeStr) {
      case 'group':
        locationType = 'group';
        break;
      case 'absolute':
        locationType = 'absolute';
        break;
      case 'container':
        locationType = 'container';
        break;
      case 'self':
        locationType = 'self';
        break;
      default:
        locationType = 'unknown';
    }
  }
  
  // Detect Pods projects
  const isPods = projectPath.includes('Pods.xcodeproj') || 
                 projectPath.includes('/Pods/') ||
                 projectPath.startsWith('Pods/');
  
  // Detect test/example projects by path segments (not substring)
  // This avoids false positives like "BestApp", "ContestManager", "LatestNews"
  const pathSegments = projectPath.toLowerCase().split('/');
  const testKeywords = ['test', 'tests', 'example', 'examples', 'demo', 'demos', 'sample', 'samples'];
  const isTestOrExample = pathSegments.some(segment => 
    testKeywords.some(keyword => segment === keyword || segment.endsWith('tests') || segment.endsWith('test'))
  );
  
  return {
    rawLocation,
    locationType,
    projectPath,
    isPods,
    isTestOrExample,
  };
}

/**
 * Resolves a workspace project reference to an absolute path
 * 
 * @param ref The project reference
 * @param workspaceDir Directory containing the .xcworkspace
 * @returns Absolute path to the .xcodeproj, or undefined if not resolvable
 */
export function resolveProjectRef(
  ref: WorkspaceProjectRef,
  workspaceDir: string
): string | undefined {
  switch (ref.locationType) {
    case 'group':
      // Relative to workspace parent directory
      return path.resolve(workspaceDir, ref.projectPath);
      
    case 'absolute':
      // Already absolute
      return ref.projectPath;
      
    case 'container':
    case 'self':
    case 'unknown':
      // Try as relative path
      return path.resolve(workspaceDir, ref.projectPath);
  }
}

/**
 * Given a workspace path, returns the main project paths
 * 
 * This is the primary API for discovering projects in a workspace.
 * It parses the workspace data and resolves the main project references.
 * 
 * @param workspacePath Path to .xcworkspace directory
 * @returns Array of absolute paths to .xcodeproj directories
 */
export function getWorkspaceProjects(workspacePath: string): string[] {
  const workspaceDir = workspacePath.endsWith('.xcworkspace')
    ? path.dirname(workspacePath)
    : path.dirname(path.dirname(workspacePath));
  
  const parsed = parseWorkspaceData(workspacePath);
  const projectPaths: string[] = [];
  
  // Prefer main projects; fall back to all if none found
  const refs = parsed.mainProjectRefs.length > 0 
    ? parsed.mainProjectRefs 
    : parsed.projectRefs;
  
  for (const ref of refs) {
    const resolved = resolveProjectRef(ref, workspaceDir);
    if (resolved && fs.existsSync(resolved)) {
      projectPaths.push(resolved);
    }
  }
  
  return projectPaths;
}
