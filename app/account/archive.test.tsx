import { cleanup, fireEvent } from '@testing-library/react-native'
import { useQuery } from '@tanstack/react-query'
import { renderWithProviders } from '@/src/test-utils/renderWithProviders'
import type { ArchivedItem } from '@/src/api/account'
import ArchiveScreen from './archive'

jest.mock('@tanstack/react-query', () => ({
  ...jest.requireActual('@tanstack/react-query'),
  useQuery: jest.fn(),
}))

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn() }),
}))

jest.mock('@/src/lib/netStatus', () => ({ useOnline: () => true }))

jest.mock('@/src/api/account', () => ({
  getArchive: jest.fn(),
  restoreArchivedItem: jest.fn(() => Promise.resolve()),
  purgeArchivedItem: jest.fn(() => Promise.resolve()),
}))

const mockUseQuery = useQuery as jest.Mock

function archivedItem(index: number): ArchivedItem {
  const now = Date.now()
  return {
    id: `item-${index}`,
    collection: 'expenses',
    label: `Archived item ${index}`,
    deletedAt: new Date(now - index * 1_000).toISOString(),
    purgesAt: new Date(now + 6 * 86_400_000).toISOString(),
  }
}

beforeEach(() => {
  jest.clearAllMocks()
})

afterEach(() => {
  cleanup()
})

it('shows ten archived items at a time and navigates between pages', async () => {
  mockUseQuery.mockReturnValue({
    data: Array.from({ length: 11 }, (_, index) => archivedItem(index + 1)),
    isLoading: false,
  })

  const { getByLabelText, getByText, queryByText } = renderWithProviders(
    <ArchiveScreen />,
  )

  expect(getByText('Page 1 of 2')).toBeTruthy()
  expect(getByText('1–10 of 11')).toBeTruthy()
  expect(queryByText('Archived item 11')).toBeNull()

  fireEvent.press(getByLabelText('Next archive page'))

  expect(getByText('Page 2 of 2')).toBeTruthy()
  expect(getByText('11–11 of 11')).toBeTruthy()
  expect(getByText('Archived item 11')).toBeTruthy()

  fireEvent.press(getByLabelText('Previous archive page'))
  expect(getByText('Page 1 of 2')).toBeTruthy()
})
