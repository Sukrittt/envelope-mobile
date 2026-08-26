import { renderWithProviders } from '@/src/test-utils/renderWithProviders'
import { AmountText } from './AmountText'

describe('AmountText', () => {
  it('formats with Indian digit grouping', () => {
    const { getByText } = renderWithProviders(<AmountText value={125000} size={20} />)
    expect(getByText('₹1,25,000')).toBeTruthy()
  })

  it('renders negatives with a leading sign', () => {
    const { getByText } = renderWithProviders(<AmountText value={-450} size={20} />)
    expect(getByText('-₹450')).toBeTruthy()
  })

  it('splits an animated amount into one node per character but keeps the label whole', () => {
    // The odometer renders each char separately, so the full string is only
    // recoverable from the accessibility label — which is what a screen reader reads.
    const { getByLabelText, queryByText } = renderWithProviders(<AmountText value={1200} size={40} animate />)
    expect(getByLabelText('₹1,200')).toBeTruthy()
    expect(queryByText('₹1,200')).toBeNull()
  })

  it('uses tabular figures so digits do not shift width', () => {
    const { getByText } = renderWithProviders(<AmountText value={999} size={20} />)
    const flat = getByText('₹999').props.style.flat()
    expect(Object.assign({}, ...flat).fontVariant).toEqual(['tabular-nums'])
  })
})
