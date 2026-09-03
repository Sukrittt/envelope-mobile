import { useEffect } from 'react'
import { useAudioPlayer } from 'expo-audio'

/** Loops the Wrapped background track while the story is playing and unmuted. */
export function useWrappedMusic(active: boolean) {
  const player = useAudioPlayer(require('@/assets/sounds/wrapped-loop.m4a'))

  useEffect(() => {
    player.loop = true
  }, [player])

  useEffect(() => {
    if (active) {
      player.play()
    } else {
      player.pause()
    }
  }, [active, player])
}
