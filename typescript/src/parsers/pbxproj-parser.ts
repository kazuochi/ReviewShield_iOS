/**
 * Parser for Xcode project.pbxproj files
 * 
 * P1/P2 Fix: Parses the target graph to correctly identify the main app target
 * instead of relying on first-match or name-based heuristics.
 * 
 * Key insight: productType is the reliable way to distinguish:
 * - com.apple.product-type.application (iOS/macOS app)
 * - com.apple.product-type.app-extension (extensions)
 * - com.apple.product-type.bundle.unit-test (unit tests)
 * - com.apple.product-type.bundle.ui-testing (UI tests)
 * - com.apple.product-type.framework (frameworks)
 */
import * as path from 'path';

/**
 * Product types in priority order (highest first)
 */
export enum ProductType {
  Application = 'com.apple.product-type.application',
  ApplicationOnDemandInstall = 'com.apple.product-type.application.on-demand-install-capable',
  AppExtension = 'com.apple.product-type.app-extension',
  ExtensionKitExtension = 'com.apple.product-type.extensionkit-extension',
  WatchApp = 'com.apple.product-type.application.watchapp2',
  WatchExtension = 'com.apple.product-type.watchkit2-extension',
  TVExtension = 'com.apple.product-type.tv-app-extension',
  UnitTest = 'com.apple.product-type.bundle.unit-test',
  UITest = 'com.apple.product-type.bundle.ui-testing',
  Framework = 'com.apple.product-type.framework',
  StaticFramework = 'com.apple.product-type.framework.static',
  StaticLibrary = 'com.apple.product-type.library.static',
  DynamicLibrary = 'com.apple.product-type.library.dynamic',
  Bundle = 'com.apple.product-type.bundle',
  XPCService = 'com.apple.product-type.xpc-service',
}

/**
 * Product type priority for target selection
 * Higher number = higher priority = prefer this target
 */
const PRODUCT_TYPE_PRIORITY: Record<string, number> = {
  [ProductType.Application]: 100,
  [ProductType.ApplicationOnDemandInstall]: 95, // App Clip
  [ProductType.WatchApp]: 50, // Watch app is secondary
  [ProductType.AppExtension]: 30,
  [ProductType.ExtensionKitExtension]: 30,
  [ProductType.WatchExtension]: 25,
  [ProductType.TVExtension]: 25,
  [ProductType.Framework]: 20,
  [ProductType.StaticFramework]: 20,
  [ProductType.StaticLibrary]: 15,
  [ProductType.DynamicLibrary]: 15,
  [ProductType.Bundle]: 10,
  [ProductType.XPCService]: 10,
  [ProductType.UnitTest]: 5,
  [ProductType.UITest]: 5,
};

/**
 * A native target parsed from pbxproj
 */
export interface PbxprojTarget {
  /** The unique ID in the pbxproj (e.g., "ABC123DEF456") */
  id: string;
  /** Target name (e.g., "MyApp") */
  name: string;
  /** Product type (e.g., "com.apple.product-type.application") */
  productType: string;
  /** Reference to the build configuration list */
  buildConfigurationListId: string;
  /** Product name if specified */
  productName?: string;
}

/**
 * Build configuration parsed from pbxproj
 */
export interface PbxprojBuildConfig {
  /** The unique ID */
  id: string;
  /** Config name (e.g., "Debug", "Release") */
  name: string;
  /** Raw build settings */
  buildSettings: Record<string, string>;
}

/**
 * Build configuration list parsed from pbxproj
 */
export interface PbxprojConfigList {
  /** The unique ID */
  id: string;
  /** Config IDs in this list */
  buildConfigurationIds: string[];
}

/**
 * Artifact paths extracted from build settings
 */
export interface TargetBuildSettings {
  /** INFOPLIST_FILE path */
  infoPlistPath?: string;
  /** CODE_SIGN_ENTITLEMENTS path */
  entitlementsPath?: string;
  /** PRODUCT_NAME */
  productName?: string;
  /** TARGET_NAME */
  targetName?: string;
  /** The config name these came from */
  configName?: string;
}

/**
 * Parse all PBXNativeTarget entries from pbxproj content
 * 
 * @param content The raw pbxproj file content
 * @returns Array of parsed targets
 */
