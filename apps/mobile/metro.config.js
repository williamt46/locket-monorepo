const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

// Find the project and workspace directories
const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Watch all files within the monorepo
config.watchFolders.push(workspaceRoot);

// 2. Let Metro know where to resolve packages and in what order
config.resolver.nodeModulesPaths.push(
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules')
);

// 3. Force Metro to resolve (sub)dependencies only from the `nodeModulesPaths`
// This prevents errors where multiple versions of the same package are loaded
config.resolver.disableHierarchicalLookup = false;

// Add WASM support
config.resolver.assetExts.push('wasm');
config.resolver.sourceExts.push('mjs');

module.exports = config;
