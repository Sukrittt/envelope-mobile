import { ConflictReview } from '@/src/components/shared/ConflictReview'
import { useCurrency } from '@/src/context/CurrencyContext'

interface Props {
  title: string
  heading: string
  label: string
  latestAmount: number
  draftAmount: number
  onChoose: (keepDraft: boolean) => void
  onClose: () => void
}

export function BudgetConflictReview({
  title,
  heading,
  label,
  latestAmount,
  draftAmount,
  onChoose,
  onClose,
}: Props) {
  const { formatCurrency } = useCurrency()

  return (
    <ConflictReview
      title={title}
      heading={heading}
      description="A newer amount was saved elsewhere. Your amount is still here."
      rows={[{ label, saved: formatCurrency(latestAmount), next: formatCurrency(draftAmount) }]}
      guidance="Continue with your amount or use the latest saved value. You can review it before saving."
      announcement={`${heading}. Your amount is still here.`}
      testID="budget-conflict-scroll"
      onChoose={onChoose}
      onClose={onClose}
    />
  )
}
