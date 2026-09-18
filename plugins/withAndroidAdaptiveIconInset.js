const fs = require('fs');
const path = require('path');

const { withFinalizedMod } = require('@expo/config-plugins');

const LAUNCHER_FILES = ['ic_launcher.xml', 'ic_launcher_round.xml'];
const DEFAULT_INSET_DP = 16;

function insetDrawable(drawable, insetDp) {
  return `<?xml version="1.0" encoding="utf-8"?>
<inset xmlns:android="http://schemas.android.com/apk/res/android"
    android:drawable="${drawable}"
    android:inset="${insetDp}dp" />
`;
}

/**
 * Expo renders adaptive-icon foregrounds onto the full 108dp layer. Launchers
 * then crop that layer to their mask, so artwork that looks modest in the PNG
 * can appear much larger on-device. Wrap the generated foreground resources in
 * an Android inset drawable to keep the bird inside the adaptive-icon safe zone.
 */
module.exports = function withAndroidAdaptiveIconInset(config, options = {}) {
  const insetDp = options.insetDp ?? DEFAULT_INSET_DP;

  if (!Number.isFinite(insetDp) || insetDp < 0 || insetDp >= 54) {
    throw new Error('Android adaptive icon insetDp must be between 0 and 54.');
  }

  return withFinalizedMod(config, [
    'android',
    async (finalizedConfig) => {
      const resDir = path.join(
        finalizedConfig.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'res'
      );
      const drawableDir = path.join(resDir, 'drawable');
      const adaptiveIconDir = path.join(resDir, 'mipmap-anydpi-v26');

      await fs.promises.mkdir(drawableDir, { recursive: true });
      await fs.promises.writeFile(
        path.join(drawableDir, 'ic_launcher_foreground_inset.xml'),
        insetDrawable('@mipmap/ic_launcher_foreground', insetDp)
      );
      await fs.promises.writeFile(
        path.join(drawableDir, 'ic_launcher_monochrome_inset.xml'),
        insetDrawable('@mipmap/ic_launcher_monochrome', insetDp)
      );

      for (const launcherFile of LAUNCHER_FILES) {
        const launcherPath = path.join(adaptiveIconDir, launcherFile);
        const source = await fs.promises.readFile(launcherPath, 'utf8');
        const updated = source
          .replace(
            '@mipmap/ic_launcher_foreground',
            '@drawable/ic_launcher_foreground_inset'
          )
          .replace(
            '@mipmap/ic_launcher_monochrome',
            '@drawable/ic_launcher_monochrome_inset'
          );

        if (updated === source) {
          throw new Error(`Could not apply adaptive icon inset to ${launcherPath}.`);
        }

        await fs.promises.writeFile(launcherPath, updated);
      }

      return finalizedConfig;
    },
  ]);
};
