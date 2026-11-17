const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

config.watchFolders = Array.from(
  new Set([...(config.watchFolders ?? []), path.resolve(__dirname, '../..')])
);

config.resolver = config.resolver ?? {};
config.resolver.assetExts = [...(config.resolver.assetExts ?? []), 'wasm'];

config.server = config.server ?? {};
const prevEnhanceMiddleware = config.server.enhanceMiddleware;
config.server.enhanceMiddleware = (middleware, server) => {
  const baseMiddleware = prevEnhanceMiddleware
    ? prevEnhanceMiddleware(middleware, server)
    : middleware;

  return (req, res, next) => {
    const expoPlatform = String(req.headers?.['expo-platform'] ?? '').toLowerCase();
    if (expoPlatform !== 'android' && expoPlatform !== 'ios') {
      res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
      res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    }
    return baseMiddleware(req, res, next);
  };
};

module.exports = config;
