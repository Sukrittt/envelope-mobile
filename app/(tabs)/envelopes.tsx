import { useMemo, useState } from 'react'
import { View, Text, ScrollView, Pressable, Modal, TextInput, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useTheme } from '@/src/theme/ThemeProvider'
import { fontFamily } from '@/src/theme/fonts'
import {
  useCategories,
  useAddCategory,
  useUpdateCategory,
  useDeleteCategory,
  useReorderCategory,
} from '@/src/hooks/useCategories'
import { useGroups, useAddGroup, useUpdateGroup, useDeleteGroup } from '@/src/hooks/useGroups'
import { groupEmoji, splitEmoji } from '@/src/lib/emoji'
import type { CategoryRow } from '@/src/types'

const OTHER_LABEL = 'Other'

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
  const reorderCategory = useReorderCategory()
  const addGroup = useAddGroup()
  const updateGroup = useUpdateGroup()
  const deleteGroup = useDeleteGroup()

  const [modal, setModal] = useState<ModalState | null>(null)
  const [nameInput, setNameInput] = useState('')
  const [groupInput, setGroupInput] = useState('')
  const [modalError, setModalError] = useState('')

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

  function openAddCategory() {
    setNameInput('')
    setGroupInput('')
    setModalError('')
    setModal({ kind: 'addCategory' })
  }
  function openRenameCategory(name: string) {
    setNameInput(name)
    setModalError('')
    setModal({ kind: 'renameCategory', name })
  }
  function openAddGroup() {
    setNameInput('')
    setModalError('')
    setModal({ kind: 'addGroup' })
  }
  function openRenameGroup(name: string) {
    setNameInput(name)
    setModalError('')
    setModal({ kind: 'renameGroup', name })
  }
  function closeModal() {
    setModal(null)
    setModalError('')
  }

  const submitting =
    addCategory.isPending || updateCategory.isPending || addGroup.isPending || updateGroup.isPending

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
      closeModal()
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
      { text: 'Remove', style: 'destructive', onPress: () => deleteCategory.mutate(name) },
    ])
  }

  function confirmDeleteGroup(name: string) {
    Alert.alert('Delete group', `Delete "${name}"? Its categories move to Other.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteGroup.mutate(name) },
    ])
  }

  const isLoading = categoriesQ.isLoading || groupsQ.isLoading
  const hasError = categoriesQ.error || groupsQ.error

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: tokens.bg }]}>
        <ActivityIndicator color={tokens.gold} />
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
            <Pressable onPress={() => router.back()} hitSlop={12}>
              <Text style={[styles.headerAction, { color: tokens.text2, fontFamily: fontFamily.bodySemiBold }]}>
                ‹ Back
              </Text>
            </Pressable>
            <Text style={[styles.title, { color: tokens.text, fontFamily: fontFamily.displaySemiBold }]}>
              Envelopes
            </Text>
          </View>
          <Pressable
            onPress={openAddCategory}
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

      <ScrollView contentContainerStyle={styles.scrollContent}>
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
                  <Pressable onPress={() => confirmDeleteGroup(name)} hitSlop={8}>
                    <Text style={{ fontSize: 14 }}>🗑️</Text>
                  </Pressable>
                </View>
              )}
            </View>

            {items.length === 0 && (
              <Text style={{ color: tokens.text3, fontSize: 12, marginTop: 6, fontFamily: fontFamily.bodyMedium }}>
                No categories yet.
              </Text>
            )}

            {items.map((cat, i) => (
              <View key={cat.name} style={[styles.catRow, { borderTopColor: tokens.border }]}>
                <Text
                  style={[styles.catName, { color: tokens.text, fontFamily: fontFamily.bodyMedium }]}
                  numberOfLines={1}
                >
                  {cat.name}
                </Text>
                <View style={styles.catActions}>
                  <Pressable
                    disabled={i === 0}
                    onPress={() => reorderCategory.mutate({ name: cat.name, direction: 'up' })}
                    style={{ opacity: i === 0 ? 0.3 : 1 }}
                    hitSlop={6}
                  >
                    <Text style={{ color: tokens.text2, fontSize: 13 }}>▲</Text>
                  </Pressable>
                  <Pressable
                    disabled={i === items.length - 1}
                    onPress={() => reorderCategory.mutate({ name: cat.name, direction: 'down' })}
                    style={{ opacity: i === items.length - 1 ? 0.3 : 1 }}
                    hitSlop={6}
                  >
                    <Text style={{ color: tokens.text2, fontSize: 13 }}>▼</Text>
                  </Pressable>
                  <Pressable onPress={() => openRenameCategory(cat.name)} hitSlop={6}>
                    <Text style={{ fontSize: 13 }}>✏️</Text>
                  </Pressable>
                  <Pressable onPress={() => confirmDeleteCategory(cat.name)} hitSlop={6}>
                    <Text style={{ fontSize: 13 }}>🗑️</Text>
                  </Pressable>
                </View>
              </View>
            ))}
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
                style={[styles.confirmBtn, { backgroundColor: tokens.gold, opacity: submitting || !nameInput.trim() ? 0.5 : 1 }]}
                onPress={submitModal}
                disabled={submitting || !nameInput.trim()}
              >
                <Text style={{ color: tokens.onAccent, fontFamily: fontFamily.bodyBold }}>
                  {submitting ? 'Saving…' : 'Save'}
                </Text>
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
  headerAction: { fontSize: 14 },
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
  addGroupBtn: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 16, paddingVertical: 14, alignItems: 'center' },
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
