import { create } from 'zustand'
import type { RepResult } from '@renderer/engine/repEvaluator'

export interface FinishedSession {
  skillId: string
  durationMs: number
  results: readonly RepResult[]
}

interface SessionState {
  // The skill the user picked on the home screen; calibration and training use it.
  skillId: string | null
  // The session that just ended, for the summary screen.
  finished: FinishedSession | null
  selectSkill: (skillId: string) => void
  finishSession: (session: FinishedSession) => void
}

export const useSession = create<SessionState>((set) => ({
  skillId: null,
  finished: null,
  selectSkill: (skillId) => set({ skillId }),
  finishSession: (finished) => set({ finished })
}))
