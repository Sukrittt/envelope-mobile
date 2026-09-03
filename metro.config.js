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

// Drop the 962 KB Material Symbols font. Nothing in the app asks for it:
// expo-router's native-tabs imports expo-symbols, which imports the font, and
// the module graph reaches that whether or not a NativeTabs is ever rendered.
// This app navigates with src/components/nav/FloatingNav.tsx and has no native
// tabs, so the font is pure weight. If NativeTabs is ever adopted, delete this
// block — the icons will render as blank glyphs until it's gone.
const emptyModule = { type: 'empty' }
const defaultResolveRequest = config.resolver.resolveRequest
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith('@expo-google-fonts/material-symbols')) return emptyModule
  return defaultResolveRequest
    ? defaultResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform)
}

module.exports = config
