import { fireEvent } from '@testing-library/react-native'
import { Modal, ScrollView } from 'react-native'
import { renderWithProviders } from '@/src/test-utils/renderWithProviders'
import { ExpenseNoticeScreen } from './ExpenseNoticeScreen'

it.each([[409, 'This transaction was updated'], [404, 'This transaction is already deleted'], [undefined, 'We couldn’t confirm the deletion']] as const)('shows a separate screen for status %s with Back', (status, title) => {
  const onBack = jest.fn()
  const screen = renderWithProviders(<ExpenseNoticeScreen status={status} action="delete" onBack={onBack} />)
  expect(screen.getByText(title)).toBeTruthy()
  expect(screen.UNSAFE_getByType(Modal).props.presentationStyle).toBe('fullScreen')
  expect(screen.UNSAFE_getByType(ScrollView)).toBeTruthy()
  expect(onBack).not.toHaveBeenCalled()
  fireEvent.press(screen.getByRole('button', { name: 'Back to transactions' }))
  expect(onBack).toHaveBeenCalledTimes(1)
  fireEvent(screen.UNSAFE_getByType(Modal), 'requestClose')
  expect(onBack).toHaveBeenCalledTimes(2)
})
