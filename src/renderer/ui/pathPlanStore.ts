import { create } from 'zustand'
import type { CoachError } from '@shared/coach'
import type { VyroApi } from '@shared/ipc'
import type { PlanPathInput, PlanPathResult } from '@shared/pathPlan'
import type { Language } from '@shared/settings'
import { windowOf, type CoachTurn } from './coachStore'

// What the planner ends with: a path, or a reason why there is none. A question is not an ending.
export type PlanOutcome = Exclude<PlanPathResult, { kind: 'question' }>

interface PathPlanState {
  // What the user said and the questions the planner asked, in order.
  turns: CoachTurn[]
  pending: boolean
  error: CoachError | null
  outcome: PlanOutcome | null
}

// Only in memory, like the chat: the conversation is not kept.
export const usePathPlan = create<PathPlanState>(() => ({
  turns: [],
  pending: false,
  error: null,
  outcome: null
}))

type PlanApi = { coach: Pick<VyroApi['coach'], 'planPath'> }
export type PlannerSkills = PlanPathInput['skills']

async function ask(api: PlanApi, language: Language, skills: PlannerSkills): Promise<void> {
  usePathPlan.setState({ pending: true, error: null })
  try {
    const result = await api.coach.planPath({
      turns: windowOf(usePathPlan.getState().turns),
      language,
      skills
    })
    if (!result.ok) {
      usePathPlan.setState({ pending: false, error: result.error })
    } else if (result.value.kind === 'question') {
      const question = result.value.question
      usePathPlan.setState((state) => ({
        turns: [...state.turns, { role: 'assistant', text: question }],
        pending: false
      }))
    } else {
      usePathPlan.setState({ pending: false, outcome: result.value })
    }
  } catch {
    usePathPlan.setState({ pending: false, error: { kind: 'unknown' } })
  }
}

export async function sendToPlanner(
  api: PlanApi,
  text: string,
  language: Language,
  skills: PlannerSkills
): Promise<void> {
  const message = text.trim()
  const { pending, outcome } = usePathPlan.getState()
  // Once there is an ending, the next thing to do is to save it or start again.
  if (message === '' || pending || outcome) return

  usePathPlan.setState((state) => ({ turns: [...state.turns, { role: 'user', text: message }] }))
  await ask(api, language, skills)
}

// Asks again what got no answer.
export async function retryPlanner(
  api: PlanApi,
  language: Language,
  skills: PlannerSkills
): Promise<void> {
  const { turns, pending } = usePathPlan.getState()
  if (pending || turns[turns.length - 1]?.role !== 'user') return

  await ask(api, language, skills)
}

export function resetPlanner(): void {
  usePathPlan.setState({ turns: [], pending: false, error: null, outcome: null })
}
