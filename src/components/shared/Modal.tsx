import type { ReactNode } from 'react'
import { Modal as RNModal, Pressable, KeyboardAvoidingView, Keyboard, Platform, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '@/src/theme/ThemeProvider'

interface Props {
  visible: boolean
  onClose: () => void
  children: ReactNode
}

/**
 * Reusable bottom-sheet: backdrop + slide-up card. RN's built-in Modal already
 * animates the slide (proven in investments.tsx's inline action sheet) — no
 * Animated/reanimated needed for this. Exported as `BottomSheet` (not `Modal`)
 * so importers don't shadow react-native's own `Modal`.
 */
export function BottomSheet({ visible, onClose, children }: Props) {
  const { tokens } = useTheme()
  const insets = useSafeAreaInsets()

  // First backdrop tap just dismisses the keyboard; a second tap closes the sheet.
  const handleBackdrop = () => (Keyboard.isVisible() ? Keyboard.dismiss() : onClose())

  return (
    <RNModal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={styles.backdrop} onPress={handleBackdrop}>
          <Pressable
            style={[
              styles.sheet,
              { backgroundColor: tokens.modalStrong, borderColor: tokens.borderStrong, paddingBottom: insets.bottom + 16 },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            {children}
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </RNModal>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, borderBottomWidth: 0, padding: 16 },
})