export function parsePbxprojTargets(content: string): PbxprojTarget[] {
  const targets: PbxprojTarget[] = [];
  
  // Match PBXNativeTarget section entries
  // Format: ID /* Name */ = { isa = PBXNativeTarget; ... };
  // This regex captures the full target block
  const targetRegex = /([A-Fa-f0-9]{24})\s*\/\*\s*([^*]+?)\s*\*\/\s*=\s*\{([^}]*isa\s*=\s*PBXNativeTarget[^}]*(?:\{[^}]*\}[^}]*)*)\};/g;
  
  let match;
  while ((match = targetRegex.exec(content)) !== null) {
    const id = match[1];
    const name = match[2].trim();
    const block = match[3];
    
    // Extract productType
    const productTypeMatch = block.match(/productType\s*=\s*"([^"]+)"/);
    const productType = productTypeMatch ? productTypeMatch[1] : '';
    
    // Extract buildConfigurationList
    const configListMatch = block.match(/buildConfigurationList\s*=\s*([A-Fa-f0-9]{24})/);
    const buildConfigurationListId = configListMatch ? configListMatch[1] : '';
    
    // Extract productName if present
    const productNameMatch = block.match(/productName\s*=\s*"?([^";]+)"?\s*;/);
    const productName = productNameMatch ? productNameMatch[1].trim() : undefined;
    
    if (productType) {
      targets.push({
        id,
        name,
        productType,
        buildConfigurationListId,
        productName,
      });
    }
  }
  
  return targets;
}

/**
 * Get the priority score for a product type
 * Higher = better candidate for main app
 */
export function getProductTypePriority(productType: string): number {
  return PRODUCT_TYPE_PRIORITY[productType] ?? 0;
}

/**
 * Check if a product type is an application
 */
export function isApplicationType(productType: string): boolean {
  return productType === ProductType.Application || 
         productType === ProductType.ApplicationOnDemandInstall;
}

/**
 * Check if a product type is a test target
 */
export function isTestType(productType: string): boolean {
  return productType === ProductType.UnitTest || 
         productType === ProductType.UITest;
}

/**
 * Get the main app target from a list of targets
 * 
 * Selection criteria:
 * 1. Product type priority (application > extension > test)
 * 2. Name matching project name (tie-breaker)
 * 3. First in list (final fallback)
 * 
 * @param targets List of parsed targets
 * @param projectName Optional project name for name-matching tie-breaker
 * @returns The best target, or undefined if no targets
 */
export function getMainAppTarget(
  targets: PbxprojTarget[],
  projectName?: string
): PbxprojTarget | undefined {
  if (targets.length === 0) {
    return undefined;
  }
  
  // Sort by priority (highest first), then by name match
  const sorted = [...targets].sort((a, b) => {
    const priorityA = getProductTypePriority(a.productType);
    const priorityB = getProductTypePriority(b.productType);
    
    // Primary sort: product type priority
    if (priorityA !== priorityB) {
      return priorityB - priorityA;
    }
    
    // Secondary sort: name matching project name
    if (projectName) {
      const normalizedProject = projectName.toLowerCase().replace(/[^a-z0-9]/g, '');
      const normalizedA = a.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      const normalizedB = b.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      
      const matchA = normalizedA.includes(normalizedProject) || normalizedProject.includes(normalizedA);
      const matchB = normalizedB.includes(normalizedProject) || normalizedProject.includes(normalizedB);
      
      if (matchA && !matchB) return -1;
      if (matchB && !matchA) return 1;
    }
    
    // Tertiary: prefer shorter names (less likely to be "MyAppTests", "MyAppUITests")
    return a.name.length - b.name.length;
  });
  
  return sorted[0];
}

/**
 * Parse XCBuildConfiguration entries from pbxproj content
 * 
 * @param content The raw pbxproj file content
 * @returns Map of config ID to config object
 */
