import { act, fireEvent, waitFor } from '@testing-library/react-native'
import * as SecureStore from 'expo-secure-store'
import { renderWithProviders } from '@/src/test-utils/renderWithProviders'
import { getCategories } from '@/src/api/categories'
import { getGroups } from '@/src/api/groups'
import { getExpenses } from '@/src/api/expenses'
import { CategoryPickerSheet } from './CategoryPickerSheet'

jest.mock('@/src/api/categories', () => ({ getCategories: jest.fn() }))
jest.mock('@/src/api/groups', () => ({ getGroups: jest.fn() }))
jest.mock('@/src/api/expenses', () => ({ getExpenses: jest.fn() }))
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  setItemAsync: jest.fn(() => Promise.resolve()),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
}))

// Enough categories that the "Recently used" shortcut is worth showing
// (below CategoryPickerSheet's RECENTS_MIN_CATEGORIES threshold it hides).
const CATEGORIES = [
  { name: 'Groceries', group: 'Essentials' },
  { name: 'Rent', group: 'Essentials' },
  { name: 'Fuel', group: 'Essentials' },
  { name: 'Coffee', group: 'Fun' },
  { name: 'Movies', group: 'Fun' },
  { name: 'Cabs', group: 'Fun' },
  { name: 'Flights', group: 'Fun' },
  { name: 'Hotels', group: 'Fun' },
]
const GROUPS = ['Essentials', 'Fun']

function setup(overrides?: { recentsStored?: string[] }) {
  ;(getCategories as jest.Mock).mockResolvedValue(CATEGORIES)
  ;(getGroups as jest.Mock).mockResolvedValue(GROUPS)
  ;(getExpenses as jest.Mock).mockResolvedValue([
    { category: 'Movies', date: '2026-09-01', timestamp: '' },
    { category: 'Fuel', date: '2026-09-05', timestamp: '' },
  ])
  ;(SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) =>
    key === 'mc-recent-categories' && overrides?.recentsStored
      ? Promise.resolve(JSON.stringify(overrides.recentsStored))
      : Promise.resolve(null),
  )

  const onSelect = jest.fn()
  const onClose = jest.fn()
  const utils = renderWithProviders(
    <CategoryPickerSheet visible value="" onSelect={onSelect} onClose={onClose} />,
  )
  return { ...utils, onSelect, onClose }
}

async function flush() {
  for (let i = 0; i < 10; i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
  }
}

beforeEach(() => jest.clearAllMocks())

it('shows recently used categories above the grouped list, seeded from expense history', async () => {
  const { getAllByText, findByText } = setup()
  await flush()

  await findByText('Recently used')
  // Fuel/Movies were used recently (per the mocked expenses) so each renders
  // twice: once as a recents chip, once in its group below. Groceries wasn't
  // used, so it stays put in its group only.
  expect(getAllByText(/Fuel/)).toHaveLength(2)
  expect(getAllByText(/Movies/)).toHaveLength(2)
  expect(getAllByText(/Groceries/)).toHaveLength(1)
})

it("prefers the device's stored MRU over the expense-derived seed once one exists", async () => {
  const { getAllByText, findByText } = setup({ recentsStored: ['Rent'] })
  await flush()

  await findByText('Recently used')
  expect(getAllByText(/Rent/)).toHaveLength(2)
  // The expense-derived seed (Fuel/Movies) is superseded, not merged — each
  // renders once now, in its group only.
  expect(getAllByText(/Fuel/)).toHaveLength(1)
  expect(getAllByText(/Movies/)).toHaveLength(1)
})

it('hides the recents section while searching', async () => {
  const { getByPlaceholderText, findByText, queryByText } = setup()
  await flush()
  await findByText('Recently used')

  fireEvent.changeText(getByPlaceholderText('Search categories…'), 'Groceries')

  await waitFor(() => expect(queryByText('Recently used')).toBeNull())
  expect(getByPlaceholderText('Search categories…').props.value).toBe('Groceries')
})

it('records a pick and closes the sheet', async () => {
  const { getByText, findByText, onSelect, onClose } = setup()
  await flush()
  await findByText('Recently used')

  fireEvent.press(getByText(/Groceries/))

  expect(onSelect).toHaveBeenCalledWith('Groceries')
  expect(onClose).toHaveBeenCalled()
  await waitFor(() =>
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('mc-recent-categories', JSON.stringify(['Groceries'])),
  )
})
