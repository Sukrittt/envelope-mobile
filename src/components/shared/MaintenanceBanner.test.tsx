import { fireEvent, waitFor } from '@testing-library/react-native'
import { renderWithProviders } from '@/src/test-utils/renderWithProviders'
import { MaintenanceBanner } from './MaintenanceBanner'

jest.mock('@/src/api/client', () => ({ apiFetch: jest.fn() }))
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }))

const { apiFetch } = jest.requireMock('@/src/api/client') as { apiFetch: jest.Mock }

const status = (on: boolean, message: string) => ({ ok: true, json: async () => ({ aiDisabled: false, maintenance: { on, message } }) })

describe('MaintenanceBanner', () => {
  it('shows the message when maintenance is on, and hides it on tap', async () => {
    apiFetch.mockResolvedValue(status(true, 'Down for maintenance at 11pm'))
    const { findByText, queryByText } = renderWithProviders(<MaintenanceBanner />)
    fireEvent.press(await findByText('Down for maintenance at 11pm'))
    expect(queryByText('Down for maintenance at 11pm')).toBeNull()
  })

  it('renders nothing when maintenance is off', async () => {
    apiFetch.mockResolvedValue(status(false, 'stale message'))
    const { queryByText } = renderWithProviders(<MaintenanceBanner />)
    await waitFor(() => expect(apiFetch).toHaveBeenCalled())
    expect(queryByText('stale message')).toBeNull()
  })
})
