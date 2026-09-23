import { renderWithProviders } from '@/src/test-utils/renderWithProviders'
import { ChatMarkdown } from './ChatMarkdown'
import { BrainThinking } from './BrainThinking'

describe('ChatMarkdown', () => {
  it('renders bold runs without the asterisks', () => {
    const { getByText, queryByText } = renderWithProviders(<ChatMarkdown text="You spent **₹4,200** on food." />)
    expect(getByText('₹4,200')).toBeTruthy()
    expect(queryByText(/\*\*/)).toBeNull()
  })

  it('numbers ordered lists from their start and bullets the rest', () => {
    const { getByText, getAllByText } = renderWithProviders(
      <ChatMarkdown text={'2. Cut takeout\n3. Pause Netflix\n\n- Rent\n- Fuel'} />,
    )
    expect(getByText('2.')).toBeTruthy()
    expect(getByText('3.')).toBeTruthy()
    expect(getByText('Pause Netflix')).toBeTruthy()
    expect(getAllByText('•')).toHaveLength(2)
  })
})

describe('BrainThinking', () => {
  it('announces itself as a thinking progress indicator', () => {
    const { getByLabelText } = renderWithProviders(<BrainThinking color="#000" />)
    expect(getByLabelText('Thinking')).toBeTruthy()
  })
})
