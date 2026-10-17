import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CoachResult } from '@shared/coach'
import type { PlanPathInput, PlanPathResult } from '@shared/pathPlan'
import {
  resetPlanner,
  retryPlanner,
  sendToPlanner,
  usePathPlan,
  type PlannerSkills
} from './pathPlanStore'

const skills: PlannerSkills = [
  { id: 'squat', name: { es: 'Sentadilla', en: 'Squat' }, ruleIds: [] }
]

type Answer = CoachResult<PlanPathResult> | Error

function fakeApi(...answers: Answer[]): {
  api: Parameters<typeof sendToPlanner>[0]
  inputs: PlanPathInput[]
} {
  const inputs: PlanPathInput[] = []
  const queue = [...answers]
  const planPath = vi.fn((input: PlanPathInput) => {
    inputs.push(input)
    const next = queue.shift() ?? {
      ok: true as const,
      value: { kind: 'no-matching-skill' as const }
    }
    return next instanceof Error ? Promise.reject(next) : Promise.resolve(next)
  })
  return { api: { coach: { planPath } }, inputs }
}

const question = (text: string): Answer => ({
  ok: true,
  value: { kind: 'question', question: text }
})
const path: PlanPathResult = {
  kind: 'path',
  path: {
    goal: 'Mejorar',
    steps: [
      {
        title: 'Sentadilla',
        description: '',
        kind: 'skill',
        skillId: 'squat',
        criterionSessions: 3,
        criterionScore: 75
      }
    ]
  }
}

beforeEach(resetPlanner)

describe('planning a path', () => {
  it('keeps the question of the planner as part of the conversation', async () => {
    const { api } = fakeApi(question('¿Qué nivel tienes?'))

    await sendToPlanner(api, 'Quiero mejorar', 'es', skills)

    expect(usePathPlan.getState()).toMatchObject({
      turns: [
        { role: 'user', text: 'Quiero mejorar' },
        { role: 'assistant', text: '¿Qué nivel tienes?' }
      ],
      pending: false,
      outcome: null
    })
  })

  it('sends the conversation so far, the language and the skills that exist', async () => {
    const { api, inputs } = fakeApi(question('¿Nivel?'), question('¿Tiempo?'))

    await sendToPlanner(api, 'Quiero mejorar', 'es', skills)
    await sendToPlanner(api, 'Principiante', 'en', skills)

    expect(inputs[1]).toEqual({
      turns: [
        { role: 'user', text: 'Quiero mejorar' },
        { role: 'assistant', text: '¿Nivel?' },
        { role: 'user', text: 'Principiante' }
      ],
      language: 'en',
      skills
    })
  })

  it('ends with the path when the planner proposes one', async () => {
    const { api } = fakeApi({ ok: true, value: path })

    await sendToPlanner(api, 'Quiero mejorar', 'es', skills)

    expect(usePathPlan.getState().outcome).toEqual(path)
  })

  it.each([
    [{ kind: 'out-of-scope', reasons: ['invisible-outcome'], measurable: [] }],
    [{ kind: 'planned', pending: [{ channel: 'hands', phase: 13 }], measurable: ['body'] }],
    [{ kind: 'no-matching-skill' }]
  ] as Array<[PlanPathResult]>)('ends with the reason when there is no path: %j', async (value) => {
    const { api } = fakeApi({ ok: true, value })

    await sendToPlanner(api, 'Quiero aprender', 'es', skills)

    expect(usePathPlan.getState().outcome).toEqual(value)
  })

  it('does not take more messages once it has ended, or while it is waiting', async () => {
    const { api, inputs } = fakeApi({ ok: true, value: path })

    const first = sendToPlanner(api, 'Quiero mejorar', 'es', skills)
    await sendToPlanner(api, 'Otra cosa', 'es', skills)
    await first
    await sendToPlanner(api, 'Y otra', 'es', skills)

    expect(inputs).toHaveLength(1)
  })

  it('does not send an empty message', async () => {
    const { api, inputs } = fakeApi()

    await sendToPlanner(api, '   ', 'es', skills)

    expect(inputs).toEqual([])
  })

  it('keeps what was said and tells why there was no answer, and asks again on retry', async () => {
    const { api, inputs } = fakeApi({ ok: false, error: { kind: 'network' } }, question('¿Nivel?'))

    await sendToPlanner(api, 'Quiero mejorar', 'es', skills)
    expect(usePathPlan.getState()).toMatchObject({
      turns: [{ role: 'user', text: 'Quiero mejorar' }],
      error: { kind: 'network' }
    })

    await retryPlanner(api, 'es', skills)

    expect(inputs[1]?.turns).toEqual([{ role: 'user', text: 'Quiero mejorar' }])
    expect(usePathPlan.getState().error).toBeNull()
    expect(usePathPlan.getState().turns.at(-1)).toEqual({ role: 'assistant', text: '¿Nivel?' })
  })

  it('turns an unexpected failure into an unknown error', async () => {
    const { api } = fakeApi(new Error('boom'))

    await sendToPlanner(api, 'Quiero mejorar', 'es', skills)

    expect(usePathPlan.getState().error).toEqual({ kind: 'unknown' })
  })

  it('starts over on reset', async () => {
    const { api } = fakeApi({ ok: true, value: path })
    await sendToPlanner(api, 'Quiero mejorar', 'es', skills)

    resetPlanner()

    expect(usePathPlan.getState()).toEqual({
      turns: [],
      pending: false,
      error: null,
      outcome: null
    })
  })
})
