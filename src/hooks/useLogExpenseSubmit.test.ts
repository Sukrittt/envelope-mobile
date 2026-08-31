import { act, renderHook } from '@testing-library/react-native'
import { publishLogExpenseSubmit, resetLogExpenseSubmit, useLogExpenseSubmitState } from './useLogExpenseSubmit'

afterEach(() => resetLogExpenseSubmit())

it('defaults to a disabled, idle snapshot whose submit is a no-op', () => {
  const { result } = renderHook(() => useLogExpenseSubmitState())
  expect(result.current).toMatchObject({ canSubmit: false, saving: false, success: false })
  expect(() => result.current.submit()).not.toThrow()
})

it('updates every subscriber when the screen publishes a new snapshot', () => {
  const { result } = renderHook(() => useLogExpenseSubmitState())
  const submit = jest.fn()

  act(() => publishLogExpenseSubmit({ canSubmit: true, saving: false, success: false, submit }))

  expect(result.current.canSubmit).toBe(true)
  result.current.submit()
  expect(submit).toHaveBeenCalled()
})

it('restores the default snapshot on reset', () => {
  const { result } = renderHook(() => useLogExpenseSubmitState())
  act(() => publishLogExpenseSubmit({ canSubmit: true, saving: true, success: false, submit: jest.fn() }))

  act(() => resetLogExpenseSubmit())

  expect(result.current).toMatchObject({ canSubmit: false, saving: false, success: false })
})
