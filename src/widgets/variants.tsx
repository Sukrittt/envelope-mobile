// react-native-android-widget always wants a { light, dark } pair and lets
// Android pick between them from the *system* scheme. That's wrong once the
// user has an explicit in-app preference — a user on Light in the app, on a
// dark-mode phone, should get a light widget. Collapsing both keys to the
// same render forces Android's pick, regardless of the system scheme.
import { lightTokens, darkTokens, type ThemeTokens } from '@/src/theme/tokens'
import type { ThemePreference } from '@/src/theme/pref'

export function variants<T>(
  preference: ThemePreference,
  render: (tokens: ThemeTokens, scheme: 'light' | 'dark') => T,
): { light: T; dark: T } {
  if (preference === 'light') {
    const forced = render(lightTokens, 'light')
    return { light: forced, dark: forced }
  }
  if (preference === 'dark') {
    const forced = render(darkTokens, 'dark')
    return { light: forced, dark: forced }
  }
  return { light: render(lightTokens, 'light'), dark: render(darkTokens, 'dark') }
}
