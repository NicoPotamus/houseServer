const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add the following configuration for react-native-webrtc
config.resolver.alias = {
  ...config.resolver.alias,
  'react-native-webrtc': 'react-native-webrtc/lib/index.js',
};

module.exports = config;
