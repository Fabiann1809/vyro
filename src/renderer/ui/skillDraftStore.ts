import { create } from 'zustand'
import type { CoachError } from '@shared/coach'
import type { VyroApi } from '@shared/ipc'
import type { GenerateSkillResult } from '@shared/skillGeneration'
import type { Language } from '@shared/settings'
import { parseSkillConfig } from '@shared/skill/skillLoader'
import type { SkillConfig } from '@shared/skill/skillSchema'
import { loadCustomSkills } from './skillsStore'

// Why there is no skill: the coach decided it cannot be done, as opposed to an error.
export type SkillRefusal = Exclude<GenerateSkillResult, { kind: 'skill' }>

interface SkillDraftState {
  pending: boolean
  error: CoachError | null
  refusal: SkillRefusal | null
  // The skill that waits for the person to approve it.
  draft: SkillConfig | null
  // An approval or a discard that did not go through.
  actionFailed: boolean
}

// Only in memory: the draft itself is kept by the main process, this is what the screen shows.
export const useSkillDraft = create<SkillDraftState>(() => ({
  pending: false,
  error: null,
  refusal: null,
  draft: null,
  actionFailed: false
}))

type DraftApi = {
  coach: Pick<VyroApi['coach'], 'generateSkill'>
  skills: VyroApi['skills']
}

// Reads the draft the main process holds. The page checks it like any other skill.
export async function loadDraft(api: Pick<DraftApi, 'skills'>): Promise<void> {
  try {
    const source = await api.skills.getDraft()
    const parsed = source ? parseSkillConfig(source.config) : null
    useSkillDraft.setState({ draft: parsed?.ok ? parsed.skill : null })
  } catch {
    useSkillDraft.setState({ draft: null })
  }
}

export async function requestSkill(
  api: DraftApi,
  description: string,
  language: Language,
  existingSkillIds: string[]
): Promise<void> {
  const text = description.trim()
  if (text === '' || useSkillDraft.getState().pending) return

  useSkillDraft.setState({ pending: true, error: null, refusal: null, actionFailed: false })
  try {
    const result = await api.coach.generateSkill({ description: text, language, existingSkillIds })
    if (!result.ok) {
      useSkillDraft.setState({ pending: false, error: result.error })
    } else if (result.value.kind === 'skill') {
      await loadDraft(api)
      useSkillDraft.setState({ pending: false })
    } else {
      useSkillDraft.setState({ pending: false, refusal: result.value })
    }
  } catch {
    useSkillDraft.setState({ pending: false, error: { kind: 'unknown' } })
  }
}

// Makes the draft one more skill; gives its id, or null if it could not be approved.
export async function approveDraft(api: DraftApi): Promise<string | null> {
  const { draft } = useSkillDraft.getState()
  if (!draft) return null
  try {
    if (!(await api.skills.approveDraft(draft.id))) throw new Error('not approved')
    await loadCustomSkills(api)
    useSkillDraft.setState({ draft: null, actionFailed: false })
    return draft.id
  } catch {
    useSkillDraft.setState({ actionFailed: true })
    return null
  }
}

export async function discardDraft(api: Pick<DraftApi, 'skills'>): Promise<void> {
  const { draft } = useSkillDraft.getState()
  if (!draft) return
  try {
    if (!(await api.skills.discardDraft(draft.id))) throw new Error('not discarded')
    useSkillDraft.setState({ draft: null, actionFailed: false })
  } catch {
    useSkillDraft.setState({ actionFailed: true })
  }
}

export function resetSkillDraft(): void {
  useSkillDraft.setState({
    pending: false,
    error: null,
    refusal: null,
    draft: null,
    actionFailed: false
  })
}