export function parseBuildConfigurations(content: string): Map<string, PbxprojBuildConfig> {
  const configs = new Map<string, PbxprojBuildConfig>();
  
  // Find XCBuildConfiguration entries using a brace-counting parser instead of regex
  // This handles values containing } inside quoted strings (e.g., ${PRODUCT_NAME:rfc1034identifier})
  const isaPattern = /([A-Fa-f0-9]{24})\s*\/\*\s*([^*]+?)\s*\*\/\s*=\s*\{/g;
  
  let isaMatch;
  while ((isaMatch = isaPattern.exec(content)) !== null) {
    const id = isaMatch[1];
    const blockStart = isaMatch.index + isaMatch[0].length;
    
    // Extract the full block using brace counting (respecting quoted strings)
    const blockContent = extractBalancedBlock(content, blockStart);
    if (!blockContent) continue;
    
    // Check if this is an XCBuildConfiguration
    if (!blockContent.includes('isa = XCBuildConfiguration')) continue;
    
    // Extract name
    const nameMatch = blockContent.match(/name\s*=\s*"?([^";]+)"?\s*;/);
    if (!nameMatch) continue;
    const name = nameMatch[1].trim();
    
    // Extract buildSettings block
    const bsStart = blockContent.indexOf('buildSettings = {');
    if (bsStart === -1) continue;
    const bsBlockStart = bsStart + 'buildSettings = {'.length;
    const settingsBlock = extractBalancedBlock(blockContent, bsBlockStart);
    if (!settingsBlock) continue;
    
    // Parse build settings
    const buildSettings: Record<string, string> = {};
    // Match unquoted keys (WORD) and quoted keys ("KEY[sdk=...]")
    const settingRegex = /(?:"([^"]+)"|(\w+))\s*=\s*(?:"([^"]*)"|([^";]*))\s*;/g;
    let settingMatch;
    while ((settingMatch = settingRegex.exec(settingsBlock)) !== null) {
      const rawKey = (settingMatch[1] || settingMatch[2]).trim();
      const value = (settingMatch[3] ?? settingMatch[4] ?? '').trim();
      buildSettings[rawKey] = value;
      // Also store without SDK condition suffix so rules can match base key
      const baseKey = rawKey.replace(/\[.*\]$/, '');
      if (baseKey !== rawKey && !(baseKey in buildSettings)) {
        buildSettings[baseKey] = value;
      }
    }
    
    configs.set(id, {
      id,
      name,
      buildSettings,
    });
  }
  
  return configs;
}

/**
 * Extract content between balanced braces, respecting quoted strings.
 * Starts from position after opening brace, returns content up to matching closing brace.
 */
function extractBalancedBlock(content: string, startPos: number): string | null {
  let depth = 1;
  let inQuote = false;
  let i = startPos;
  
  while (i < content.length && depth > 0) {
    const ch = content[i];
    if (ch === '"' && (i === 0 || content[i - 1] !== '\\')) {
      inQuote = !inQuote;
    } else if (!inQuote) {
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
    }
    if (depth > 0) i++;
  }
  
  if (depth !== 0) return null;
  return content.substring(startPos, i);
}

/**
 * Parse XCConfigurationList entries from pbxproj content
 * 
 * @param content The raw pbxproj file content
 * @returns Map of list ID to list object
 */
export function parseConfigurationLists(content: string): Map<string, PbxprojConfigList> {
  const lists = new Map<string, PbxprojConfigList>();
  
  // Match XCConfigurationList entries
  // Format: ID /* ... */ = { isa = XCConfigurationList; buildConfigurations = ( ID1, ID2, ); ... };
  const listRegex = /([A-Fa-f0-9]{24})\s*\/\*[^*]*\*\/\s*=\s*\{[^}]*isa\s*=\s*XCConfigurationList[^}]*buildConfigurations\s*=\s*\(([^)]+)\)/g;
  
  let match;
  while ((match = listRegex.exec(content)) !== null) {
    const id = match[1];
    const configsBlock = match[2];
    
    // Extract config IDs
    const configIds: string[] = [];
    const idRegex = /([A-Fa-f0-9]{24})/g;
    let idMatch;
    while ((idMatch = idRegex.exec(configsBlock)) !== null) {
      configIds.push(idMatch[1]);
    }
    
    lists.set(id, {
      id,
      buildConfigurationIds: configIds,
    });
  }
  
  return lists;
}

/**
 * Get build settings for a specific target
 * 
 * @param content The raw pbxproj file content
 * @param target The target to get settings for
 * @param preferRelease Whether to prefer Release config (default true)
 * @returns Build settings with artifact paths
 */
export function getTargetBuildSettings(
  content: string,
  target: PbxprojTarget,
  preferRelease: boolean = true
): TargetBuildSettings {
  const result: TargetBuildSettings = {
    targetName: target.name,
    productName: target.productName,
  };
  
  if (!target.buildConfigurationListId) {
    return result;
  }
  
  const configLists = parseConfigurationLists(content);
  const configs = parseBuildConfigurations(content);
  
  const configList = configLists.get(target.buildConfigurationListId);
  if (!configList) {
    return result;
  }
  
  // Find the preferred config (Release > Debug > first available)
  let selectedConfig: PbxprojBuildConfig | undefined;
  
  for (const configId of configList.buildConfigurationIds) {
    const config = configs.get(configId);
    if (!config) continue;
    
    const configNameLower = config.name.toLowerCase();
    
    if (preferRelease && configNameLower === 'release') {
      selectedConfig = config;
      break;
    } else if (configNameLower === 'debug') {
      if (!selectedConfig || !preferRelease) {
        selectedConfig = config;
      }
    } else if (!selectedConfig) {
      selectedConfig = config;
    }
  }
  
  if (!selectedConfig) {
    return result;
  }
  
  result.configName = selectedConfig.name;
  
  // Extract artifact paths
  const settings = selectedConfig.buildSettings;
  
  if (settings.INFOPLIST_FILE) {
    result.infoPlistPath = settings.INFOPLIST_FILE;
  }
  
  if (settings.CODE_SIGN_ENTITLEMENTS) {
    result.entitlementsPath = settings.CODE_SIGN_ENTITLEMENTS;
  }
  
  if (settings.PRODUCT_NAME) {
    result.productName = settings.PRODUCT_NAME;
  }
  
  return result;
}

/**
 * Normalize a path by expanding Xcode variables
 * 
 * @param rawPath The path with potential variables
 * @param context Variable substitution context
 * @returns Normalized path
 */
export function normalizeXcodePath(
  rawPath: string,
  context: {
    srcRoot?: string;
    projectDir?: string;
    targetName?: string;
    productName?: string;
  } = {}
): string {
  let result = rawPath;
  
  // Strip surrounding quotes (e.g., "My App/Info.plist" -> My App/Info.plist)
  if ((result.startsWith('"') && result.endsWith('"')) ||
      (result.startsWith("'") && result.endsWith("'"))) {
    result = result.slice(1, -1);
  }
  
  // Iteratively expand variables until no more $() or ${} patterns remain
  // This handles nested variables like $(PRODUCT_NAME) -> $(TARGET_NAME) -> actual value
  const maxIterations = 10; // Prevent infinite loops
  for (let i = 0; i < maxIterations; i++) {
    const before = result;
    
    // Remove $(SRCROOT)/ or ${SRCROOT}/
    result = result.replace(/\$[({]SRCROOT[)}]\/?/g, '');
    
    // Remove $(PROJECT_DIR)/ or ${PROJECT_DIR}/
    result = result.replace(/\$[({]PROJECT_DIR[)}]\/?/g, '');
    
    // Replace $(TARGET_NAME) or ${TARGET_NAME}
    if (context.targetName) {
      result = result.replace(/\$[({]TARGET_NAME[)}]/g, context.targetName);
    }
    
    // Replace $(PRODUCT_NAME) or ${PRODUCT_NAME}
    if (context.productName) {
      result = result.replace(/\$[({]PRODUCT_NAME[)}]/g, context.productName);
    }
    
    // Replace $(inherited) - usually in arrays, remove it
    result = result.replace(/\$[({]inherited[)}]/g, '');
    
    // If no changes were made, we're done
    if (result === before) {
      break;
    }
  }
  
  // Clean up any double slashes
  result = result.replace(/\/\//g, '/');
  
  // Remove leading slash if we stripped $(SRCROOT)
  if (result.startsWith('/') && !rawPath.startsWith('/')) {
    result = result.substring(1);
  }
  
  return result.trim();
}

/**
 * Get the main app target's build settings with normalized paths
 * 
 * This is the main entry point for P1/P2 fix.
 * 
 * @param content The raw pbxproj file content
 * @param projectName Optional project name for target selection
 * @param projectDir Directory containing the project (for path resolution)
 * @returns Target info and normalized artifact paths
 */
export function getMainTargetArtifacts(
  content: string,
  projectName?: string,
  projectDir?: string
): {
  target?: PbxprojTarget;
  settings: TargetBuildSettings;
  infoPlistPath?: string;
  entitlementsPath?: string;
} {
  const targets = parsePbxprojTargets(content);
  const target = getMainAppTarget(targets, projectName);
  
  if (!target) {
    return { settings: {} };
  }
  
  const settings = getTargetBuildSettings(content, target);
  
  // Normalize paths
  const context = {
    targetName: settings.targetName || target.name,
    productName: settings.productName || target.productName,
  };
  
  let infoPlistPath: string | undefined;
  let entitlementsPath: string | undefined;
  
  if (settings.infoPlistPath) {
    const normalized = normalizeXcodePath(settings.infoPlistPath, context);
    infoPlistPath = projectDir ? path.resolve(projectDir, normalized) : normalized;
  }
  
  if (settings.entitlementsPath) {
    const normalized = normalizeXcodePath(settings.entitlementsPath, context);
    entitlementsPath = projectDir ? path.resolve(projectDir, normalized) : normalized;
  }
  
  return {
    target,
    settings,
    infoPlistPath,
    entitlementsPath,
  };
}

/**
 * Get the product type of the main target in a project
 * 
 * Useful for workspace-level scoring.
 * 
 * @param content The raw pbxproj file content
 * @param projectName Optional project name
 * @returns Product type string, or undefined if no target found
 */
export function getMainTargetProductType(
  content: string,
  projectName?: string
): string | undefined {
  const targets = parsePbxprojTargets(content);
  const target = getMainAppTarget(targets, projectName);
  return target?.productType;
}
