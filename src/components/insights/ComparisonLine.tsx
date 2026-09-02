import { Text } from 'react-native'
import { useTheme } from '@/src/theme/ThemeProvider'
import { fontFamily } from '@/src/theme/fonts'
import { formatCurrency } from '@/src/lib/format'
import type { MonthComparison } from '@/src/lib/monthly'

interface Props {
  comparison: MonthComparison
  monthLabel: string
  hideAmounts?: boolean
}

/** The screen's headline: one sentence answering "is this normal" before any
 *  chart does. Every other card on Insights is a different rendering of the
 *  same total; this is the only place that says whether it's a good number. */
export function ComparisonLine({ comparison, monthLabel, hideAmounts = false }: Props) {
  const { tokens, type } = useTheme()
  const { spent, baseline, deltaPct, inProgress, projected, driver } = comparison
  const spentText = formatCurrency(spent, hideAmounts)
  const base = { fontSize: type.body, fontFamily: fontFamily.bodyMedium, color: tokens.text2 }
  const strong = { fontFamily: fontFamily.bodySemiBold, color: tokens.text }

  if (baseline == null || deltaPct == null) {
    return (
      <Text style={base}>
        <Text style={strong}>{spentText}</Text> {inProgress ? 'so far this month.' : `in ${monthLabel}.`}
      </Text>
    )
  }

  const over = deltaPct > 0
  const arrow = over ? '▲' : '▼'
  const deltaColor = over ? tokens.coral : tokens.mint
  const deltaLabel = `${arrow} ${Math.abs(deltaPct).toFixed(0)}%`
  const driverText = driver ? `${driver.emoji ? `${driver.emoji} ` : ''}${driver.category} drove it.` : ''

  if (inProgress) {
    return (
      <Text style={base}>
        <Text style={strong}>{spentText}</Text> so far, <Text style={[strong, { color: deltaColor }]}>{deltaLabel}</Text>{' '}
        {over ? 'above' : 'under'} your usual pace.
        {projected != null ? ` On track for about ${formatCurrency(projected, hideAmounts)}.` : ''}
      </Text>
    )
  }

  return (
    <Text style={base}>
      <Text style={strong}>{spentText}</Text> in {monthLabel}. <Text style={[strong, { color: deltaColor }]}>{deltaLabel}</Text>{' '}
      {over ? 'above' : 'under'} your usual 3 months. {driverText}
    </Text>
  )
}
