import { act, renderHook } from '@testing-library/react-native'
import { LogExpenseSubmitProvider, useLogExpenseSubmitPublisher, useLogExpenseSubmitState } from './SubmitContext'
it('keeps submit state isolated between app roots', () => {
  const first = renderHook(() => ({ state: useLogExpenseSubmitState(), publish: useLogExpenseSubmitPublisher() }), { wrapper: LogExpenseSubmitProvider })
  const second = renderHook(() => useLogExpenseSubmitState(), { wrapper: LogExpenseSubmitProvider })
  const submit = jest.fn()
  act(() => first.result.current.publish({ canSubmit: true, saving: false, success: false, submit }))
  first.result.current.state.submit()
  expect(submit).toHaveBeenCalledTimes(1)
  expect(second.result.current.canSubmit).toBe(false)
})
