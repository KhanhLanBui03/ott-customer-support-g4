const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Workaround for Windows "node:sea" ENOENT error
if (process.platform === 'win32') {
  config.resolver.unstable_enablePackageExports = false;
}

module.exports = config;
