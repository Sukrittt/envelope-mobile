import { useEffect, useState } from 'react'
import { View, Text, TextInput, Image, Pressable, ScrollView, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ArrowLeft, Check } from 'lucide-react-native'
import { Alert } from '@/src/components/ui/AlertHost'
import { useTheme } from '@/src/theme/ThemeProvider'
import { fontFamily } from '@/src/theme/fonts'
import { Icon } from '@/src/components/shared/Icon'
import { CheckIcon } from '@/src/components/shared/CheckIcon'
import { BottomSheet } from '@/src/components/shared/Modal'
import { clearAccess } from '@/src/api/accessMode'
import { deleteAccount, resendEmailCode, revokeAllSessions, revokeSession } from '@/src/api/account'
import { useUser, useUpdateUser, useSessions, useIdentities, useRestoreAccount } from '@/src/hooks/useUser'
import { useLinkGoogle } from '@/src/api/useLinkGoogle'
import { daysUntil } from '@/src/lib/format'

function sessionLabel(userAgent: string | null, authMethod: string): string {
  if (userAgent) return userAgent
  const method = authMethod === 'oauth' ? 'Google' : authMethod === 'magic_code' ? 'Email code' : authMethod
  return `Signed in with ${method}`
}

export default function SecurityScreen() {
  const { tokens } = useTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()

  const userQuery = useUser()
  const updateUser = useUpdateUser()
  const restoreAccountMutation = useRestoreAccount()
  const user = userQuery.data
  const sessionsQuery = useSessions()
  const identitiesQuery = useIdentities()
  const linkGoogle = useLinkGoogle()

  const [deleting, setDeleting] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleteEmailDraft, setDeleteEmailDraft] = useState('')
  const [signingOutAll, setSigningOutAll] = useState(false)
  const [revokingId, setRevokingId] = useState<string | null>(null)

  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [nameSuccess, setNameSuccess] = useState(false)

  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)

  const googleLinked = identitiesQuery.data?.includes('GoogleOAuth') ?? false

  useEffect(() => {
    if (linkGoogle.done) identitiesQuery.refetch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkGoogle.done])

  const openNameEdit = () => {
    setNameDraft(user?.name ?? '')
    setEditingName(true)
  }
  const saveName = () => {
    const name = nameDraft.trim()
    if (name === (user?.name ?? '')) {
      setEditingName(false)
      return
    }
    updateUser.mutate({ name }, { onSuccess: () => setNameSuccess(true) })
  }

  useEffect(() => {
    if (!nameSuccess) return
    const timer = setTimeout(() => {
      setEditingName(false)
      setNameSuccess(false)
    }, 1100)
    return () => clearTimeout(timer)
  }, [nameSuccess])

  const startEmailChange = () => router.push({ pathname: '/(auth)/email', params: { mode: 'change-email' } })
  const enterCode = () => router.push({ pathname: '/(auth)/code', params: { email: user?.email ?? '', mode: 'change-email' } })
  const resend = async () => {
    setResending(true)
    setResent(false)
    await resendEmailCode()
    setResending(false)
    setResent(true)
  }

  const onRevoke = async (id: string) => {
    setRevokingId(id)
    try {
      await revokeSession(id)
      await sessionsQuery.refetch()
    } finally {
      setRevokingId(null)
    }
  }

  const confirmSignOutAll = () => {
    Alert.alert('Sign out everywhere', 'This signs out every device, including this one.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out everywhere',
        style: 'destructive',
        onPress: async () => {
          setSigningOutAll(true)
          try {
            await revokeAllSessions()
          } catch {
            // Fall through to local sign-out even if the server call failed —
            // the user still expects this device to lock.
          }
          await clearAccess()
          router.replace('/(auth)/welcome')
        },
      },
    ])
  }

  const confirmDelete = () => {
    setDeleteEmailDraft('')
    setConfirmingDelete(true)
  }

  const doDelete = async () => {
    setDeleting(true)
    try {
      await deleteAccount(deleteEmailDraft.trim())
      await clearAccess()
      router.replace('/(auth)/welcome')
    } catch {
      setDeleting(false)
      setConfirmingDelete(false)
      Alert.alert('Could not delete account', 'Check your connection and try again.')
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: tokens.bg, paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: tokens.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={[styles.backButton, { backgroundColor: tokens.card, borderColor: tokens.border }]}>
          <Icon icon={ArrowLeft} size={20} color={tokens.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: tokens.text, fontFamily: fontFamily.displaySemiBold }]}>Account & security</Text>
      </View>

      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}>
        <View style={[styles.profileCard, { backgroundColor: tokens.card, borderColor: tokens.borderStrong }]}>
          {user?.avatarUrl ? (
            <Image source={{ uri: user.avatarUrl }} style={[styles.avatar, { borderColor: tokens.accent }]} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: tokens.accentSoft, borderColor: tokens.accent }]}>
              <Text style={[styles.avatarText, { color: tokens.accentInk, fontFamily: fontFamily.displaySemiBold }]}>
                {(user?.name || user?.email || '?').trim().charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.name, { color: tokens.text, fontFamily: fontFamily.bodyExtraBold }]} numberOfLines={1}>
              {user?.name || 'You'}
            </Text>
            <Text style={[styles.email, { color: tokens.text2, fontFamily: fontFamily.bodyMedium }]} numberOfLines={1}>
              {user?.email}
            </Text>
          </View>
          <Pressable
            onPress={openNameEdit}
            style={[styles.editButton, { backgroundColor: tokens.inputBg, borderColor: tokens.borderStrong }]}
          >
            <Text style={[styles.editButtonText, { color: tokens.text, fontFamily: fontFamily.bodyBold }]}>Edit</Text>
          </Pressable>
        </View>

        {user?.deletionScheduledFor ? (
          <View style={[styles.warnBanner, { backgroundColor: tokens.coralSoft, borderColor: tokens.coral }]}>
            <Text style={[styles.warnTitle, { color: tokens.coral, fontFamily: fontFamily.bodyExtraBold }]}>
              Account scheduled for deletion
            </Text>
            <Text style={[styles.warnCopy, { color: tokens.text2, fontFamily: fontFamily.bodyMedium }]}>
              {daysUntil(user.deletionScheduledFor)} day{daysUntil(user.deletionScheduledFor) === 1 ? '' : 's'} left to restore it.
            </Text>
            <Pressable
              onPress={() =>
                restoreAccountMutation.mutate(undefined, {
                  onError: () => Alert.alert('Could not restore account', 'Check your connection and try again.'),
                })
              }
              disabled={restoreAccountMutation.isPending}
              style={[styles.warnRestoreButton, { backgroundColor: tokens.coral, opacity: restoreAccountMutation.isPending ? 0.6 : 1 }]}
            >
              <Text style={[styles.warnRestoreButtonText, { color: tokens.onAccent, fontFamily: fontFamily.bodyBold }]}>
                {restoreAccountMutation.isPending ? 'Restoring…' : 'Restore account'}
              </Text>
            </Pressable>
          </View>
        ) : null}

        <View style={[styles.card, { backgroundColor: tokens.card, borderColor: tokens.border }]}>
          <View style={styles.block}>
            <View style={styles.emailRow}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.label, { color: tokens.text3 }]}>EMAIL</Text>
                <Text style={[styles.email, { color: tokens.text, fontFamily: fontFamily.bodyBold, marginTop: 6 }]} numberOfLines={1}>
                  {user?.email ?? '—'}
                </Text>
                <View style={styles.verifiedRow}>
                  {user?.emailVerified ? (
                    <>
                      <Icon icon={Check} size={14} color={tokens.mint} />
                      <Text style={[styles.verified, { color: tokens.mint, fontFamily: fontFamily.bodyMedium }]}>Verified</Text>
                    </>
                  ) : (
                    <Text style={[styles.verified, { color: tokens.accentInk, fontFamily: fontFamily.bodyMedium }]}>Unverified</Text>
                  )}
                </View>
              </View>
              <Pressable
                onPress={startEmailChange}
                style={[styles.editButton, { backgroundColor: tokens.inputBg, borderColor: tokens.borderStrong }]}
              >
                <Text style={[styles.editButtonText, { color: tokens.text, fontFamily: fontFamily.bodyBold }]}>Change</Text>
              </Pressable>
            </View>

            {user && !user.emailVerified && (
              <View style={[styles.warnBanner, { backgroundColor: tokens.accentSoft, borderColor: tokens.accent }]}>
                <Text style={[styles.warnTitle, { color: tokens.accentInk, fontFamily: fontFamily.bodyExtraBold }]}>Verify your email</Text>
                <Text style={[styles.warnCopy, { color: tokens.text2, fontFamily: fontFamily.bodyMedium }]}>
                  Enter the 6-digit code sent to {user.email}.
                </Text>
                <View style={styles.warnActions}>
                  <Pressable onPress={enterCode}>
                    <Text style={[styles.warnAction, { color: tokens.accentInk, fontFamily: fontFamily.bodyBold }]}>Enter code</Text>
                  </Pressable>
                  <Pressable onPress={resend} disabled={resending}>
                    <Text style={[styles.warnAction, { color: tokens.accentInk, fontFamily: fontFamily.bodyBold }]}>
                      {resending ? 'Sending…' : resent ? 'Code resent' : 'Resend code'}
                    </Text>
                  </Pressable>
                  <Pressable onPress={startEmailChange}>
                    <Text style={[styles.warnAction, { color: tokens.accentInk, fontFamily: fontFamily.bodyBold }]}>Change back</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </View>
          <View style={[styles.divider, { backgroundColor: tokens.border }]} />
          <View style={styles.row}>
            <View style={[styles.gBadge, { backgroundColor: tokens.inputBg, borderColor: tokens.borderStrong }]}>
              <Text style={[styles.gBadgeText, { color: tokens.accentInk, fontFamily: fontFamily.displaySemiBold }]}>G</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowLabel, { color: tokens.text, fontFamily: fontFamily.bodyBold }]}>Google</Text>
              {linkGoogle.error && (
                <Text style={[styles.rowHint, { color: tokens.coral }]} numberOfLines={2}>
                  {linkGoogle.error}
                </Text>
              )}
            </View>
            {googleLinked ? (
              <Text style={[styles.rowHint, { color: tokens.text2 }]}>Linked</Text>
            ) : (
              <Pressable
                onPress={linkGoogle.link}
                disabled={linkGoogle.pending}
                style={[styles.editButton, { backgroundColor: tokens.inputBg, borderColor: tokens.borderStrong }]}
              >
                <Text style={[styles.editButtonText, { color: tokens.text, fontFamily: fontFamily.bodyBold }]}>
                  {linkGoogle.pending ? 'Linking…' : 'Link'}
                </Text>
              </Pressable>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: tokens.text3, fontFamily: fontFamily.bodyBold }]}>ACTIVE SESSIONS</Text>
          <View style={[styles.card, { backgroundColor: tokens.card, borderColor: tokens.border }]}>
            {(sessionsQuery.data ?? []).map((s, i) => (
              <View key={s.id}>
                {i > 0 && <View style={[styles.divider, { backgroundColor: tokens.border }]} />}
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rowLabel, { color: tokens.text, fontFamily: fontFamily.bodyBold }]} numberOfLines={1}>
                      {sessionLabel(s.userAgent, s.authMethod)}
                    </Text>
                    <Text style={[styles.rowHint, { color: tokens.text2 }]}>{new Date(s.createdAt).toLocaleDateString()}</Text>
                  </View>
                  {s.current ? (
                    <View style={[styles.currentBadge, { backgroundColor: tokens.mintSoft }]}>
                      <Text style={[styles.currentBadgeText, { color: tokens.mint, fontFamily: fontFamily.bodyBold }]}>Current</Text>
                    </View>
                  ) : (
                    <Pressable
                      onPress={() => onRevoke(s.id)}
                      disabled={revokingId === s.id}
                      style={[styles.editButton, { backgroundColor: tokens.inputBg, borderColor: tokens.borderStrong }]}
                    >
                      <Text style={[styles.editButtonText, { color: tokens.coral, fontFamily: fontFamily.bodyBold }]}>
                        {revokingId === s.id ? 'Revoking…' : 'Revoke'}
                      </Text>
                    </Pressable>
                  )}
                </View>
              </View>
            ))}
            {sessionsQuery.data?.length === 0 && (
              <Text style={[styles.rowHint, { color: tokens.text2, padding: 16 }]}>No active sessions.</Text>
            )}
          </View>
        </View>

        <Pressable onPress={confirmSignOutAll} disabled={signingOutAll} style={styles.signOutEverywhere}>
          <Text style={[styles.signOutText, { color: tokens.accentInk, fontFamily: fontFamily.bodyBold }]}>
            {signingOutAll ? 'Signing out…' : 'Sign out everywhere'}
          </Text>
        </Pressable>

        <View style={[styles.dangerCard, { borderColor: tokens.coral }]}>
          <Text style={[styles.dangerTitle, { color: tokens.coral, fontFamily: fontFamily.bodyExtraBold }]}>Delete account</Text>
          <Text style={[styles.dangerBody, { color: tokens.text2, fontFamily: fontFamily.bodyMedium }]}>
            Removes envelopes, transactions and recaps. You have 7 days to sign back in and restore before it&apos;s gone for good.
          </Text>
          <Pressable
            onPress={confirmDelete}
            disabled={deleting}
            style={[styles.dangerButton, { backgroundColor: tokens.coral, opacity: deleting ? 0.6 : 1 }]}
          >
            <Text style={[styles.dangerButtonText, { color: tokens.onAccent, fontFamily: fontFamily.bodyBold }]}>
              {deleting ? 'Deleting…' : 'Delete account'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      <BottomSheet
        visible={confirmingDelete}
        onClose={() => {
          if (deleting) return
          setConfirmingDelete(false)
          setDeleteEmailDraft('')
        }}
      >
        <Text style={[styles.sheetTitle, { color: tokens.text, fontFamily: fontFamily.displaySemiBold }]}>Delete account</Text>
        <Text style={[styles.dangerBody, { color: tokens.text2, fontFamily: fontFamily.bodyMedium, marginTop: 8 }]}>
          Removes envelopes, transactions and recaps. You have 7 days to sign back in and restore before it&apos;s gone for good. Type{' '}
          <Text style={{ fontFamily: fontFamily.bodyBold, color: tokens.text }}>{user?.email}</Text> to confirm.
        </Text>
        <TextInput
          value={deleteEmailDraft}
          onChangeText={setDeleteEmailDraft}
          placeholder={user?.email ?? ''}
          placeholderTextColor={tokens.text3}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          editable={!deleting}
          style={[styles.sheetInput, { color: tokens.text, backgroundColor: tokens.inputBg, borderColor: tokens.borderStrong, fontFamily: fontFamily.bodyMedium, marginTop: 12 }]}
        />
        <View style={styles.sheetButtonRow}>
          <Pressable
            onPress={() => {
              setConfirmingDelete(false)
              setDeleteEmailDraft('')
            }}
            disabled={deleting}
            style={[styles.sheetCancelButton, { opacity: deleting ? 0.5 : 1 }]}
          >
            <Text style={[styles.sheetCancelText, { color: tokens.text2, fontFamily: fontFamily.bodyBold }]}>Cancel</Text>
          </Pressable>
          <Pressable
            onPress={doDelete}
            disabled={deleting || !user?.email || deleteEmailDraft.trim().toLowerCase() !== user.email.toLowerCase()}
            style={[
              styles.sheetSaveButton,
              styles.sheetDeleteButton,
              {
                backgroundColor: tokens.coral,
                opacity: deleting || !user?.email || deleteEmailDraft.trim().toLowerCase() !== user.email.toLowerCase() ? 0.5 : 1,
              },
            ]}
          >
            <Text style={[styles.sheetSaveText, { color: tokens.onAccent, fontFamily: fontFamily.bodyBold }]}>
              {deleting ? 'Deleting…' : 'Delete account'}
            </Text>
          </Pressable>
        </View>
      </BottomSheet>

      <BottomSheet visible={editingName} onClose={() => setEditingName(false)}>
        <Text style={[styles.sheetTitle, { color: tokens.text, fontFamily: fontFamily.displaySemiBold }]}>Your name</Text>
        <TextInput
          value={nameDraft}
          onChangeText={setNameDraft}
          placeholder="Your name"
          placeholderTextColor={tokens.text3}
          autoFocus
          onSubmitEditing={saveName}
          style={[styles.sheetInput, { color: tokens.text, backgroundColor: tokens.inputBg, borderColor: tokens.borderStrong, fontFamily: fontFamily.bodyMedium }]}
        />
        <Pressable
          onPress={saveName}
          disabled={updateUser.isPending || nameSuccess}
          style={[
            styles.sheetSaveButton,
            { backgroundColor: nameSuccess ? tokens.mint : tokens.accent, opacity: updateUser.isPending ? 0.5 : 1 },
          ]}
        >
          {nameSuccess ? (
            <CheckIcon color={tokens.onAccent} />
          ) : (
            <Text style={[styles.sheetSaveText, { color: tokens.onAccent, fontFamily: fontFamily.bodyBold }]}>
              {updateUser.isPending ? 'Saving…' : 'Save'}
            </Text>
          )}
        </Pressable>
      </BottomSheet>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  backButton: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 19 },
  scrollContent: { padding: 16, gap: 20 },
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderWidth: 1, borderRadius: 22 },
  avatar: { width: 52, height: 52, borderRadius: 26, borderWidth: 1 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 20 },
  name: { fontSize: 16 },
  card: { borderWidth: 1, borderRadius: 20, overflow: 'hidden' },
  block: { padding: 16 },
  emailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  label: { fontSize: 11 },
  email: { fontSize: 14 },
  verifiedRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  verified: { fontSize: 11 },
  divider: { height: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  gBadge: { width: 26, height: 26, borderRadius: 13, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  gBadgeText: { fontSize: 13 },
  rowLabel: { fontSize: 14 },
  rowHint: { fontSize: 11, marginTop: 2 },
  editButton: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 100, borderWidth: 1 },
  editButtonText: { fontSize: 12 },
  currentBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 100 },
  currentBadgeText: { fontSize: 11 },
  warnBanner: { marginTop: 12, padding: 14, borderRadius: 16, borderWidth: 1 },
  warnTitle: { fontSize: 12 },
  warnCopy: { fontSize: 12, marginTop: 4, lineHeight: 17 },
  warnActions: { flexDirection: 'row', gap: 16, marginTop: 10 },
  warnAction: { fontSize: 12 },
  warnRestoreButton: { marginTop: 12, alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 11, borderRadius: 100 },
  warnRestoreButtonText: { fontSize: 13 },
  section: { gap: 10 },
  sectionLabel: { fontSize: 11, letterSpacing: 0.5, paddingHorizontal: 4 },
  signOutEverywhere: { alignSelf: 'flex-start', paddingVertical: 6 },
  signOutText: { fontSize: 13 },
  dangerCard: { padding: 16, borderWidth: 1, borderRadius: 20 },
  dangerTitle: { fontSize: 14 },
  dangerBody: { fontSize: 12, marginTop: 6, lineHeight: 18 },
  dangerButton: { marginTop: 12, alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 11, borderRadius: 100 },
  dangerButtonText: { fontSize: 13 },
  sheetTitle: { fontSize: 18, marginBottom: 12 },
  sheetInput: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15 },
  sheetSaveButton: { marginTop: 12, minHeight: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  sheetSaveText: { fontSize: 14 },
  sheetButtonRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  sheetDeleteButton: { flex: 1, marginTop: 0 },
  sheetCancelButton: { flex: 1, minHeight: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  sheetCancelText: { fontSize: 14 },
})
