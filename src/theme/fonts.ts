// Import each weight from its own subpath, never from the package root.
// Metro doesn't tree-shake, so `from '@expo-google-fonts/nunito'` pulls that
// package's index, which requires all 16 weights (every italic included) and
// ships every one of them in the APK. The subpath entry points require exactly
// one .ttf each, so only the 8 weights below get bundled.
import { useFonts } from 'expo-font'
import { Fredoka_500Medium } from '@expo-google-fonts/fredoka/500Medium'
import { Fredoka_600SemiBold } from '@expo-google-fonts/fredoka/600SemiBold'
import { Fredoka_700Bold } from '@expo-google-fonts/fredoka/700Bold'
import { Nunito_500Medium } from '@expo-google-fonts/nunito/500Medium'
import { Nunito_600SemiBold } from '@expo-google-fonts/nunito/600SemiBold'
import { Nunito_700Bold } from '@expo-google-fonts/nunito/700Bold'
import { Nunito_800ExtraBold } from '@expo-google-fonts/nunito/800ExtraBold'
import { Nunito_900Black } from '@expo-google-fonts/nunito/900Black'

export const fontFamily = {
  displayMedium: 'Fredoka_500Medium',
  displaySemiBold: 'Fredoka_600SemiBold',
  displayBold: 'Fredoka_700Bold',
  bodyMedium: 'Nunito_500Medium',
  bodySemiBold: 'Nunito_600SemiBold',
  bodyBold: 'Nunito_700Bold',
  bodyExtraBold: 'Nunito_800ExtraBold',
  bodyBlack: 'Nunito_900Black',
} as const

export function useAppFonts() {
  return useFonts({
    Fredoka_500Medium,
    Fredoka_600SemiBold,
    Fredoka_700Bold,
    Nunito_500Medium,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
    Nunito_900Black,
  })
}
