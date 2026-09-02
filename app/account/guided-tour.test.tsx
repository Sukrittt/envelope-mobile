import { fireEvent, waitFor } from '@testing-library/react-native'
import { renderWithProviders } from '@/src/test-utils/renderWithProviders'
import GuidedTourScreen from './guided-tour'

const mockPush = jest.fn()
const mockNavigate = jest.fn()
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, navigate: mockNavigate, back: jest.fn() }),
}))
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  setItemAsync: jest.fn(() => Promise.resolve()),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
}))
jest.mock('@/src/api/accessMode', () => ({
  accessMode: { subscribeLogout: () => () => {} },
}))

beforeEach(() => jest.clearAllMocks())

/** Opens a chapter from the hub by its row title. */
function openChapter(getByText: ReturnType<typeof renderWithProviders>['getByText'], title: string) {
  fireEvent.press(getByText(title))
}

it('funding every envelope drives Ready to Assign to zero', async () => {
  const { getByText, getAllByText } = renderWithProviders(<GuidedTourScreen />)
  openChapter(getByText, 'Envelopes & Ready to Assign')

  expect(getByText('₹42,000 of your ₹42,000 income has no job yet')).toBeTruthy()

  fireEvent.press(getByText('Assign ₹22,000'))
  fireEvent.press(getByText('Assign ₹9,000'))
  fireEvent.press(getByText('Assign ₹6,000'))
  fireEvent.press(getByText('Assign ₹5,000'))

  await waitFor(() => expect(getByText('Every rupee has a job ✓')).toBeTruthy())
  expect(getAllByText('✓ Funded').length).toBe(4)
})

it('logging a card expense sets money aside in Credit Card Payment', async () => {
  const { getByText } = renderWithProviders(<GuidedTourScreen />)
  openChapter(getByText, 'Logging money')

  fireEvent.press(getByText('🍲  ₹700 · Dosa night'))

  await waitFor(() => expect(getByText('Credit Card Payment')).toBeTruthy())
  expect(getByText('₹700 set aside')).toBeTruthy()
})

it('corrects the belief that leftovers roll over', async () => {
  const { getByText } = renderWithProviders(<GuidedTourScreen />)
  openChapter(getByText, 'The new month')

  fireEvent.press(getByText("It rolls into October's Fun. ₹7,600 to play with"))

  await waitFor(() => expect(getByText(/Leftovers don't compound here/)).toBeTruthy())
})

it('October restarts Credit Card Payment at zero and drops leftovers', async () => {
  const { getByText, getAllByText } = renderWithProviders(<GuidedTourScreen />)
  openChapter(getByText, 'The new month')

  expect(getByText('₹1,200 still unspent')).toBeTruthy()

  fireEvent.press(getByText('October 1'))

  await waitFor(() => expect(getAllByText('LEFTOVER GONE').length).toBe(2))
  expect(getByText('₹0')).toBeTruthy()
  expect(getByText("restarts at zero · it was last month's bill")).toBeTruthy()
})

it('walks hub to chapter to done, and deep links to the real screen', async () => {
  const { getByText } = renderWithProviders(<GuidedTourScreen />)

  fireEvent.press(getByText('Start the tour'))
  expect(getByText('CHAPTER 1 OF 6')).toBeTruthy()

  fireEvent.press(getByText('Try it for real · Open Envelopes'))
  expect(mockNavigate).toHaveBeenCalledWith('/(tabs)/envelopes')

  fireEvent.press(getByText('Skip'))
  await waitFor(() => expect(getByText('Tour complete')).toBeTruthy())
})
