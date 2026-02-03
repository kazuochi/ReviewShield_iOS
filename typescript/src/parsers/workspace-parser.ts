/**
 * Parser for Xcode workspace files
 * 
 * Parses contents.xcworkspacedata to extract project references.
 * This allows us to find the correct project(s) instead of relying
 * on directory heuristics that can pick the wrong project in monorepos.
 * 
 * P1/P2 Fix: Now uses product type for scoring instead of name-based heuristics.
 */
import * as fs from 'fs';
import * as path from 'path';
import { 
  getMainTargetProductType, 
  getProductTypePriority, 
  isApplicationType,
  isTestType 
} from './pbxproj-parser.js';

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
  /** Whether this is a test/example project (by path heuristics) */
  isTestOrExample: boolean;
  /** Product type priority score (higher = better candidate for main app) */
  productTypePriority?: number;
  /** Main target product type (e.g., "com.apple.product-type.application") */
  productType?: string;
  /** Whether the main target is an application (by productType) */
  isApplication?: boolean;
  /** Whether the main target is a test target (by productType) */
  isTestTarget?: boolean;
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
 * Enrich a project reference with product type info by parsing its pbxproj
 * 
 * @param ref The project reference
 * @param resolvedPath The resolved absolute path to the .xcodeproj
 */
function enrichProjectRefWithProductType(
  ref: WorkspaceProjectRef,
  resolvedPath: string
): void {
  const pbxprojPath = path.join(resolvedPath, 'project.pbxproj');
  
  if (!fs.existsSync(pbxprojPath)) {
    return;
  }
  
  try {
    const content = fs.readFileSync(pbxprojPath, 'utf-8');
    const projectName = path.basename(resolvedPath).replace('.xcodeproj', '');
    
    const productType = getMainTargetProductType(content, projectName);
    if (productType) {
      ref.productType = productType;
      ref.productTypePriority = getProductTypePriority(productType);
      ref.isApplication = isApplicationType(productType);
      ref.isTestTarget = isTestType(productType);
    }
  } catch {
    // Ignore parsing errors - fall back to path heuristics
  }
}

/**
 * Given a workspace path, returns the main project paths
 * 
 * This is the primary API for discovering projects in a workspace.
 * It parses the workspace data and resolves the main project references.
 * 
 * P1/P2 Fix: Now uses product type for scoring, not name heuristics.
 * Projects are sorted by:
 * 1. Product type priority (applications first)
 * 2. Not being Pods
 * 3. Not being a test target (by productType)
 * 
 * @param workspacePath Path to .xcworkspace directory
 * @returns Array of absolute paths to .xcodeproj directories
 */
export function getWorkspaceProjects(workspacePath: string): string[] {
  const workspaceDir = workspacePath.endsWith('.xcworkspace')
    ? path.dirname(workspacePath)
    : path.dirname(path.dirname(workspacePath));
  
  const parsed = parseWorkspaceData(workspacePath);
  
  // Resolve all project paths and enrich with product type
  const enrichedRefs: Array<{ ref: WorkspaceProjectRef; resolved: string }> = [];
  
  for (const ref of parsed.projectRefs) {
    const resolved = resolveProjectRef(ref, workspaceDir);
    if (resolved && fs.existsSync(resolved)) {
      // Enrich with product type info
      enrichProjectRefWithProductType(ref, resolved);
      enrichedRefs.push({ ref, resolved });
    }
  }
  
  // Sort by product type priority (P1/P2 fix: use productType, not name)
  enrichedRefs.sort((a, b) => {
    // First: exclude Pods (always last)
    if (a.ref.isPods !== b.ref.isPods) {
      return a.ref.isPods ? 1 : -1;
    }
    
    // Second: prefer applications by productType (not name heuristics)
    if (a.ref.isApplication !== b.ref.isApplication) {
      return a.ref.isApplication ? -1 : 1;
    }
    
    // Third: exclude test targets by productType (more reliable than name)
    if (a.ref.isTestTarget !== b.ref.isTestTarget) {
      return a.ref.isTestTarget ? 1 : -1;
    }
    
    // Fourth: sort by product type priority
    const priorityA = a.ref.productTypePriority ?? 0;
    const priorityB = b.ref.productTypePriority ?? 0;
    if (priorityA !== priorityB) {
      return priorityB - priorityA;
    }
    
    // Fifth: fall back to path heuristics for test/example
    if (a.ref.isTestOrExample !== b.ref.isTestOrExample) {
      return a.ref.isTestOrExample ? 1 : -1;
    }
    
    return 0;
  });
  
  // Filter to "main" projects for backward compatibility
  // Main = application type or (not Pods and not test target)
  const mainProjects = enrichedRefs.filter(({ ref }) => 
    ref.isApplication || (!ref.isPods && !ref.isTestTarget && !ref.isTestOrExample)
  );
  
  // If no main projects found, return all non-test projects
  const resultRefs = mainProjects.length > 0 
    ? mainProjects 
    : enrichedRefs.filter(({ ref }) => !ref.isTestTarget);
  
  // If still nothing, return all
  if (resultRefs.length === 0) {
    return enrichedRefs.map(({ resolved }) => resolved);
  }
  
  return resultRefs.map(({ resolved }) => resolved);
}
