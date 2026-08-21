// Shared WorkOS sign-in hook, used by the unlock screen and the More tab's
// guest → signed-in upgrade.
import { useCallback, useEffect, useState } from 'react'
import * as AuthSession from 'expo-auth-session'
import * as WebBrowser from 'expo-web-browser'
import { CLIENT_ID, DISCOVERY, REDIRECT_URI, exchangeCode } from './workos'
import { persistSession } from './accessMode'

// Closes the auth browser tab once the redirect lands (no-op on native, needed
// for web builds).
WebBrowser.maybeCompleteAuthSession()

export interface SignInState {
  /** Opens Google's consent screen directly (no AuthKit picker page). */
  signIn: () => void
  /** True from tapping sign-in until the token exchange settles. */
  pending: boolean
  /** True once tokens are stored — let the caller animate before navigating. */
  done: boolean
  error: string | null
}

export function useSignIn(): SignInState {
  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: CLIENT_ID,
      redirectUri: REDIRECT_URI,
      responseType: AuthSession.ResponseType.Code,
      // PKCE: expo-auth-session generates the verifier and S256 challenge and
      // checks `state` on the way back, so the app ships no client secret.
      usePKCE: true,
      scopes: [],
      // GoogleOAuth skips the AuthKit picker — straight to Google's consent screen.
      extraParams: { provider: 'GoogleOAuth' },
    },
    DISCOVERY,
  )

  const [pending, setPending] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!response) return

    if (response.type === 'error') {
      setPending(false)
      setError(response.params?.error_description ?? 'Sign-in failed. Try again.')
      return
    }
    if (response.type !== 'success') {
      // 'cancel' / 'dismiss' — the user backed out; not an error.
      setPending(false)
      return
    }

    const verifier = request?.codeVerifier
    if (!verifier) {
      setPending(false)
      setError('Sign-in failed. Try again.')
      return
    }

    let cancelled = false
    exchangeCode(response.params.code, verifier)
      .then(async (tokens) => {
        if (cancelled) return
        await persistSession(tokens)
        setDone(true)
      })
      .catch(() => {
        if (!cancelled) setError('Could not complete sign-in. Check your connection.')
      })
      .finally(() => {
        if (!cancelled) setPending(false)
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [response])

  const signIn = useCallback(() => {
    if (!CLIENT_ID) {
      setError('EXPO_PUBLIC_WORKOS_CLIENT_ID is not set')
      return
    }
    setError(null)
    setPending(true)
    void promptAsync()
  }, [promptAsync])

  return { signIn, pending, done, error }
}
