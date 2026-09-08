import { act, cleanup, fireEvent, waitFor } from '@testing-library/react-native'
import { useQuery } from '@tanstack/react-query'
import { renderWithProviders } from '@/src/test-utils/renderWithProviders'
import { getArchive, restoreArchivedItem } from '@/src/api/account'
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
const mockGetArchive = getArchive as jest.Mock
const mockRestoreArchivedItem = restoreArchivedItem as jest.Mock
const useQueryActual = jest.requireActual('@tanstack/react-query').useQuery

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

it('removes a restored row as soon as it settles, without waiting on the delayed background refetch', async () => {
  jest.useFakeTimers({ legacyFakeTimers: false })
  // Use the real useQuery/QueryClient for this test so cache writes
  // (qc.setQueryData / qc.invalidateQueries) actually drive a re-render,
  // unlike the static mockReturnValue used by the test above.
  mockUseQuery.mockImplementation((...args: Parameters<typeof useQueryActual>) =>
    useQueryActual(...args),
  )
  const items = [archivedItem(1), archivedItem(2)]
  // First call is the initial load. The second call is the refetch that
  // invalidateQueries() kicks off after restore settles — it deliberately
  // never resolves during this test, so a passing assertion below can only
  // be explained by an optimistic cache update, not by that refetch landing.
  mockGetArchive.mockResolvedValueOnce(items).mockReturnValueOnce(new Promise(() => {}))
  mockRestoreArchivedItem.mockResolvedValue(undefined)

  const { queryAllByText, getAllByText } = renderWithProviders(<ArchiveScreen />)

  // "Archived item 1" appears twice pre-restore: once in the "next to go"
  // hero summary, once in its list row.
  await waitFor(() => expect(queryAllByText('Archived item 1').length).toBe(2))

  await act(async () => {
    fireEvent.press(getAllByText('Restore')[0])
    await Promise.resolve()
    await Promise.resolve()
  })

  await act(async () => {
    jest.advanceTimersByTime(650)
    await Promise.resolve()
    await Promise.resolve()
  })

  expect(queryAllByText('Archived item 1').length).toBe(0)
  expect(queryAllByText('Archived item 2').length).toBeGreaterThan(0)
  // The refetch triggered by invalidateQueries() is in flight but unresolved
  // (its promise never settles), proving removal came from the optimistic
  // qc.setQueryData filter, not from that refetch completing.
  expect(mockGetArchive).toHaveBeenCalledTimes(2)

  jest.useRealTimers()
})
