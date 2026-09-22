// Links a Google identity to the signed-in account. Mirrors useSignIn.ts's
// PKCE flow, but must NOT persist the resulting tokens unconditionally —
// picking a different Google account than the one signed in would silently
// switch the app to that other WorkOS user. tokenUserId() vs currentUserId()
// is the guard.
import { useCallback, useEffect, useState } from 'react'
import * as AuthSession from 'expo-auth-session'
import * as WebBrowser from 'expo-web-browser'
import { CLIENT_ID, DISCOVERY, REDIRECT_URI, exchangeCode, tokenUserId } from './workos'
import { currentUserId, persistSession } from './accessMode'

WebBrowser.maybeCompleteAuthSession()

export interface LinkGoogleState {
  link: () => void
  pending: boolean
  done: boolean
  error: string | null
}

export function useLinkGoogle(): LinkGoogleState {
  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: CLIENT_ID,
      redirectUri: REDIRECT_URI,
      responseType: AuthSession.ResponseType.Code,
      usePKCE: true,
      scopes: [],
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
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing to the OAuth browser flow's async result, an external system
      setPending(false)
      setError(response.params?.error_description ?? 'Could not link Google.')
      return
    }
    if (response.type !== 'success') {
      setPending(false)
      return
    }

    const verifier = request?.codeVerifier
    if (!verifier) {
      setPending(false)
      setError('Could not link Google.')
      return
    }

    let cancelled = false
    exchangeCode(response.params.code, verifier)
      .then(async (tokens) => {
        if (cancelled) return
        const linkedUserId = tokenUserId(tokens.accessToken)
        const existingUserId = currentUserId()
        if (existingUserId && linkedUserId !== existingUserId) {
          setError('That Google account belongs to a different user.')
          return
        }
        // Same account — WorkOS has already linked the identity server-side.
        // Refreshing the stored tokens here is harmless (same user).
        await persistSession(tokens)
        setDone(true)
      })
      .catch(() => {
        if (!cancelled) setError('Could not link Google. Check your connection.')
      })
      .finally(() => {
        if (!cancelled) setPending(false)
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [response])

  const link = useCallback(() => {
    if (!CLIENT_ID) {
      setError('EXPO_PUBLIC_WORKOS_CLIENT_ID is not set')
      return
    }
    setError(null)
    setPending(true)
    void promptAsync()
  }, [promptAsync])

  return { link, pending, done, error }
}
