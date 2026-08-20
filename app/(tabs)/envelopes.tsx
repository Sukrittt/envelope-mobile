import { useEffect, useMemo, useRef, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Modal,
  TextInput,
  StyleSheet,
  Alert,
  Animated,
  PanResponder,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { AnimatedTabContent } from '@/src/components/nav/AnimatedTabContent'
import { useTheme } from '@/src/theme/ThemeProvider'
import type { ThemeTokens } from '@/src/theme/tokens'
import { fontFamily } from '@/src/theme/fonts'
import {
  useCategories,
  useAddCategory,
  useUpdateCategory,
  useDeleteCategory,
  useMoveCategory,
} from '@/src/hooks/useCategories'
import { useGroups, useAddGroup, useUpdateGroup, useDeleteGroup } from '@/src/hooks/useGroups'
import { groupEmoji, splitEmoji } from '@/src/lib/emoji'
import { LoadingCaption } from '@/src/components/shared/LoadingCaption'
import { CheckIcon } from '@/src/components/shared/CheckIcon'
import type { CategoryRow } from '@/src/types'

const OTHER_LABEL = 'Other'
const ROW_HEIGHT = 45

function DraggableCategoryList({
  items,
  tokens,
  onReorder,
  onRename,
  onDelete,
  deleteSuccessName,
}: {
  items: CategoryRow[]
  tokens: ThemeTokens
  onReorder: (name: string, toIndex: number) => void
  onRename: (name: string) => void
  onDelete: (name: string) => void
  deleteSuccessName: string | null
}) {
  // react-query's cache notifications land on a setTimeout(0), a tick after React's own
  // state updates commit — clearing drag state on drop would flash the old order for a
  // frame before the query catches up. Keep a local order, synced from items, and reorder
  // it synchronously on drop so both updates land in the same render.
  const [order, setOrder] = useState(() => items.map((c) => c.name))
  useEffect(() => {
    setOrder(items.map((c) => c.name))
  }, [items])
  const byName = useMemo(() => new Map(items.map((c) => [c.name, c])), [items])

  const rowHeight = useRef(ROW_HEIGHT)
  const dragY = useRef(new Animated.Value(0)).current
  const [drag, setDrag] = useState<{ name: string; start: number; target: number } | null>(null)
  const dragRef = useRef(drag)
  dragRef.current = drag

  // Index of each row by name, kept current every render so responders (created once, below)
  // always know the row's latest position without needing to be recreated mid-gesture.
  const indexRefs = useRef(new Map<string, { current: number }>())
  order.forEach((name, i) => {
    const ref = indexRefs.current.get(name)
    if (ref) ref.current = i
    else indexRefs.current.set(name, { current: i })
  })
  const orderLengthRef = useRef(order.length)
  orderLengthRef.current = order.length

  // PanResponder holds gesture-tracking state internally, so each row's instance must stay
  // stable across re-renders — recreating it mid-drag desyncs it from the live touch.
  const respondersRef = useRef(new Map<string, ReturnType<typeof PanResponder.create>>())
  function responderFor(name: string) {
    const existing = respondersRef.current.get(name)
    if (existing) return existing
    const indexRef = indexRefs.current.get(name)!
    const responder = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        dragY.setValue(0)
        setDrag({ name, start: indexRef.current, target: indexRef.current })
      },
      onPanResponderMove: (_evt, gesture) => {
        dragY.setValue(gesture.dy)
        const prev = dragRef.current
        if (!prev || prev.name !== name) return
        const offset = Math.round(gesture.dy / rowHeight.current)
        const target = Math.min(orderLengthRef.current - 1, Math.max(0, prev.start + offset))
        if (target === prev.target) return
        setDrag({ ...prev, target })
      },
      onPanResponderRelease: () => {
        dragY.setValue(0)
        const prev = dragRef.current
        setDrag(null)
        if (prev && prev.name === name && prev.target !== prev.start) {
          setOrder((cur) => {
            const idx = cur.indexOf(prev.name)
            if (idx === -1) return cur
            const next = [...cur]
            next.splice(idx, 1)
            next.splice(prev.target, 0, prev.name)
            return next
          })
          onReorder(prev.name, prev.target)
        }
      },
      onPanResponderTerminate: () => {
        dragY.setValue(0)
        setDrag(null)
      },
    })
    respondersRef.current.set(name, responder)
    return responder
  }

  return (
    <>
      {order.map((name, i) => {
        const cat = byName.get(name)
        if (!cat) return null
        const isDragging = drag?.name === cat.name
        let shift = 0
        if (drag && !isDragging) {
          if (drag.target > drag.start && i > drag.start && i <= drag.target) shift = -1
          else if (drag.target < drag.start && i >= drag.target && i < drag.start) shift = 1
        }
        const responder = responderFor(cat.name)
        return (
          <Animated.View
            key={cat.name}
            onLayout={(e) => {
              rowHeight.current = e.nativeEvent.layout.height
            }}
            style={[
              styles.catRow,
              { borderTopColor: tokens.border },
              isDragging
                ? {
                    transform: [{ translateY: dragY }],
                    zIndex: 10,
                    elevation: 4,
                    backgroundColor: tokens.chipActiveBg,
                  }
                : shift !== 0
                  ? { transform: [{ translateY: shift * rowHeight.current }] }
                  : null,
            ]}
          >
            <Text
              style={[styles.catName, { color: tokens.text, fontFamily: fontFamily.bodyMedium }]}
              numberOfLines={1}
            >
              {cat.name}
            </Text>
            <View style={styles.catActions}>
              <Pressable onPress={() => onRename(cat.name)} hitSlop={6}>
                <Text style={{ fontSize: 13 }}>✏️</Text>
              </Pressable>
              <Pressable onPress={() => onDelete(cat.name)} hitSlop={6} disabled={deleteSuccessName === cat.name}>
                {deleteSuccessName === cat.name ? (
                  <CheckIcon color={tokens.mint} size={13} />
                ) : (
                  <Text style={{ fontSize: 13 }}>🗑️</Text>
                )}
              </Pressable>
              <View {...responder.panHandlers} hitSlop={8} style={styles.dragHandle}>
                <Text style={{ color: tokens.text2, fontSize: 16 }}>≡</Text>
              </View>
            </View>
          </Animated.View>
        )
      })}
    </>
  )
}

