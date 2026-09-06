import { createContext, useContext, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';

export const LOG_EXPENSE_PATH = '/modals/log-expense'
export type LogExpenseSubmitSnapshot = { canSubmit: boolean; saving: boolean; success: boolean; submit: () => void }
export const EMPTY_SUBMIT: LogExpenseSubmitSnapshot = { canSubmit: false, saving: false, success: false, submit: () => { } }
const StateContext = createContext(EMPTY_SUBMIT)
const PublishContext = createContext<Dispatch<SetStateAction<LogExpenseSubmitSnapshot>>>(() => { })

export function LogExpenseSubmitProvider({ children }: { children: ReactNode }) {
  const [state, publish] = useState(EMPTY_SUBMIT)
  return <PublishContext.Provider value={publish}><StateContext.Provider value={state}>{children}</StateContext.Provider></PublishContext.Provider>
}
export const useLogExpenseSubmitState = () => useContext(StateContext)
export const useLogExpenseSubmitPublisher = () => useContext(PublishContext)
