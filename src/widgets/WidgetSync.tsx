// Pushes live data to the Android widgets while the app is running. Mounted
// only while the signed-in screens are (see app/_layout.tsx) — same reason
// TabBar's FirstExpenseHintGate is conditionally rendered rather than always
// mounted: firing these queries before auth resolves would mean an
// unauthenticated /api/budgets call on every cold boot, guest or not.
//
// The headless widget-task-handler covers everything this can't reach: app
// killed, a widget freshly added, or the 30-minute OS timer.
import { useEffect } from 'react'
import { Platform } from 'react-native'
import { requestWidgetUpdate } from 'react-native-android-widget'
import type { WidgetInfo } from 'react-native-android-widget'
import { useBudgets } from '@/src/hooks/useBudgets'
import { useExpenses } from '@/src/hooks/useExpenses'
import { useCategories } from '@/src/hooks/useCategories'
import { useGroups } from '@/src/hooks/useGroups'
import { useTheme } from '@/src/theme/ThemeProvider'
import { computeEnvelopeState, currentMonthKey, daysLeftInMonth } from '@/src/lib/envelope'
import { todayIST } from '@/src/lib/date'
import { toWidgetData } from './data'
import { writeSnapshot } from './snapshot'
import { variants } from './variants'
import { EnvelopeWidget } from './EnvelopeWidget'
import { EnvelopeBarWidget } from './EnvelopeBarWidget'
import { EnvelopeMiniWidget } from './EnvelopeMiniWidget'

export function WidgetSync() {
  const { preference } = useTheme()
  const budgetsQ = useBudgets()
  const expensesQ = useExpenses()
  const categoriesQ = useCategories()
  const groupsQ = useGroups()

  useEffect(() => {
    if (Platform.OS !== 'android' || !budgetsQ.data || !expensesQ.data) return

    const state = computeEnvelopeState(
      budgetsQ.data,
      expensesQ.data,
      currentMonthKey(),
      categoriesQ.data ?? [],
      groupsQ.data ?? [],
    )
    const data = toWidgetData(state, expensesQ.data, daysLeftInMonth(), todayIST())
    void writeSnapshot(data)

    void requestWidgetUpdate({
      widgetName: 'Envelope',
      renderWidget: (info: WidgetInfo) =>
        variants(preference, (tokens, scheme) => (
          <EnvelopeWidget {...data} tokens={tokens} scheme={scheme} width={info.width} height={info.height} />
        )),
    })
    void requestWidgetUpdate({
      widgetName: 'EnvelopeBar',
      renderWidget: () => variants(preference, (tokens, scheme) => <EnvelopeBarWidget {...data} tokens={tokens} scheme={scheme} />),
    })
    void requestWidgetUpdate({
      widgetName: 'EnvelopeMini',
      renderWidget: () => variants(preference, (tokens, scheme) => <EnvelopeMiniWidget {...data} tokens={tokens} scheme={scheme} />),
    })
  }, [budgetsQ.data, expensesQ.data, categoriesQ.data, groupsQ.data, preference])

  return null
}
