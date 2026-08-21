import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native'
import { useTheme } from '@/src/theme/ThemeProvider'
import { fontFamily } from '@/src/theme/fonts'
import { LoadingCaption } from '@/src/components/shared/LoadingCaption'
import type { ChatSessionSummary } from '@/src/api/ai'

/** Written by hand (no Intl) per this app's date-formatting convention — see EnvelopeRow.tsx's lastSpentLabel. */
function timeAgoLabel(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const minutes = Math.round((Date.now() - d.getTime()) / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days}d ago`
  return d.toLocaleDateString()
}

interface Props {
  sessions: ChatSessionSummary[] | undefined
  loading: boolean
  onSelect: (id: string) => void
}

export function ChatHistoryList({ sessions, loading, onSelect }: Props) {
  const { tokens } = useTheme()

  if (loading) {
    return (
      <View style={{ paddingTop: 24 }}>
        <LoadingCaption />
      </View>
    )
  }

  if (!sessions || sessions.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={[styles.emptyText, { color: tokens.text2, fontFamily: fontFamily.bodyMedium }]}>
          No past chats yet
        </Text>
      </View>
    )
  }

  return (
    <ScrollView contentContainerStyle={styles.list}>
      {sessions.map((s) => (
        <Pressable
          key={s.id}
          onPress={() => onSelect(s.id)}
          style={[styles.row, { backgroundColor: tokens.card, borderColor: tokens.border }]}
        >
          <Text
            style={[styles.title, { color: tokens.text, fontFamily: fontFamily.bodySemiBold }]}
            numberOfLines={1}
          >
            {s.title}
          </Text>
          <Text style={[styles.meta, { color: tokens.text3, fontFamily: fontFamily.bodyMedium }]}>
            {timeAgoLabel(s.updatedAt)}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  list: { padding: 20, gap: 10 },
  row: { padding: 16, borderWidth: 1, borderRadius: 16, gap: 4 },
  title: { fontSize: 14 },
  meta: { fontSize: 11 },
  empty: { paddingTop: 40, alignItems: 'center' },
  emptyText: { fontSize: 13 },
})