type ModalState =
  | { kind: 'addCategory' }
  | { kind: 'renameCategory'; name: string }
  | { kind: 'addGroup' }
  | { kind: 'renameGroup'; name: string }

export default function EnvelopesScreen() {
  const { tokens } = useTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()

  const categoriesQ = useCategories()
  const groupsQ = useGroups()
  const addCategory = useAddCategory()
  const updateCategory = useUpdateCategory()
  const deleteCategory = useDeleteCategory()
  const moveCategory = useMoveCategory()
  const addGroup = useAddGroup()
  const updateGroup = useUpdateGroup()
  const deleteGroup = useDeleteGroup()

  const [modal, setModal] = useState<ModalState | null>(null)
  const [nameInput, setNameInput] = useState('')
  const [groupInput, setGroupInput] = useState('')
  const [modalError, setModalError] = useState('')
  const [modalSuccess, setModalSuccess] = useState(false)
  const [categoryDeleteSuccess, setCategoryDeleteSuccess] = useState<string | null>(null)
  const [groupDeleteSuccess, setGroupDeleteSuccess] = useState<string | null>(null)

  const categories = categoriesQ.data ?? []
  const groups = groupsQ.data ?? []

  const groupedCategories = useMemo(() => {
    const byGroup = new Map<string, CategoryRow[]>()
    for (const c of categories) {
      const g = c.group || ''
      const arr = byGroup.get(g) ?? []
      arr.push(c)
      byGroup.set(g, arr)
    }
    const named = groups.map((g) => ({ name: g, items: byGroup.get(g) ?? [] }))
    const other = byGroup.get('') ?? []
    return other.length > 0 ? [...named, { name: '', items: other }] : named
  }, [categories, groups])

  function openAddCategory(group = '') {
    setNameInput('')
    setGroupInput(group)
    setModalError('')
    setModalSuccess(false)
    setModal({ kind: 'addCategory' })
  }
  function openRenameCategory(name: string) {
    setNameInput(name)
    setModalError('')
    setModalSuccess(false)
    setModal({ kind: 'renameCategory', name })
  }
  function openAddGroup() {
    setNameInput('')
    setModalError('')
    setModalSuccess(false)
    setModal({ kind: 'addGroup' })
  }
  function openRenameGroup(name: string) {
    setNameInput(name)
    setModalError('')
    setModalSuccess(false)
    setModal({ kind: 'renameGroup', name })
  }
  function closeModal() {
    setModal(null)
    setModalError('')
    setModalSuccess(false)
  }

  const submitting =
    addCategory.isPending || updateCategory.isPending || addGroup.isPending || updateGroup.isPending

  // Let the inline checkmark finish drawing before closing the modal.
  useEffect(() => {
    if (!modalSuccess) return
    const timer = setTimeout(closeModal, 1100)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalSuccess])

  async function submitModal() {
    if (!modal) return
    const trimmed = nameInput.trim()
    if (!trimmed) return
    try {
      if (modal.kind === 'addCategory') {
        await addCategory.mutateAsync({ name: trimmed, group: groupInput })
      } else if (modal.kind === 'renameCategory') {
        if (trimmed !== modal.name) {
          await updateCategory.mutateAsync({ name: modal.name, updates: { newName: trimmed } })
        }
      } else if (modal.kind === 'addGroup') {
        await addGroup.mutateAsync(trimmed)
      } else if (modal.kind === 'renameGroup') {
        if (trimmed !== modal.name) {
          await updateGroup.mutateAsync({ name: modal.name, newName: trimmed })
        }
      }
      setModalSuccess(true)
    } catch (err) {
      setModalError(
        err instanceof Error && err.message.includes('409')
          ? 'That name is already taken.'
          : 'Something went wrong. Try again.',
      )
    }
  }

  function confirmDeleteCategory(name: string) {
    Alert.alert('Remove category', `Remove "${name}"? Past transactions are kept.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => deleteCategory.mutate(name, { onSuccess: () => setCategoryDeleteSuccess(name) }),
      },
    ])
  }

  function confirmDeleteGroup(name: string) {
    Alert.alert('Delete group', `Delete "${name}"? Its categories move to Other.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteGroup.mutate(name, { onSuccess: () => setGroupDeleteSuccess(name) }),
      },
    ])
  }

  const isLoading = categoriesQ.isLoading || groupsQ.isLoading
  const hasError = categoriesQ.error || groupsQ.error

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: tokens.bg }]}>
        <LoadingCaption />
      </View>
    )
  }

  if (hasError) {
    return (
      <View style={[styles.center, { backgroundColor: tokens.bg, paddingHorizontal: 32 }]}>
        <Text style={{ color: tokens.coral, fontFamily: fontFamily.bodyMedium, textAlign: 'center' }}>
          Couldn't load your categories. Check your connection and reopen the app.
        </Text>
      </View>
    )
  }

  return (
    <View style={[styles.screen, { backgroundColor: tokens.bg }]}>
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + 14, backgroundColor: tokens.headerBg, borderBottomColor: tokens.border },
        ]}
      >
        <View style={styles.headerTop}>
          <View style={styles.headerTitleRow}>
            <Text style={[styles.title, { color: tokens.text, fontFamily: fontFamily.displaySemiBold }]}>
              Envelopes
            </Text>
          </View>
          <Pressable
            onPress={() => openAddCategory()}
            style={[styles.addCategoryBtn, { backgroundColor: tokens.gold }]}
          >
            <Text style={{ color: tokens.onAccent, fontSize: 12, fontFamily: fontFamily.bodySemiBold }}>
              + Category
            </Text>
          </Pressable>
        </View>
        <Text style={{ color: tokens.text2, fontSize: 12, marginTop: 6, fontFamily: fontFamily.bodyMedium }}>
          {categories.length} categor{categories.length === 1 ? 'y' : 'ies'} · {groups.length} group
          {groups.length === 1 ? '' : 's'}
        </Text>
      </View>

      <AnimatedTabContent>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent}>
        {groupedCategories.map(({ name, items }) => (
          <View key={name || OTHER_LABEL} style={[styles.card, { backgroundColor: tokens.card, borderColor: tokens.border }]}>
            <View style={styles.groupHeader}>
              <View style={styles.groupHeaderLeft}>
                <Text style={{ fontSize: 14 }}>{name ? groupEmoji(name) : '📁'}</Text>
                <Text
                  style={[styles.groupName, { color: tokens.text, fontFamily: fontFamily.bodyExtraBold }]}
                  numberOfLines={1}
                >
                  {name ? splitEmoji(name).text : OTHER_LABEL}
                </Text>
                <Text style={{ color: tokens.text2, fontSize: 11, fontFamily: fontFamily.bodyMedium }}>
                  {items.length}
                </Text>
              </View>
              {name !== '' && (
                <View style={styles.groupHeaderActions}>
                  <Pressable onPress={() => openRenameGroup(name)} hitSlop={8}>
                    <Text style={{ fontSize: 14 }}>✏️</Text>
                  </Pressable>
                  <Pressable onPress={() => confirmDeleteGroup(name)} hitSlop={8} disabled={groupDeleteSuccess === name}>
                    {groupDeleteSuccess === name ? (
                      <CheckIcon color={tokens.mint} size={14} />
                    ) : (
                      <Text style={{ fontSize: 14 }}>🗑️</Text>
                    )}
                  </Pressable>
                </View>
              )}
            </View>

            {items.length === 0 && (
              <Text style={{ color: tokens.text3, fontSize: 12, marginTop: 6, fontFamily: fontFamily.bodyMedium }}>
                No categories yet.
              </Text>
            )}

            <DraggableCategoryList
              items={items}
              tokens={tokens}
              onReorder={(catName, toIndex) => moveCategory.mutate({ name: catName, toIndex })}
              onRename={openRenameCategory}
              onDelete={confirmDeleteCategory}
              deleteSuccessName={categoryDeleteSuccess}
            />

            <Pressable onPress={() => openAddCategory(name)} style={styles.addToGroupBtn} hitSlop={4}>
              <Text style={{ color: tokens.text2, fontSize: 12, fontFamily: fontFamily.bodySemiBold }}>
                + Category
              </Text>
            </Pressable>
          </View>
        ))}

        <Pressable
          onPress={openAddGroup}
          style={[styles.addGroupBtn, { borderColor: tokens.borderStrong }]}
        >
          <Text style={{ color: tokens.text2, fontSize: 13, fontFamily: fontFamily.bodySemiBold }}>
            + Add group
          </Text>
        </Pressable>
      </ScrollView>
      </AnimatedTabContent>

      <Modal visible={modal !== null} transparent animationType="fade" onRequestClose={closeModal}>
        <Pressable style={styles.backdrop} onPress={closeModal}>
          <Pressable
            style={[styles.sheet, { backgroundColor: tokens.modalBg, borderColor: tokens.borderStrong }]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.sheetTitle, { color: tokens.text, fontFamily: fontFamily.displaySemiBold }]}>
              {modal?.kind === 'addCategory' && 'Add category'}
              {modal?.kind === 'renameCategory' && 'Rename category'}
              {modal?.kind === 'addGroup' && 'Add group'}
              {modal?.kind === 'renameGroup' && 'Rename group'}
            </Text>
            <TextInput
              style={[styles.input, { backgroundColor: tokens.inputBg, borderColor: tokens.borderStrong, color: tokens.text }]}
              value={nameInput}
              onChangeText={setNameInput}
              placeholder="Name"
              placeholderTextColor={tokens.text3}
              autoFocus
            />
            {modal?.kind === 'addCategory' && (
              <View style={styles.chipRow}>
                <Pressable
                  onPress={() => setGroupInput('')}
                  style={[
                    styles.chip,
                    { backgroundColor: groupInput === '' ? tokens.chipActiveBg : tokens.inputBg, borderColor: tokens.border },
                  ]}
                >
                  <Text style={{ color: tokens.text, fontSize: 12 }}>Other</Text>
                </Pressable>
                {groups.map((g) => (
                  <Pressable
                    key={g}
                    onPress={() => setGroupInput(g)}
                    style={[
                      styles.chip,
                      { backgroundColor: groupInput === g ? tokens.chipActiveBg : tokens.inputBg, borderColor: tokens.border },
                    ]}
                  >
                    <Text style={{ color: tokens.text, fontSize: 12 }}>{g}</Text>
                  </Pressable>
                ))}
              </View>
            )}
            {modalError !== '' && (
              <Text style={{ color: tokens.coral, fontSize: 12, marginTop: 8 }}>{modalError}</Text>
            )}
            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={closeModal}>
                <Text style={{ color: tokens.text2, fontFamily: fontFamily.bodyMedium }}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.confirmBtn,
                  { backgroundColor: modalSuccess ? tokens.mint : tokens.gold, opacity: submitting || !nameInput.trim() ? 0.5 : 1 },
                ]}
                onPress={submitModal}
                disabled={submitting || !nameInput.trim() || modalSuccess}
              >
                {modalSuccess ? (
                  <CheckIcon color={tokens.onAccent} />
                ) : (
                  <Text style={{ color: tokens.onAccent, fontFamily: fontFamily.bodyBold }}>
                    {submitting ? 'Saving…' : 'Save'}
                  </Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: 18, paddingBottom: 14, borderBottomWidth: 1 },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerAction: { fontSize: 30 },
  title: { fontSize: 20 },
  addCategoryBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100 },
  scrollContent: { padding: 16, paddingBottom: 110, gap: 14 },
  card: { padding: 16, borderRadius: 20, borderWidth: 1 },
  groupHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  groupHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  groupName: { fontSize: 14, flexShrink: 1 },
  groupHeaderActions: { flexDirection: 'row', gap: 14 },
  catRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, paddingVertical: 10, marginTop: 4 },
  catName: { fontSize: 13, flex: 1, flexShrink: 1, marginRight: 8 },
  catActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dragHandle: { paddingLeft: 2 },
  addGroupBtn: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 16, paddingVertical: 14, alignItems: 'center' },
  addToGroupBtn: { alignItems: 'center', paddingVertical: 10, marginTop: 4 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, padding: 18, paddingBottom: 32 },
  sheetTitle: { fontSize: 16, marginBottom: 12 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 100, borderWidth: 1 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 16 },
  cancelBtn: { paddingHorizontal: 8, justifyContent: 'center' },
  confirmBtn: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12 },
})
