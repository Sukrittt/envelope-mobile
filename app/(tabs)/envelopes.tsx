import { useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, ScrollView, Pressable, TextInput, RefreshControl, StyleSheet, Animated, PanResponder } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ChevronRight, MoreVertical, Plus, ArrowUp, ArrowDown, Equal } from 'lucide-react-native'
import Reanimated, { FadeIn, FadeOut, useAnimatedStyle, withSpring, LinearTransition } from 'react-native-reanimated'
import { AnimatedTabContent } from '@/src/components/nav/AnimatedTabContent'
import { Screen, useNavPadding } from '@/src/components/ui/Screen'
import { Chip } from '@/src/components/ui/Chip'
import { IconButton } from '@/src/components/ui/Button'
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
import { useGroups, useAddGroup, useUpdateGroup, useDeleteGroup, useMoveGroup } from '@/src/hooks/useGroups'
import { groupEmoji, categoryEmoji, splitEmoji } from '@/src/lib/emoji'
import { LoadingCaption } from '@/src/components/shared/LoadingCaption'
import { CheckIcon } from '@/src/components/shared/CheckIcon'
import { BottomSheet } from '@/src/components/shared/Modal'
import { Icon } from '@/src/components/shared/Icon'
import { useRefresh } from '@/src/hooks/useRefresh'
import { DEFAULT_ALERT_PCTS, ALERT_PRESET_PCTS, MAX_ALERT_PCTS } from '@/src/lib/alerts'
import type { CategoryRow } from '@/src/types'
import { EMPTY } from '@/src/lib/constants'

function sortedPcts(pcts: number[]): number[] {
  return [...pcts].sort((a, b) => a - b)
}

function pctArraysEqual(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i])
}

const OTHER_LABEL = 'Other'
const ARCHIVED_GROUP = 'Archived'
const ROW_HEIGHT = 45
const SPRING = { damping: 64, stiffness: 600 }

function GroupChevron({ collapsed, color }: { collapsed: boolean; color: string }) {
  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: withSpring(collapsed ? '0deg' : '90deg', SPRING) }],
  }))
  return (
    <Reanimated.View style={style}>
      <Icon icon={ChevronRight} size={14} color={color} strokeWidth={2.5} />
    </Reanimated.View>
  )
}

const BODY_TRANSITION = LinearTransition.springify().damping(SPRING.damping).stiffness(SPRING.stiffness)

function GroupBody({ collapsed, style, children }: { collapsed: boolean; style: object; children: React.ReactNode }) {
  if (collapsed) return null
  return (
    <Reanimated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(120)} style={style}>
      {children}
    </Reanimated.View>
  )
}

function DraggableCategoryList({
  items,
  group,
  tokens,
  reordering,
  onReorder,
  onMenu,
}: {
  items: CategoryRow[]
  group: string
  tokens: ThemeTokens
  reordering: boolean
  onReorder: (name: string, toIndex: number) => void
  onMenu: (name: string) => void
}) {
  // react-query's cache notifications land on a setTimeout(0), a tick after React's own
  // state updates commit — clearing drag state on drop would flash the old order for a
  // frame before the query catches up. Keep a local order, synced from items, and reorder
  // it synchronously on drop so both updates land in the same render.
  const [order, setOrder] = useState(() => items.map((c) => c.name))
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- see comment above: local order must be able to lead the items prop
    setOrder(items.map((c) => c.name))
  }, [items])
  const byName = useMemo(() => new Map(items.map((c) => [c.name, c])), [items])

  const rowHeight = useRef(ROW_HEIGHT)
  const dragY = useRef(new Animated.Value(0)).current
  const [drag, setDrag] = useState<{ name: string; start: number; target: number } | null>(null)
  // safe: ref kept fresh for the responders' stable closures, not render output
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
            <Pressable
              style={styles.catRowMain}
              disabled={reordering}
              onPress={() => onMenu(cat.name)}
            >
              <View style={[styles.catIconChip, { backgroundColor: tokens.inputBg }]}>
                <Text style={{ fontSize: 12 }}>{categoryEmoji(cat.name, group)}</Text>
              </View>
              <Text
                style={[styles.catName, { color: tokens.text, fontFamily: fontFamily.bodyBold }]}
                numberOfLines={1}
              >
                {splitEmoji(cat.name).text}
              </Text>
              <View style={styles.catActions}>
                <View {...responder.panHandlers} hitSlop={8} style={styles.dragHandle}>
                  <Icon icon={Equal} size={14} color={tokens.text3} />
                </View>
              </View>
            </Pressable>
          </Animated.View>
        )
      })}
    </>
  )
}

