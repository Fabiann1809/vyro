import { create } from 'zustand'
import type { VyroApi } from '@shared/ipc'
import type { LocalCounts } from '@shared/localData'

// Where the app is in the question "what happens to the data on this computer?" after signing in.
//  - checking: the main process is deciding;
//  - ask: there is data from before the account and the person has to choose;
//  - ready: the data belongs to this account and the app can open.
type Phase = 'checking' | 'ask' | 'ready'

interface LocalDataState {
  phase: Phase
  counts: LocalCounts | null
  // The check or the answer did not go through; the person can try again.
  failed: boolean
}

export const useLocalData = create<LocalDataState>(() => ({
  phase: 'checking',
  counts: null,
  failed: false
}))

type LocalDataApi = Pick<VyroApi, 'localData'>

// Called once the account is known. Until it says "ready", the app does not open.
export async function checkLocalData(api: LocalDataApi): Promise<void> {
  try {
    const result = await api.localData.check()
    useLocalData.setState(
      result.action === 'ask'
        ? { phase: 'ask', counts: result.counts, failed: false }
        : { phase: 'ready', counts: null, failed: false }
    )
  } catch {
    // The door stays shut: opening the app without knowing whose data it holds is not an option.
    useLocalData.setState({ phase: 'checking', failed: true })
  }
}

export async function resolveLocalData(api: LocalDataApi, keep: boolean): Promise<void> {
  try {
    await api.localData.resolve({ keep })
    useLocalData.setState({ phase: 'ready', counts: null, failed: false })
  } catch {
    useLocalData.setState({ failed: true })
  }
}

// When the person signs out, the next one has to be checked again.
export function resetLocalData(): void {
  useLocalData.setState({ phase: 'checking', counts: null, failed: false })
}
