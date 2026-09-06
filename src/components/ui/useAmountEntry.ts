import { useCallback, useState } from 'react';
import { useInvalidFeedback } from './useInvalidFeedback';

/** Shared numpad editing; screens can reset dependent allocation state after an edit. */
export function useAmountEntry(initial = '', options: { onChange?: () => void; shakeAtZero?: boolean } = {}) {
  const [amount, setAmount] = useState(initial)
  const { shake, triggerInvalidFeedback } = useInvalidFeedback()
  const { onChange, shakeAtZero = false } = options
  const pushDigit = useCallback((digit: string) => {
    setAmount(prev => {
      if (digit === '.') return prev.includes('.') ? prev : prev === '' ? '0.' : prev + '.'
      const dot = prev.indexOf('.')
      if (dot !== -1 && prev.length - dot - 1 >= 2) return prev
      const next = (prev + digit).replace(/^0+(?=\d)/, '')
      return next.length > 9 ? prev : next
    })
    onChange?.()
  }, [onChange])
  const handleBackspace = useCallback(() => {
    if (shakeAtZero ? Number(amount) === 0 : amount === '') {
      triggerInvalidFeedback()
      return
    }
    setAmount(prev => prev.slice(0, -1))
    onChange?.()
  }, [amount, onChange, shakeAtZero, triggerInvalidFeedback])
  return { amount, setAmount, pushDigit, handleBackspace, shake }
}
