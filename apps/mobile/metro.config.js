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

// 4. Add .mjs to source extensions for ESM compatibility
config.resolver.sourceExts.push('mjs');

// 5. Force @nucypher/umbral-pre to resolve to pkg-bundler (our wasm2js-patched entry).
//    The package has "main" → pkg-node (uses fs + WebAssembly) and "browser" → pkg-bundler.
//    Metro sometimes picks the wrong one in a monorepo, so force it explicitly.
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === '@nucypher/umbral-pre') {
    const bundlerPath = path.resolve(
      workspaceRoot,
      'node_modules/@nucypher/umbral-pre/pkg-bundler/umbral_pre_wasm.js'
    );
    return { type: 'sourceFile', filePath: bundlerPath };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