type SheetState =
  | { kind: 'addCategory' }
  | { kind: 'renameCategory'; name: string }
  | { kind: 'addGroup' }
  | { kind: 'renameGroup'; name: string }

export default function EnvelopesScreen() {
  const { tokens } = useTheme()
  const { refreshing, onRefresh } = useRefresh()
  const insets = useSafeAreaInsets()
  const navPadding = useNavPadding()

  const categoriesQ = useCategories()
  const groupsQ = useGroups()
  const addCategory = useAddCategory()
  const updateCategory = useUpdateCategory()
  const deleteCategory = useDeleteCategory()
  const moveCategory = useMoveCategory()
  const addGroup = useAddGroup()
  const updateGroup = useUpdateGroup()
  const deleteGroup = useDeleteGroup()
  const moveGroup = useMoveGroup()

  const [reordering, setReordering] = useState(false)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

  const [sheet, setSheet] = useState<SheetState | null>(null)
  const [menuTarget, setMenuTarget] = useState<{ kind: 'category' | 'group'; name: string } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ kind: 'category' | 'group'; name: string } | null>(null)
  const [draftName, setDraftName] = useState('')
  const [draftGroup, setDraftGroup] = useState('')
  const [draftAlertPcts, setDraftAlertPcts] = useState<number[]>(DEFAULT_ALERT_PCTS)
  const [customAlertInput, setCustomAlertInput] = useState('')
  const [sheetError, setSheetError] = useState('')
  const [sheetSuccess, setSheetSuccess] = useState(false)

  const [deletingGroup, setDeletingGroup] = useState(false)

  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(toastTimer.current), [])

  function showToast(msg: string) {
    clearTimeout(toastTimer.current)
    setToastMsg(msg)
    toastTimer.current = setTimeout(() => setToastMsg(null), 1700)
  }

  const categories = categoriesQ.data ?? EMPTY
  const groups = groupsQ.data ?? EMPTY

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

  const allGroupKeys = groupedCategories.map((g) => g.name || OTHER_LABEL)
  const allGroupsCollapsed = allGroupKeys.length > 0 && allGroupKeys.every((k) => collapsedGroups.has(k))

  function toggleGroup(key: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }
  function toggleCollapseAll() {
    setCollapsedGroups(allGroupsCollapsed ? new Set() : new Set(allGroupKeys))
  }

  function openAddCategory(group = '') {
    setDraftName('')
    setDraftGroup(group)
    setDraftAlertPcts(DEFAULT_ALERT_PCTS)
    setCustomAlertInput('')
    setSheetError('')
    setSheet({ kind: 'addCategory' })
  }
  function openRenameCategory(name: string) {
    const cat = categories.find((c) => c.name === name)
    setDraftName(name)
    setDraftGroup(cat?.group ?? '')
    setDraftAlertPcts(cat?.alertPcts ? sortedPcts(cat.alertPcts) : DEFAULT_ALERT_PCTS)
    setCustomAlertInput('')
    setSheetError('')
    setSheet({ kind: 'renameCategory', name })
  }
  function togglePresetPct(pct: number) {
    setDraftAlertPcts((prev) => {
      if (prev.includes(pct)) return prev.filter((p) => p !== pct)
      if (prev.length >= MAX_ALERT_PCTS) return prev
      return sortedPcts([...prev, pct])
    })
  }
  function addCustomAlertPct() {
    const n = Math.round(Number(customAlertInput))
    if (!customAlertInput.trim() || Number.isNaN(n) || n < 0 || n > 100) return
    setCustomAlertInput('')
    setDraftAlertPcts((prev) => {
      if (prev.includes(n) || prev.length >= MAX_ALERT_PCTS) return prev
      return sortedPcts([...prev, n])
    })
  }
  function openAddGroup() {
    setDraftName('')
    setSheetError('')
    setSheet({ kind: 'addGroup' })
  }
  function openRenameGroup(name: string) {
    setDraftName(name)
    setSheetError('')
    setSheet({ kind: 'renameGroup', name })
  }
  function closeSheet() {
    setSheet(null)
    setSheetError('')
    setSheetSuccess(false)
  }

  // Let the inline checkmark finish drawing before closing the sheet.
  useEffect(() => {
    if (!sheetSuccess) return
    const timer = setTimeout(closeSheet, 1100)
    return () => clearTimeout(timer)
  }, [sheetSuccess])

  const submitting =
    addCategory.isPending || updateCategory.isPending || addGroup.isPending || updateGroup.isPending

  async function submitSheet() {
    if (!sheet) return
    const composed = draftName.trim()
    if (!composed) return
    try {
      if (sheet.kind === 'addCategory') {
        await addCategory.mutateAsync({ name: composed, group: draftGroup })
      } else if (sheet.kind === 'renameCategory') {
        const current = categories.find((c) => c.name === sheet.name)
        const currentGroup = current?.group ?? ''
        const currentAlertPcts = current?.alertPcts ? sortedPcts(current.alertPcts) : DEFAULT_ALERT_PCTS
        const sortedDraft = sortedPcts(draftAlertPcts)
        const updates: { newName?: string; group?: string; alertPcts?: number[] | null } = {}
        if (composed !== sheet.name) updates.newName = composed
        if (draftGroup !== currentGroup) updates.group = draftGroup
        if (!pctArraysEqual(sortedDraft, currentAlertPcts)) {
          updates.alertPcts = pctArraysEqual(sortedDraft, DEFAULT_ALERT_PCTS) ? null : sortedDraft
        }
        if (Object.keys(updates).length > 0) {
          await updateCategory.mutateAsync({ name: sheet.name, updates })
        }
      } else if (sheet.kind === 'addGroup') {
        await addGroup.mutateAsync(composed)
      } else {
        if (composed !== sheet.name) {
          await updateGroup.mutateAsync({ name: sheet.name, newName: composed })
        }
      }
      setSheetSuccess(true)
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      setSheetError(
        msg.includes('already exists') ? 'That name is already taken. Try a different name.' : 'Something went wrong. Try again.',
      )
    }
  }

  function runDeleteCategory(name: string) {
    deleteCategory.mutate(name, { onSuccess: () => showToast(`${splitEmoji(name).text} removed`) })
  }
  // Deleting a group must not delete the categories inside it — move them into
  // an "Archived" group first (creating it if needed) so they stay findable.
  async function runDeleteGroup(name: string) {
    setDeletingGroup(true)
    try {
      const orphaned = categories.filter((c) => (c.group || '') === name)
      if (orphaned.length > 0) {
        if (!groups.includes(ARCHIVED_GROUP)) await addGroup.mutateAsync(ARCHIVED_GROUP)
        await Promise.all(
          orphaned.map((c) => updateCategory.mutateAsync({ name: c.name, updates: { group: ARCHIVED_GROUP } })),
        )
      }
      await deleteGroup.mutateAsync(name)
    } finally {
      setDeletingGroup(false)
      setDeleteTarget(null)
    }
  }
  function requestDelete(kind: 'category' | 'group', name: string) {
    if (kind === 'group' && name === ARCHIVED_GROUP) return
    setMenuTarget(null)
    setDeleteTarget({ kind, name })
  }
  function openCategoryMenu(name: string) {
    setMenuTarget({ kind: 'category', name })
  }
  function openGroupMenu(name: string) {
    setMenuTarget({ kind: 'group', name })
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
          Couldn&apos;t load your categories. Check your connection and reopen the app.
        </Text>
      </View>
    )
  }

  const isCatSheet = sheet?.kind === 'addCategory' || sheet?.kind === 'renameCategory'
  const isRenameSheet = sheet?.kind === 'renameCategory' || sheet?.kind === 'renameGroup'
  const previewIcon = isCatSheet ? categoryEmoji(draftName, draftGroup) : groupEmoji(draftName)
  const draftHasEmoji = splitEmoji(draftName).icon !== ''
  const sheetTitle =
    sheet?.kind === 'addCategory'
      ? 'Add category'
      : sheet?.kind === 'renameCategory'
        ? 'Edit category'
        : sheet?.kind === 'addGroup'
          ? 'Add group'
          : 'Rename group'
  const sheetHint = isCatSheet
    ? 'Categories live inside a group. Pick where this one belongs.'
    : 'Groups gather related categories: Food, Home, Transport.'
  const draftValid = draftName.trim().length > 0
  const saveLabel = submitting ? 'Saving…' : isCatSheet ? (isRenameSheet ? 'Save' : 'Add category') : isRenameSheet ? 'Save' : 'Create group'

  return (
    <AnimatedTabContent>
      <Screen
        title="Envelopes"
        actions={<IconButton icon={Plus} accessibilityLabel="New group" onPress={openAddGroup} />}
        scroll={false}
      >
        <View style={styles.metaRow}>
          <Text style={{ color: tokens.text3, fontSize: 11, fontFamily: fontFamily.bodyMedium }}>
            {groups.length} group{groups.length === 1 ? '' : 's'} · {categories.length} categor
            {categories.length === 1 ? 'y' : 'ies'}
          </Text>
          <View style={styles.metaActions}>
            <Chip
              label={allGroupsCollapsed ? 'Expand all' : 'Collapse all'}
              onPress={toggleCollapseAll}
            />
            <Chip
              label={reordering ? 'Done' : 'Reorder'}
              selected={reordering}
              onPress={() => setReordering((r) => !r)}
            />
          </View>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: navPadding }]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              enabled={!reordering}
              tintColor={tokens.accent}
              colors={[tokens.accent]}
            />
          }
        >
          {groupedCategories.map(({ name, items }) => {
            const key = name || OTHER_LABEL
            const collapsed = collapsedGroups.has(key)
            const idx = groups.indexOf(name)
            return (
              <Reanimated.View
                key={key}
                layout={BODY_TRANSITION}
                style={[styles.card, { backgroundColor: tokens.card, borderColor: tokens.border }]}
              >
                <Pressable
                  style={styles.groupHeader}
                  disabled={reordering}
                  onPress={() => toggleGroup(key)}
                >
                  <Pressable onPress={() => toggleGroup(key)} hitSlop={8} style={styles.chevronBtn}>
                    <GroupChevron collapsed={collapsed} color={tokens.text3} />
                  </Pressable>
                  <View style={[styles.avatarChip, { backgroundColor: tokens.accentSoft }]}>
                    <Text style={{ fontSize: 16 }}>{name ? groupEmoji(name) : '📁'}</Text>
                  </View>
                  <View style={styles.groupHeaderLeft}>
                    <Text
                      style={[styles.groupName, { color: tokens.text, fontFamily: fontFamily.bodyExtraBold }]}
                      numberOfLines={1}
                    >
                      {name ? splitEmoji(name).text : OTHER_LABEL}
                    </Text>
                    <Text style={{ color: tokens.text3, fontSize: 10, marginTop: 2, fontFamily: fontFamily.bodyMedium }}>
                      {items.length === 0 ? 'empty' : `${items.length} categor${items.length === 1 ? 'y' : 'ies'}`}
                    </Text>
                  </View>
                  {name !== '' &&
                    (reordering ? (
                      <View style={styles.arrowCol}>
                        <Pressable
                          disabled={idx <= 0}
                          onPress={() => moveGroup.mutate({ name, toIndex: idx - 1 })}
                          style={[styles.arrowBtn, { borderColor: tokens.border, opacity: idx <= 0 ? 0.4 : 1 }]}
                        >
                          <Icon icon={ArrowUp} size={12} color={tokens.text} strokeWidth={2.5} />
                        </Pressable>
                        <Pressable
                          disabled={idx >= groups.length - 1}
                          onPress={() => moveGroup.mutate({ name, toIndex: idx + 1 })}
                          style={[
                            styles.arrowBtn,
                            { borderColor: tokens.border, opacity: idx >= groups.length - 1 ? 0.4 : 1 },
                          ]}
                        >
                          <Icon icon={ArrowDown} size={12} color={tokens.text} strokeWidth={2.5} />
                        </Pressable>
                      </View>
                    ) : (
                      <Pressable onPress={() => openGroupMenu(name)} hitSlop={8}>
                        <Icon icon={MoreVertical} size={17} color={tokens.text3} />
                      </Pressable>
                    ))}
                  <View style={styles.dragHandle}>
                    <Icon icon={Equal} size={15} color={tokens.text3} />
                  </View>
                </Pressable>

                <GroupBody collapsed={collapsed} style={styles.groupBody}>
                  <DraggableCategoryList
                    items={items}
                    group={name}
                    tokens={tokens}
                    reordering={reordering}
                    onReorder={(catName, toIndex) => moveCategory.mutate({ name: catName, toIndex })}
                    onMenu={openCategoryMenu}
                  />

                  {items.length === 0 ? (
                    <Pressable
                      onPress={() => openAddCategory(name)}
                      style={[styles.addFirstCatBtn, { borderColor: tokens.borderStrong }]}
                    >
                      <Icon icon={Plus} size={14} color={tokens.accentInk} strokeWidth={2.5} />
                      <Text style={{ color: tokens.accentInk, fontSize: 13, fontFamily: fontFamily.bodyBold }}>
                        Add first category
                      </Text>
                    </Pressable>
                  ) : (
                    <Pressable
                      onPress={() => openAddCategory(name)}
                      style={[styles.addCatRow, { borderTopColor: tokens.border }]}
                    >
                      <View style={[styles.dashedIconChip, { borderColor: tokens.accent }]}>
                        <Icon icon={Plus} size={12} color={tokens.accentInk} strokeWidth={3} />
                      </View>
                      <Text style={{ color: tokens.accentInk, fontSize: 13, fontFamily: fontFamily.bodyBold }}>
                        Add category
                      </Text>
                    </Pressable>
                  )}
                </GroupBody>
              </Reanimated.View>
            )
          })}

          <Reanimated.View layout={LinearTransition.springify().damping(SPRING.damping).stiffness(SPRING.stiffness)}>
            <Pressable
              onPress={openAddGroup}
              style={[styles.addGroupBtn, { borderColor: tokens.borderStrong }]}
            >
              <Icon icon={Plus} size={14} color={tokens.text2} strokeWidth={2.5} />
              <Text style={{ color: tokens.text2, fontSize: 13, fontFamily: fontFamily.bodyBold }}>New group</Text>
            </Pressable>
            <Text style={{ color: tokens.text3, fontSize: 10, textAlign: 'center', marginTop: 2, fontFamily: fontFamily.bodyMedium }}>
              {reordering
                ? 'Use the arrows to reorder groups · drag a category to reorder'
                : 'Tap a group to collapse · tap a category to rename or delete'}
            </Text>
          </Reanimated.View>
        </ScrollView>

      <BottomSheet visible={sheet !== null} onClose={closeSheet}>
        <View style={[styles.sheetHandle, { backgroundColor: tokens.borderStrong }]} />
        <Text style={[styles.sheetTitle, { color: tokens.text, fontFamily: fontFamily.displaySemiBold }]}>
          {sheetTitle}
        </Text>
        <Text style={{ color: tokens.text2, fontSize: 12, marginTop: 4, lineHeight: 17 }}>{sheetHint}</Text>

        <Text style={[styles.sectionLabel, { color: tokens.text3 }]}>NAME</Text>
        <View style={styles.nameRow}>
          <View style={[styles.iconSwatch, { backgroundColor: tokens.inputBg, borderColor: tokens.borderStrong }]}>
            <Text style={{ fontSize: 22 }}>{previewIcon}</Text>
          </View>
          <TextInput
            style={[styles.input, { backgroundColor: tokens.inputBg, borderColor: tokens.borderStrong, color: tokens.text }]}
            value={draftName}
            onChangeText={setDraftName}
            placeholder={isCatSheet ? 'Groceries, fuel, gym…' : 'Transport, Health…'}
            placeholderTextColor={tokens.text3}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={submitSheet}
          />
        </View>
        {draftName.trim() !== '' && !draftHasEmoji && (
          <Text style={{ color: tokens.text3, fontSize: 11, marginTop: 6, lineHeight: 15 }}>
            💡 Tip: start the name with an emoji, like {isCatSheet ? '🛒 Groceries' : '🚗 Transport'}, to give it its own icon.
          </Text>
        )}

        {isCatSheet && (
          <>
            <Text style={[styles.sectionLabel, { color: tokens.text3 }]}>GROUP</Text>
            <View style={styles.chipRow}>
              <Pressable
                onPress={() => setDraftGroup('')}
                style={[
                  styles.chip,
                  {
                    backgroundColor: draftGroup === '' ? tokens.accent : tokens.inputBg,
                    borderColor: draftGroup === '' ? tokens.accent : tokens.border,
                  },
                ]}
              >
                <Text
                  style={{
                    color: draftGroup === '' ? tokens.onAccent : tokens.text2,
                    fontSize: 12,
                    fontFamily: fontFamily.bodyBold,
                  }}
                >
                  Other
                </Text>
              </Pressable>
              {groups.map((g) => (
                <Pressable
                  key={g}
                  onPress={() => setDraftGroup(g)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: draftGroup === g ? tokens.accent : tokens.inputBg,
                      borderColor: draftGroup === g ? tokens.accent : tokens.border,
                    },
                  ]}
                >
                  <Text style={{ fontSize: 13 }}>{groupEmoji(g)}</Text>
                  <Text
                    style={{
                      color: draftGroup === g ? tokens.onAccent : tokens.text2,
                      fontSize: 12,
                      fontFamily: fontFamily.bodyBold,
                    }}
                  >
                    {splitEmoji(g).text}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        )}

        {sheet?.kind === 'renameCategory' && (
          <>
            <Text style={[styles.sectionLabel, { color: tokens.text3 }]}>ALERT AT</Text>
            <View style={styles.chipRow}>
              {ALERT_PRESET_PCTS.map((pct) => {
                const selected = draftAlertPcts.includes(pct)
                const disabled = !selected && draftAlertPcts.length >= MAX_ALERT_PCTS
                return (
                  <Pressable
                    key={pct}
                    disabled={disabled}
                    onPress={() => togglePresetPct(pct)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: selected ? tokens.accent : tokens.inputBg,
                        borderColor: selected ? tokens.accent : tokens.border,
                        opacity: disabled ? 0.4 : 1,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: selected ? tokens.onAccent : tokens.text2,
                        fontSize: 12,
                        fontFamily: fontFamily.bodyBold,
                      }}
                    >
                      {pct}%
                    </Text>
                  </Pressable>
                )
              })}
              {draftAlertPcts
                .filter((pct) => !ALERT_PRESET_PCTS.includes(pct))
                .map((pct) => (
                  <Pressable
                    key={pct}
                    onPress={() => togglePresetPct(pct)}
                    style={[styles.chip, { backgroundColor: tokens.accent, borderColor: tokens.accent }]}
                  >
                    <Text style={{ color: tokens.onAccent, fontSize: 12, fontFamily: fontFamily.bodyBold }}>{pct}%</Text>
                  </Pressable>
                ))}
            </View>
            <View style={styles.customAlertRow}>
              <TextInput
                style={[
                  styles.customAlertInput,
                  { backgroundColor: tokens.inputBg, borderColor: tokens.borderStrong, color: tokens.text },
                ]}
                value={customAlertInput}
                onChangeText={setCustomAlertInput}
                placeholder="Custom"
                placeholderTextColor={tokens.text3}
                keyboardType="number-pad"
                maxLength={3}
                editable={draftAlertPcts.length < MAX_ALERT_PCTS}
                returnKeyType="done"
                onSubmitEditing={addCustomAlertPct}
              />
              <Pressable
                onPress={addCustomAlertPct}
                disabled={draftAlertPcts.length >= MAX_ALERT_PCTS || !customAlertInput.trim()}
                style={[
                  styles.customAlertAddBtn,
                  {
                    backgroundColor: tokens.inputBg,
                    borderColor: tokens.borderStrong,
                    opacity: draftAlertPcts.length >= MAX_ALERT_PCTS || !customAlertInput.trim() ? 0.4 : 1,
                  },
                ]}
              >
                <Text style={{ color: tokens.text2, fontSize: 12, fontFamily: fontFamily.bodyBold }}>Add</Text>
              </Pressable>
            </View>
            <Text style={{ color: tokens.text3, fontSize: 11, marginTop: 6 }}>
              {draftAlertPcts.length}/{MAX_ALERT_PCTS} selected
              {draftAlertPcts.length >= MAX_ALERT_PCTS ? ` · You can only select up to ${MAX_ALERT_PCTS} options.` : ''}
            </Text>
          </>
        )}

        {sheetError !== '' && (
          <Text style={{ color: tokens.coral, fontSize: 12, marginTop: 8 }}>{sheetError}</Text>
        )}

        <View style={styles.sheetActions}>
          <Pressable
            style={[
              styles.saveBtn,
              {
                backgroundColor: sheetSuccess ? tokens.mint : draftValid ? tokens.accent : tokens.inputBg,
                opacity: submitting ? 0.6 : 1,
              },
            ]}
            onPress={submitSheet}
            disabled={submitting || !draftValid || sheetSuccess}
          >
            {sheetSuccess ? (
              <CheckIcon color={tokens.onAccent} />
            ) : (
              <Text style={{ color: draftValid ? tokens.onAccent : tokens.text3, fontFamily: fontFamily.bodyBold }}>
                {saveLabel}
              </Text>
            )}
          </Pressable>
        </View>
      </BottomSheet>

      <BottomSheet visible={menuTarget !== null} onClose={() => setMenuTarget(null)}>
        <Text style={[styles.menuTitle, { color: tokens.text2 }]} numberOfLines={1}>
          {menuTarget ? splitEmoji(menuTarget.name).text : ''}
        </Text>
        <SheetOption
          label={menuTarget?.kind === 'category' ? 'Edit' : 'Rename'}
          color={tokens.text}
          onPress={() => {
            if (!menuTarget) return
            const { kind, name } = menuTarget
            setMenuTarget(null)
            if (kind === 'category') openRenameCategory(name)
            else openRenameGroup(name)
          }}
        />
        {!(menuTarget?.kind === 'group' && menuTarget.name === ARCHIVED_GROUP) && (
          <SheetOption
            label="Delete"
            color={tokens.coral}
            onPress={() => menuTarget && requestDelete(menuTarget.kind, menuTarget.name)}
          />
        )}
        <SheetOption label="Cancel" color={tokens.text2} onPress={() => setMenuTarget(null)} />
      </BottomSheet>

      <BottomSheet visible={deleteTarget !== null} onClose={() => !deletingGroup && setDeleteTarget(null)}>
        <Text style={[styles.confirmTitle, { color: tokens.text, fontFamily: fontFamily.displaySemiBold }]}>
          {deleteTarget?.kind === 'group' ? 'Delete group' : 'Remove category'}
        </Text>
        <Text style={[styles.confirmBody, { color: tokens.text2, fontFamily: fontFamily.bodyMedium }]} numberOfLines={2}>
          {deleteTarget?.kind === 'group'
            ? `Delete "${deleteTarget ? splitEmoji(deleteTarget.name).text : ''}"? Its categories move to Archived.`
            : `Remove "${deleteTarget ? splitEmoji(deleteTarget.name).text : ''}"? Past transactions are kept.`}
        </Text>
        <SheetOption
          label={deleteTarget?.kind === 'group' ? (deletingGroup ? 'Deleting…' : 'Delete') : 'Remove'}
          color={tokens.coral}
          disabled={deletingGroup}
          onPress={() => {
            if (!deleteTarget) return
            if (deleteTarget.kind === 'group') {
              runDeleteGroup(deleteTarget.name)
              return
            }
            runDeleteCategory(deleteTarget.name)
            setDeleteTarget(null)
          }}
        />
        <SheetOption label="Cancel" color={tokens.text2} disabled={deletingGroup} onPress={() => setDeleteTarget(null)} />
      </BottomSheet>

      {toastMsg && (
        <View
          pointerEvents="none"
          style={[
            styles.toast,
            { bottom: insets.bottom + 76, backgroundColor: tokens.pillBg, borderColor: tokens.borderStrong },
          ]}
        >
          <Text style={{ color: tokens.text, fontFamily: fontFamily.bodyBold, fontSize: 13 }}>{toastMsg}</Text>
        </View>
      )}
      </Screen>
    </AnimatedTabContent>
  )
}

