import AsyncStorage from '@react-native-async-storage/async-storage'
import { AESEncryptionKey, AESSealedData, aesDecryptAsync, aesEncryptAsync } from 'expo-crypto'
import * as SecureStore from 'expo-secure-store'

const KEY = 'mc-offline-aes-key'
const PREFIX = 'aes-gcm-v1:'
let keyPromise: Promise<AESEncryptionKey> | undefined

function encryptionKey(): Promise<AESEncryptionKey> {
  if (!keyPromise) {
    keyPromise = (async () => {
      const stored = await SecureStore.getItemAsync(KEY)
      if (stored) return AESEncryptionKey.import(stored, 'hex')
      const key = await AESEncryptionKey.generate(256)
      await SecureStore.setItemAsync(KEY, await key.encoded('hex'), {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      })
      return key
    })().catch(error => { keyPromise = undefined; throw error })
  }
  return keyPromise
}

export async function writeEncrypted(key: string, value: unknown): Promise<void> {
  const sealed = await aesEncryptAsync(new TextEncoder().encode(JSON.stringify(value)), await encryptionKey(), {
    additionalData: new TextEncoder().encode(key),
  })
  await AsyncStorage.setItem(key, PREFIX + await sealed.combined('base64'))
}

export async function readEncrypted<T>(key: string): Promise<T | null> {
  const raw = await AsyncStorage.getItem(key)
  if (!raw) return null
  if (!raw.startsWith(PREFIX)) {
    // Migrate existing queues in place before returning their contents.
    const value = JSON.parse(raw) as T
    await writeEncrypted(key, value)
    return value
  }
  const plaintext = await aesDecryptAsync(AESSealedData.fromCombined(raw.slice(PREFIX.length)), await encryptionKey(), {
    additionalData: new TextEncoder().encode(key),
  })
  return JSON.parse(new TextDecoder().decode(plaintext)) as T
}
