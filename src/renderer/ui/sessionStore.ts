import { create } from 'zustand'
import type { RepResult } from '@renderer/engine/repEvaluator'

export interface FinishedSession {
  skillId: string
  durationMs: number
  results: readonly RepResult[]
}

export type SaveStatus = 'saving' | 'saved' | 'failed' | 'nothing-to-save'

interface SessionState {
  // The skill the user picked on the home screen; calibration and training use it.
  skillId: string | null
  // The session that just ended, for the summary screen.
  finished: FinishedSession | null
  saveStatus: SaveStatus
  selectSkill: (skillId: string) => void
  finishSession: (session: FinishedSession) => void
  setSaveStatus: (status: SaveStatus) => void
}

export const useSession = create<SessionState>((set) => ({
  skillId: null,
  finished: null,
  saveStatus: 'saving',
  selectSkill: (skillId) => set({ skillId }),
  finishSession: (finished) => set({ finished, saveStatus: 'saving' }),
  setSaveStatus: (saveStatus) => set({ saveStatus })
}))
