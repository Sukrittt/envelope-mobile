const { getDefaultConfig } = require('expo/metro-config')

const config = getDefaultConfig(__dirname)

// Test files are co-located as *.test.ts(x) next to their source (see CLAUDE.md),
// including under app/. expo-router's require.context scans the whole app
// directory for routes, so without this they get bundled into the app and pull
// in @testing-library/react-native -> Node's `console` module, which Metro can't
// polyfill. The default blockList only excludes __tests__/ folders, not this
// naming convention.
config.resolver.blockList = [...config.resolver.blockList, /\.test\.[jt]sx?$/]

// .lottie is a zip, not JS — Metro has to bundle it as an asset for
// `require('@/assets/animations/*.lottie')` to resolve.
config.resolver.assetExts = [...config.resolver.assetExts, 'lottie']

module.exports = config
