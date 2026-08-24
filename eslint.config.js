// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*", ".claude/**"],
  },
  {
    // The React Compiler-derived hook rules (refs/immutability/set-state-in-effect)
    // fire heavily on react-native-reanimated's shared-value/worklet patterns, which
    // intentionally don't follow plain-React rules. Downgraded to warn until those
    // are triaged file-by-file; exhaustive-deps and everything else stays as errors
    // via eslint-config-expo's defaults.
    rules: {
      "react-hooks/refs": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);
