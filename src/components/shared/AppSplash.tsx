import { useState } from 'react'
import { Image, StyleSheet, View } from 'react-native'
import { DotLottie } from '@lottiefiles/dotlottie-react-native'

/** Same animation as the app icon's first frame, for continuity between the
 *  native launch image and this JS-level splash (see app/loading.tsx). */
const SPLASH_LOTTIE = 'https://lottie.host/8357c563-a0ff-4e2b-b536-0860b6aa163c/UR7nGs9eH9.lottie'
const MARK = 260

export function AppSplash() {
  // This screen shows on every cold boot, so a network hiccup fetching the
  // remote .lottie must not blank it — fall back to the static app icon,
  // same reasoning as expense-failed.tsx's lottieFailed guard.
  const [lottieFailed, setLottieFailed] = useState(false)

  return (
    <View style={styles.container}>
      {lottieFailed ? (
        <Image source={require('@/assets/icon.png')} style={styles.fallback} resizeMode="contain" />
      ) : (
        <DotLottie
          source={{ uri: SPLASH_LOTTIE }}
          style={styles.lottie}
          autoplay
          loop
          onLoadError={() => setLottieFailed(true)}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4511e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lottie: { width: MARK, height: MARK },
  fallback: { width: MARK * 0.7, height: MARK * 0.7, borderRadius: 24 },
})