function SheetOption({
  label,
  color,
  onPress,
  disabled,
}: {
  label: string
  color: string
  onPress: () => void
  disabled?: boolean
}) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.sheetOption, disabled && { opacity: 0.5 }]}>
      <Text style={[styles.sheetOptionText, { color, fontFamily: fontFamily.bodySemiBold }]}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, paddingBottom: 12 },
  metaActions: { flexDirection: 'row', gap: 8 },
  scrollContent: { paddingVertical: 4, gap: 10 },
  card: { borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13 },
  chevronBtn: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  avatarChip: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  groupHeaderLeft: { flex: 1, minWidth: 0 },
  groupName: { fontSize: 15 },
  arrowCol: { flexDirection: 'column', gap: 2 },
  arrowBtn: { width: 26, height: 20, borderRadius: 7, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  dragHandle: { paddingLeft: 2 },
  groupBody: { paddingHorizontal: 13, paddingLeft: 46 },
  catRow: { borderTopWidth: 1 },
  catRowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 11 },
  catIconChip: { width: 24, height: 24, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  catName: { fontSize: 14, flex: 1, flexShrink: 1 },
  catActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  addFirstCatBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, margin: 2, marginBottom: 13, padding: 14, borderRadius: 15, borderWidth: 1, borderStyle: 'dashed' },
  addCatRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 11, paddingBottom: 13, borderTopWidth: 1 },
  dashedIconChip: { width: 24, height: 24, borderRadius: 8, borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  addGroupBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderStyle: 'dashed', borderRadius: 22, paddingVertical: 16 },
  sheetHandle: { width: 38, height: 4, borderRadius: 100, alignSelf: 'center', marginBottom: 14 },
  sheetTitle: { fontSize: 18 },
  sectionLabel: { fontSize: 11, letterSpacing: 0.8, marginTop: 18, marginBottom: 8 },
  nameRow: { flexDirection: 'row', gap: 10, alignItems: 'stretch' },
  iconSwatch: { width: 52, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  input: { flex: 1, minWidth: 0, borderWidth: 1, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, fontWeight: '700' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 100, borderWidth: 1 },
  customAlertRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  customAlertInput: { flex: 1, borderWidth: 1, borderRadius: 100, paddingHorizontal: 14, paddingVertical: 8, fontSize: 12 },
  customAlertAddBtn: { paddingHorizontal: 16, borderRadius: 100, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  menuTitle: { fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, textAlign: 'center' },
  confirmTitle: { fontSize: 17, textAlign: 'center', marginBottom: 6 },
  confirmBody: { fontSize: 13, textAlign: 'center', marginBottom: 8 },
  sheetOption: { paddingVertical: 14, alignItems: 'center' },
  sheetOptionText: { fontSize: 16 },
  sheetActions: { flexDirection: 'row', gap: 10, marginTop: 22 },
  saveBtn: { flex: 1, paddingVertical: 15, borderRadius: 20, alignItems: 'center' },
  toast: { position: 'absolute', left: 24, right: 24, alignItems: 'center', paddingVertical: 12, paddingHorizontal: 18, borderRadius: 100, borderWidth: 1 },
})
