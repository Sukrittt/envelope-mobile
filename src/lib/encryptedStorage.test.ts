import AsyncStorage from '@react-native-async-storage/async-storage'
import { readEncrypted, writeEncrypted } from './encryptedStorage'

it('preserves an undecryptable blob for recovery', async () => {
  await writeEncrypted('some-key', { foo: 'bar' })
  const raw = await AsyncStorage.getItem('some-key')
  await AsyncStorage.setItem('some-key', raw!.slice(0, -4) + 'abcd')

  await expect(readEncrypted('some-key')).rejects.toThrow()
  await expect(AsyncStorage.getItem('some-key')).resolves.toBe(raw!.slice(0, -4) + 'abcd')
})

it('reads back what it wrote (Android fromCombined takes bytes, not base64)', async () => {
  await writeEncrypted('round-trip', [{ name: 'Food' }])
  await expect(readEncrypted('round-trip')).resolves.toEqual([{ name: 'Food' }])
})
