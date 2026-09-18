import type { CategoryRow, SubscriptionRow } from '@/src/types'
import { pickSubscriptionCategory } from './trackAviaryPro'

const cat = (name: string): CategoryRow => ({ name, group: '' })
const sub = (service: string, category: string) => ({ service, category }) as SubscriptionRow

describe('pickSubscriptionCategory', () => {
  const categories = [cat('🍔 Food'), cat('📺 Streaming'), cat('🧾 Bills')]

  it('uses the envelope most existing subscriptions are filed under', () => {
    const subs = [sub('Netflix', '📺 Streaming'), sub('Rent', '🧾 Bills'), sub('Spotify', '📺 Streaming')]
    expect(pickSubscriptionCategory(subs, categories)).toBe('📺 Streaming')
  })

  it('ignores links to envelopes that no longer exist', () => {
    const subs = [sub('Netflix', 'Deleted envelope'), sub('Rent', '🧾 Bills')]
    expect(pickSubscriptionCategory(subs, categories)).toBe('🧾 Bills')
  })

  it('falls back to a subscriptions-looking envelope, then to none', () => {
    expect(pickSubscriptionCategory([], categories)).toBe('📺 Streaming')
    expect(pickSubscriptionCategory([], [cat('🍔 Food')])).toBe('')
  })
})
