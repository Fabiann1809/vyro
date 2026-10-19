import { beforeEach, describe, expect, it, vi } from 'vitest'
import squat from '@renderer/skills/squat.json'
import type { CustomSkillSource } from '@shared/customSkills'
import type { CoachResult } from '@shared/coach'
import type { GenerateSkillResult } from '@shared/skillGeneration'
import {
  approveDraft,
  discardDraft,
  loadDraft,
  requestSkill,
  resetSkillDraft,
  suggestSkill,
  useSkillDraft
} from './skillDraftStore'
import { mergeSkills, useSkills } from './skillsStore'

const draftSource: CustomSkillSource = {
  id: 'custom_squat',
  config: { ...squat, id: 'custom_squat' }
}

function fakeApi(
  options: { draft?: CustomSkillSource | null; result?: CoachResult<GenerateSkillResult> } = {}
): Parameters<typeof requestSkill>[0] & { calls: string[] } {
  const calls: string[] = []
  let draft = options.draft ?? null
  const approved: CustomSkillSource[] = []
  return {
    calls,
    coach: {
      generateSkill: vi.fn(() => {
        calls.push('generate')
        draft = draftSource
        return Promise.resolve(
          options.result ?? {
            ok: true as const,
            value: { kind: 'skill' as const, id: 'custom_squat' }
          }
        )
      })
    },
    skills: {
      listCustom: vi.fn(() => Promise.resolve(approved)),
      getDraft: vi.fn(() => Promise.resolve(draft)),
      approveDraft: vi.fn((id: string) => {
        calls.push(`approve ${id}`)
        if (draft) approved.push(draft)
        draft = null
        return Promise.resolve(true)
      }),
      discardDraft: vi.fn((id: string) => {
        calls.push(`discard ${id}`)
        draft = null
        return Promise.resolve(true)
      })
    }
  }
}

beforeEach(() => {
  resetSkillDraft()
  useSkills.setState(mergeSkills([]))
})

describe('the skill draft', () => {
  it('shows the draft that the coach made, read back from the main process', async () => {
    const api = fakeApi()

    await requestSkill(api, 'Quiero una sentadilla', 'es', ['squat'])

    expect(useSkillDraft.getState().draft?.id).toBe('custom_squat')
    expect(useSkillDraft.getState().pending).toBe(false)
  })

  it('sends the ids that are in use, so the coach picks another', async () => {
    const api = fakeApi()

    await requestSkill(api, ' Quiero una sentadilla ', 'en', ['squat', 'pushup'])

    expect(api.coach.generateSkill).toHaveBeenCalledWith({
      description: 'Quiero una sentadilla',
      language: 'en',
      existingSkillIds: ['squat', 'pushup']
    })
  })

  it('keeps the reason when the coach says it cannot be done, and shows no draft', async () => {
    const refusal = {
      kind: 'out-of-scope' as const,
      reasons: ['no-signal' as const],
      measurable: []
    }
    const api = fakeApi({ result: { ok: true, value: refusal } })

    await requestSkill(api, 'Meditar', 'es', [])

    expect(useSkillDraft.getState()).toMatchObject({ refusal, draft: null })
  })

  it('keeps the kind of error when the coach fails', async () => {
    const api = fakeApi({ result: { ok: false, error: { kind: 'network' } } })

    await requestSkill(api, 'Algo', 'es', [])

    expect(useSkillDraft.getState().error).toEqual({ kind: 'network' })
  })

  it('does not ask for an empty description', async () => {
    const api = fakeApi()

    await requestSkill(api, '   ', 'es', [])

    expect(api.coach.generateSkill).not.toHaveBeenCalled()
  })

  it('ignores a draft that is not a valid skill', async () => {
    const api = fakeApi({ draft: { id: 'custom_bad', config: { id: 'custom_bad' } } })

    await loadDraft(api)

    expect(useSkillDraft.getState().draft).toBeNull()
  })

  it('approving makes it one more skill and says its id', async () => {
    const api = fakeApi({ draft: draftSource })
    await loadDraft(api)

    expect(await approveDraft(api)).toBe('custom_squat')

    expect(useSkills.getState().skills.map((skill) => skill.id)).toContain('custom_squat')
    expect(useSkillDraft.getState().draft).toBeNull()
  })

  it('discarding removes the draft and does not add a skill', async () => {
    const api = fakeApi({ draft: draftSource })
    await loadDraft(api)

    await discardDraft(api)

    expect(api.calls).toEqual(['discard custom_squat'])
    expect(useSkillDraft.getState().draft).toBeNull()
    expect(useSkills.getState().skills.map((skill) => skill.id)).not.toContain('custom_squat')
  })

  it('says so when the approval does not go through, and keeps the draft', async () => {
    const api = fakeApi({ draft: draftSource })
    await loadDraft(api)
    api.skills.approveDraft = vi.fn(() => Promise.resolve(false))

    expect(await approveDraft(api)).toBeNull()

    expect(useSkillDraft.getState()).toMatchObject({ actionFailed: true })
    expect(useSkillDraft.getState().draft?.id).toBe('custom_squat')
  })
})

describe('suggestSkill', () => {
  beforeEach(() => resetSkillDraft())

  it('keeps what the person wrote, without the spaces around it, until the screen uses it', () => {
    suggestSkill('  Quiero aprender a caminar  ')

    expect(useSkillDraft.getState().suggestion).toBe('Quiero aprender a caminar')
  })

  it('is forgotten when the draft is reset', () => {
    suggestSkill('Quiero aprender a caminar')
    resetSkillDraft()

    expect(useSkillDraft.getState().suggestion).toBe('')
  })
})
