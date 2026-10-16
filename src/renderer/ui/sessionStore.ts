import { create } from 'zustand'

interface SessionState {
  // The skill the user picked on the home screen; calibration and training use it.
  skillId: string | null
  selectSkill: (skillId: string) => void
}

export const useSession = create<SessionState>((set) => ({
  skillId: null,
  selectSkill: (skillId) => set({ skillId })
}))
