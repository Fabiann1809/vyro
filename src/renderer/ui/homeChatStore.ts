import { create } from 'zustand'
import type { CoachError } from '@shared/coach'
import type { VyroApi } from '@shared/ipc'
import type { PathToSave } from '@shared/paths'
import type { Language } from '@shared/settings'
import { resetCoach, retryCoach, sendToCoach, useCoach, type CoachTurn } from './coachStore'
import {
  resetPlanner,
  retryPlanner,
  sendToPlanner,
  usePathPlan,
  type PlannerSkills,
  type PlanOutcome
} from './pathPlanStore'

// The conversation on the home screen is two things in a row. First the coach plans: the person says
// what they want to learn, it may ask a few questions and it proposes a path (or says why it cannot).
// Once the path is saved, the talk goes on as an ordinary chat. The two parts keep their own
// stores; this one only knows which part is on, and what happened to the path that was proposed.

export type HomeMode = 'plan' | 'chat'
export type RouteStatus = 'proposed' | 'saving' | 'saved' | 'failed'

interface HomeChatState {
  mode: HomeMode
  routeStatus: RouteStatus
  // What was written while the coach is off. It is answered with an invitation, never sent.
  offlineTexts: string[]
}

export const useHomeChat = create<HomeChatState>(() => ({
  mode: 'plan',
  routeStatus: 'proposed',
  offlineTexts: []
}))

export type ThreadItem =
  | { key: string; kind: 'user' | 'coach'; text: string }
  | { key: string; kind: 'route'; path: PathToSave; status: RouteStatus }
  | { key: string; kind: 'reject'; outcome: Exclude<PlanOutcome, { kind: 'path' }> }
  | { key: string; kind: 'invite' }

const asItems = (turns: readonly CoachTurn[], prefix: string): ThreadItem[] =>
  turns.map((turn, index) => ({
    key: `${prefix}${index}`,
    kind: turn.role === 'user' ? 'user' : 'coach',
    text: turn.text
  }))

// What the screen shows, in order: the planning talk and how it ended, the chat that followed, and
// what was written with the coach off.
export function buildThread(input: {
  plannerTurns: readonly CoachTurn[]
  outcome: PlanOutcome | null
  routeStatus: RouteStatus
  coachTurns: readonly CoachTurn[]
  offlineTexts: readonly string[]
}): ThreadItem[] {
  const items = asItems(input.plannerTurns, 'p')
  const { outcome } = input
  if (outcome?.kind === 'path') {
    items.push({ key: 'outcome', kind: 'route', path: outcome.path, status: input.routeStatus })
  } else if (outcome) {
    items.push({ key: 'outcome', kind: 'reject', outcome })
  }
  items.push(...asItems(input.coachTurns, 'c'))
  input.offlineTexts.forEach((text, index) => {
    items.push({ key: `o${index}`, kind: 'user', text })
    items.push({ key: `i${index}`, kind: 'invite' })
  })
  return items
}

type HomeApi = {
  coach: Pick<VyroApi['coach'], 'chat' | 'planPath'>
}

export async function sendFromHome(
  api: HomeApi,
  text: string,
  language: Language,
  skills: PlannerSkills,
  aiEnabled: boolean
): Promise<void> {
  const message = text.trim()
  if (message === '' || isPending()) return

  if (!aiEnabled) {
    useHomeChat.setState((state) => ({ offlineTexts: [...state.offlineTexts, message] }))
    return
  }
  if (useHomeChat.getState().mode === 'chat') {
    await sendToCoach(api, message, language)
    return
  }

  const { outcome } = usePathPlan.getState()
  if (outcome) {
    // After a path, a new message is an adjustment and the talk goes on; after a refusal, it is
    // a new subject.
    if (outcome.kind === 'path') usePathPlan.setState({ outcome: null })
    else resetPlanner()
    useHomeChat.setState({ routeStatus: 'proposed' })
  }
  await sendToPlanner(api, message, language, skills)
}

// Asks again the question that got no answer, in the part of the conversation that is on.
export async function retryFromHome(
  api: HomeApi,
  language: Language,
  skills: PlannerSkills
): Promise<void> {
  if (useHomeChat.getState().mode === 'chat') await retryCoach(api, language)
  else await retryPlanner(api, language, skills)
}

export const isPending = (): boolean =>
  usePathPlan.getState().pending || useCoach.getState().pending

// Why the last question got no answer, if it did not.
export function currentError(
  mode: HomeMode,
  plannerError: CoachError | null,
  chatError: CoachError | null
): CoachError | null {
  return mode === 'chat' ? chatError : plannerError
}

// Keeps the path that was proposed. From then on the talk is a chat.
export async function saveProposedPath(api: {
  paths: Pick<VyroApi['paths'], 'save'>
}): Promise<boolean> {
  const { outcome } = usePathPlan.getState()
  const { routeStatus } = useHomeChat.getState()
  if (outcome?.kind !== 'path' || routeStatus === 'saving') return false
  // Already kept: there is nothing more to do, and keeping it again would make a second path.
  if (routeStatus === 'saved') return true

  useHomeChat.setState({ routeStatus: 'saving' })
  try {
    await api.paths.save(outcome.path)
    useHomeChat.setState({ routeStatus: 'saved', mode: 'chat' })
    return true
  } catch {
    useHomeChat.setState({ routeStatus: 'failed' })
    return false
  }
}

// The person wants to change what was proposed: the path goes away and the planning goes on.
export function adjustProposal(): void {
  usePathPlan.setState({ outcome: null })
  useHomeChat.setState({ routeStatus: 'proposed' })
}

export function startOver(): void {
  resetPlanner()
  resetCoach()
  useHomeChat.setState({ mode: 'plan', routeStatus: 'proposed', offlineTexts: [] })
}
