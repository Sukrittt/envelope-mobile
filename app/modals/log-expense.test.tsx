import { act, fireEvent } from '@testing-library/react-native'
import { renderWithProviders } from '@/src/test-utils/renderWithProviders'
import { getExpenses, postExpensePayload } from '@/src/api/expenses'
import { getCategories } from '@/src/api/categories'
import { getCategoryMap, suggestCategoryLLM } from '@/src/api/categoryMap'
import LogExpenseScreen from './log-expense'
import { useLogExpenseSubmitState, LogExpenseSubmitProvider } from '@/src/features/log-expense/SubmitContext'

jest.mock('@/src/api/expenses', () => ({
  getExpenses: jest.fn(),
  postExpensePayload: jest.fn(),
  mintExpensePayload: jest.requireActual('@/src/api/expenses').mintExpensePayload,
  updateExpense: jest.fn(),
}))
jest.mock('@/src/api/categories', () => ({
  getCategories: jest.fn(),
  addCategory: jest.fn(),
}))
jest.mock('@/src/api/categoryMap', () => ({
  getCategoryMap: jest.fn(),
  suggestCategoryLLM: jest.fn(),
}))

const mockReplace = jest.fn()
const mockBack = jest.fn()
let mockParams: Record<string, string> = {}
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, back: mockBack, push: jest.fn(), navigate: jest.fn() }),
  useLocalSearchParams: () => mockParams,
}))

// Mirror the screen and nav as siblings sharing the root submit context.
function Harness() {
  const { submit } = useLogExpenseSubmitState()
  ;(globalThis as any).__submit = submit
  return null
}

function setup() {
  mockParams = {}
  ;(getExpenses as jest.Mock).mockResolvedValue([])
  ;(getCategories as jest.Mock).mockResolvedValue([{ name: 'Groceries', group: 'Food' }])
  ;(getCategoryMap as jest.Mock).mockResolvedValue({ words: {} })
  ;(suggestCategoryLLM as jest.Mock).mockResolvedValue('')
  return renderWithProviders(
    <LogExpenseSubmitProvider>
      <LogExpenseScreen />
      <Harness />
    </LogExpenseSubmitProvider>,
  )
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.useFakeTimers({ legacyFakeTimers: false })
})

afterEach(() => {
  jest.useRealTimers()
})

async function fillValidForm(utils: ReturnType<typeof setup>) {
  const { getByPlaceholderText, getByLabelText, getByText, findByText } = utils
  fireEvent.changeText(getByPlaceholderText('What was it for?'), 'Milk')
  fireEvent.press(getByLabelText('4'))
  fireEvent.press(getByLabelText('5'))
  fireEvent.press(getByLabelText('0'))
  fireEvent.press(getByText('Category'))
  fireEvent.press(await findByText(/Groceries/))
}

it('plays the nav circle save animation before replacing the screen with the success screen', async () => {
  ;(postExpensePayload as jest.Mock).mockResolvedValue({ id: 'srv1', timestamp: '2026-09-04T01:24:00' })
  const utils = setup()
  await fillValidForm(utils)

  await act(async () => {
    ;(globalThis as any).__submit()
    // Let the mutation's promise settle without also advancing the 950ms
    // navigation timer, so the assertion below can catch the animation
    // actually playing before the replace happens.
    await Promise.resolve()
    await Promise.resolve()
  })

  expect(mockReplace).not.toHaveBeenCalled()

  await act(async () => {
    jest.advanceTimersByTime(950)
  })

  expect(mockReplace).toHaveBeenCalledWith(
    expect.objectContaining({
      pathname: '/modals/expense-added',
      params: expect.objectContaining({ id: 'srv1', item: 'Milk', amount: '450', category: 'Groceries' }),
    }),
  )
})

it('navigates to the success screen only after the save animation, not immediately on success', async () => {
  ;(postExpensePayload as jest.Mock).mockResolvedValue({ id: 'srv1', timestamp: '2026-09-04T01:24:00' })
  const utils = setup()
  await fillValidForm(utils)

  await act(async () => {
    ;(globalThis as any).__submit()
    await Promise.resolve()
    await Promise.resolve()
  })
  expect(mockReplace).not.toHaveBeenCalled()

  await act(async () => {
    jest.advanceTimersByTime(900)
  })
  expect(mockReplace).not.toHaveBeenCalled()

  await act(async () => {
    jest.advanceTimersByTime(100)
  })
  expect(mockReplace).toHaveBeenCalled()
})
