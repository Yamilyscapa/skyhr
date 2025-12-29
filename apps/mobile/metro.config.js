// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Required for Better Auth to resolve package exports correctly
config.resolver.unstable_enablePackageExports = true;

module.exports = config;
