import { create } from 'zustand'
import { MAX_COACH_TURNS, type CoachError } from '@shared/coach'
import type { VyroApi } from '@shared/ipc'
import type { Language } from '@shared/settings'

export interface CoachTurn {
  role: 'user' | 'assistant'
  text: string
}

interface CoachState {
  turns: CoachTurn[]
  // A question is waiting for its answer.
  pending: boolean
  // Why the last question got no answer; cleared when asking again.
  error: CoachError | null
}

// The conversation lives only in memory: it is never written to disk, and it ends with the app.
export const useCoach = create<CoachState>(() => ({ turns: [], pending: false, error: null }))

type CoachApi = { coach: Pick<VyroApi['coach'], 'chat'> }

// What is sent: the most recent turns, starting with the user's (a conversation cannot open
// with the coach's own words).
export function windowOf(turns: readonly CoachTurn[]): CoachTurn[] {
  const recent = turns.slice(-MAX_COACH_TURNS)
  const firstUser = recent.findIndex((turn) => turn.role === 'user')
  return firstUser === -1 ? [] : recent.slice(firstUser)
}

async function ask(api: CoachApi, language: Language): Promise<void> {
  useCoach.setState({ pending: true, error: null })
  try {
    const result = await api.coach.chat({ turns: windowOf(useCoach.getState().turns), language })
    if (result.ok) {
      useCoach.setState((state) => ({
        turns: [...state.turns, { role: 'assistant', text: result.value.reply }],
        pending: false
      }))
    } else {
      useCoach.setState({ pending: false, error: result.error })
    }
  } catch {
    useCoach.setState({ pending: false, error: { kind: 'unknown' } })
  }
}

export async function sendToCoach(api: CoachApi, text: string, language: Language): Promise<void> {
  const message = text.trim()
  if (message === '' || useCoach.getState().pending) return

  useCoach.setState((state) => ({ turns: [...state.turns, { role: 'user', text: message }] }))
  await ask(api, language)
}

// Asks again the question that got no answer.
export async function retryCoach(api: CoachApi, language: Language): Promise<void> {
  const { turns, pending } = useCoach.getState()
  if (pending || turns[turns.length - 1]?.role !== 'user') return

  await ask(api, language)
}

export function resetCoach(): void {
  useCoach.setState({ turns: [], pending: false, error: null })
}
