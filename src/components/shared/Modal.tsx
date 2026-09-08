import type { ReactNode } from 'react'
import { Modal as RNModal, Pressable, KeyboardAvoidingView, Keyboard, Platform, ScrollView, StyleSheet } from 'react-native'
import Reanimated, { LinearTransition } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '@/src/theme/ThemeProvider'

interface Props {
  visible: boolean
  onClose: () => void
  children: ReactNode
}

// House spring, reused from CategoryBreakdown.tsx's LIST_TRANSITION — animates
// the card's height when its content's does (e.g. a filter sheet's tab switch).
const SHEET_TRANSITION = LinearTransition.springify().damping(64).stiffness(700)

// Declared once at module scope: creating this per-render would remount the
// sheet's whole subtree on every render.
const AnimatedSheet = Reanimated.createAnimatedComponent(Pressable)

/**
 * Reusable bottom-sheet: backdrop + slide-up card. RN's built-in Modal already
 * animates the slide (proven in investments.tsx's inline action sheet), so
 * open/close needs no Animated/reanimated — but the card itself is a
 * reanimated view so it eases between heights when its content resizes
 * (e.g. CategoryBreakdown's filter sheet swapping Categories/Groups tabs)
 * instead of snapping. Exported as `BottomSheet` (not `Modal`) so importers
 * don't shadow react-native's own `Modal`.
 */
export function BottomSheet({ visible, onClose, children }: Props) {
  const { tokens } = useTheme()
  const insets = useSafeAreaInsets()

  // First backdrop tap just dismisses the keyboard; a second tap closes the sheet.
  const handleBackdrop = () => (Keyboard.isVisible() ? Keyboard.dismiss() : onClose())

  return (
    <RNModal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      // Android edge-to-edge: RN's Modal opens as its own Dialog window, which by
      // default stops short of the status/nav bars, exposing the screen behind it
      // there. These make the Dialog draw full-bleed like the rest of the app.
      statusBarTranslucent
      navigationBarTranslucent
    >
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable testID="bottom-sheet-backdrop" style={styles.backdrop} onPress={handleBackdrop}>
          <AnimatedSheet
            layout={SHEET_TRANSITION}
            style={[
              styles.sheet,
              { backgroundColor: tokens.modalStrong, borderColor: tokens.borderStrong, maxHeight: '85%' },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <ScrollView
              contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 16 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {children}
            </ScrollView>
          </AnimatedSheet>
        </Pressable>
      </KeyboardAvoidingView>
    </RNModal>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderBottomWidth: 0,
    overflow: 'hidden', // clip content while the card's height animates
  },
})
