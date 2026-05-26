const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add ogg to the asset source extensions so React Native's Metro bundler can resolve them
if (!config.resolver.assetExts.includes('ogg')) {
  config.resolver.assetExts.push('ogg');
}

// Prevent duplicate Android raw resource names when both .ogg and .wav
// versions exist for the same base filename (e.g., song1.ogg + song1.wav).
config.resolver.assetExts = config.resolver.assetExts.filter((ext) => ext !== 'wav');

module.exports = config;
