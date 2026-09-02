import { useMemo, useState } from 'react'
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet } from 'react-native'
import { useTheme } from '@/src/theme/ThemeProvider'
import { fontFamily } from '@/src/theme/fonts'
import { categoryEmoji, groupEmoji, splitEmoji } from '@/src/lib/emoji'
import { useCategories } from '@/src/hooks/useCategories'
import { useGroups } from '@/src/hooks/useGroups'
import { BottomSheet } from '@/src/components/shared/Modal'
import { EMPTY } from '@/src/lib/constants'

interface Props {
  visible: boolean
  onClose: () => void
  value: string
  onSelect: (category: string) => void
  /** Label for the "clear the link" row. Defaults to a generic "No category". */
  noneLabel?: string
}

/**
 * Grouped + searchable category picker, same shape as the filter sheet in
 * `app/(tabs)/activity.tsx` (groups categories by their budget group, search
 * narrows both group and item lists) — pulled out standalone so a second
 * caller (the subscription form) doesn't reimplement it.
 */
export function CategoryPickerSheet({ visible, onClose, value, onSelect, noneLabel = 'No category linked' }: Props) {
  const { tokens } = useTheme()
  const categoriesQ = useCategories()
  const groupsQ = useGroups()
  const [search, setSearch] = useState('')

  const categories = categoriesQ.data ?? EMPTY
  const groups = groupsQ.data ?? EMPTY

  const groupedCategories = useMemo(() => {
    const byGroup = new Map<string, typeof categories>()
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

  const filteredCategories = useMemo(() => {
    if (!search.trim()) return groupedCategories
    const q = search.trim().toLowerCase()
    return groupedCategories
      .map((g) => ({ ...g, items: g.items.filter((c) => c.name.toLowerCase().includes(q)) }))
      .filter((g) => g.items.length > 0)
  }, [groupedCategories, search])

  function pick(category: string) {
    onSelect(category)
    setSearch('')
    onClose()
  }

  return (
    <BottomSheet visible={visible} onClose={() => { onClose(); setSearch('') }}>
      <Text style={[styles.title, { color: tokens.text2, fontFamily: fontFamily.bodySemiBold }]}>Category</Text>
      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search categories…"
        placeholderTextColor={tokens.text3}
        autoCorrect={false}
        style={[styles.search, { backgroundColor: tokens.inputBg, borderColor: tokens.border, color: tokens.text, fontFamily: fontFamily.bodyMedium }]}
      />
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Pressable
          style={[styles.option, { borderBottomColor: tokens.border }, value === '' && { backgroundColor: tokens.chipActiveBg }]}
          onPress={() => pick('')}
        >
          <Text style={[styles.optionText, { color: tokens.text, fontFamily: fontFamily.bodySemiBold }]}>{noneLabel}</Text>
        </Pressable>
        {filteredCategories.map(
          (group) =>
            group.items.length > 0 && (
              <View key={group.name || 'other'}>
                <Text style={[styles.groupLabel, { color: tokens.text3, fontFamily: fontFamily.bodyBold }]}>
                  {group.name ? `${groupEmoji(group.name)} ${splitEmoji(group.name).text}` : 'Other'}
                </Text>
                <View style={[styles.groupItems, { borderLeftColor: tokens.border }]}>
                  {group.items.map((c, i) => (
                    <Pressable
                      key={c.name}
                      style={[
                        styles.option,
                        i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: tokens.border },
                        value === c.name && { backgroundColor: tokens.chipActiveBg },
                      ]}
                      onPress={() => pick(c.name)}
                    >
                      <Text style={[styles.optionText, { color: tokens.text, fontFamily: fontFamily.bodyMedium }]}>
                        {categoryEmoji(c.name, group.name)} {splitEmoji(c.name).text}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ),
        )}
        {search.trim() && filteredCategories.length === 0 && (
          <Text style={{ color: tokens.text3, fontFamily: fontFamily.bodyMedium, textAlign: 'center', paddingTop: 32 }}>
            No categories found
          </Text>
        )}
      </ScrollView>
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  title: { fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, textAlign: 'center' },
  search: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 13, marginBottom: 8 },
  scroll: { height: 420 },
  option: { paddingVertical: 12, paddingHorizontal: 8, borderRadius: 12 },
  optionText: { fontSize: 14 },
  groupLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 12, marginBottom: 2, paddingHorizontal: 8 },
  groupItems: { borderLeftWidth: StyleSheet.hairlineWidth, marginLeft: 8, paddingLeft: 4 },
})
