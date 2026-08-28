import { useEffect } from 'react'
import { useAudioPlayer } from 'expo-audio'

/**
 * Plays the success chime once, on mount. Mount *is* the trigger — every caller
 * renders only after the thing succeeded, so there is no "did it succeed" flag
 * to thread through. Shared so the chime stays one sound in one place: the
 * inline CheckIcon and the expense-added screen both go through here.
 */
export function useSuccessChime() {
  const player = useAudioPlayer(require('@/assets/sounds/success.wav'))

  useEffect(() => {
    player.play()
  }, [player])
}
