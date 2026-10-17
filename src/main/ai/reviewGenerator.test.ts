import { describe, expect, it } from 'vitest'
import type { LearningPath, PathStep } from '@shared/paths'
import type { PlanPathInput } from '@shared/pathPlan'
import type { ReviewDigest } from '@shared/pathReview'
import { parseJsonAnswer } from './answer'
import type { GenerateRequest, LlmClient } from './llmClient'
import { generateReview } from './reviewGenerator'

const skills: PlanPathInput['skills'] = [
  { id: 'squat', name: { es: 'Sentadilla', en: 'Squat' }, ruleIds: ['depth'] },
  { id: 'pushup', name: { es: 'Flexión', en: 'Push-up' }, ruleIds: [] }
]

const step = (id: number, overrides: Partial<PathStep>): PathStep =>
  ({
    id,
    position: id,
    title: `Paso ${id}`,
    description: '',
    kind: 'skill',
    skillId: 'squat',
    criterionSessions: 3,
    criterionScore: 80,
    doneAt: null,
    ...overrides
  }) as PathStep

// Step 1 is done; 2 is the current one; 3 is a rest; 4 is still locked.
const path: LearningPath = {
  id: 7,
  goal: 'Mejorar mi sentadilla',
  createdAt: 1_000,
  status: 'active',
  steps: [
    step(1, { doneAt: 5_000 }),
    step(2, {}),
    step(3, {
      kind: 'auxiliary',
      skillId: null,
      criterionSessions: null,
      criterionScore: null
    }),
    step(4, { skillId: 'pushup' })
  ]
}

const digest: ReviewDigest = {
  goal: path.goal,
  daysSinceStart: 7,
  steps: path.steps.map((s, index) => ({
    id: s.id,
    position: s.position,
    title: s.title,
    kind: s.kind,
    skillId: s.skillId,
    criterionSessions: s.criterionSessions,
    criterionScore: s.criterionScore,
    state: index === 0 ? 'done' : index === 1 ? 'current' : 'locked',
    counted: s.kind === 'skill' ? 0 : null,
    attempts: s.kind === 'skill' ? 0 : null
  })),
  skills: [
    { skillId: 'squat', sessions: 4, averageScore: 62, lastScores: [55, 60, 65], errors: [] }
  ]
}

const input = (language: 'es' | 'en' = 'es'): Parameters<typeof generateReview>[1] => ({
  digest,
  path,
  skills,
  language
})

// A model that answers with the texts it is given, held to the schema of the request like the real
// adapters, so that what cannot be applied is sent back with the reason.
function scriptedModel(
  ...answers: unknown[]
): LlmClient & { requests: GenerateRequest<unknown>[] } {
  const requests: GenerateRequest<unknown>[] = []
  const queue = answers.map((answer) =>
    typeof answer === 'string' ? answer : JSON.stringify(answer)
  )
  return {
    requests,
    generate: <T>(request: GenerateRequest<T>): Promise<T> => {
      requests.push(request as GenerateRequest<unknown>)
      const text = queue.shift()
      if (text === undefined) return Promise.reject(new Error('No more answers were scripted.'))
      try {
        return Promise.resolve(parseJsonAnswer(text, request.schema))
      } catch (error) {
        return Promise.reject(error)
      }
    }
  }
}

const lowerGoal = {
  type: 'change-criteria',
  stepId: 2,
  criterionSessions: 2,
  criterionScore: 65,
  reason: 'Los puntajes están por debajo de la meta.'
}

describe('the weekly review', () => {
  it('gives the summary and the changes, with the path they are about', async () => {
    const model = scriptedModel({ summary: 'Semana difícil.', adjustments: [lowerGoal] })

    expect(await generateReview(model, input())).toEqual({
      pathId: 7,
      summary: 'Semana difícil.',
      adjustments: [lowerGoal]
    })
  })

  it('accepts a review that changes nothing', async () => {
    const model = scriptedModel({ summary: 'Todo va bien.', adjustments: [] })

    const review = await generateReview(model, input())

    expect(review.adjustments).toEqual([])
  })

  it('sends the digest of the path, the skills that exist and the language', async () => {
    const model = scriptedModel({ summary: 'Bien.', adjustments: [] })

    await generateReview(model, input('en'))

    const [request] = model.requests
    const [lead, json] = (request?.messages[0]?.content ?? '').split('\n')
    expect(lead).toBe('Review this week of the learning path.')
    expect(JSON.parse(json ?? '')).toEqual(digest)
    const system = String(request?.system)
    expect(system).toContain('Write in English')
    expect(system).toContain('- squat: "Squat"')
    expect(system).toContain('- pushup: "Push-up"')
    expect(request?.tier).toBe('capable')
  })

  it('asks the model to fix a change to a step that is already done', async () => {
    const model = scriptedModel(
      { summary: 'x', adjustments: [{ ...lowerGoal, stepId: 1 }] },
      { summary: 'x', adjustments: [lowerGoal] }
    )

    const review = await generateReview(model, input())

    expect(review.adjustments).toEqual([lowerGoal])
    expect(model.requests[1]?.messages.at(-1)?.content).toContain('step 1 is already done')
  })

  it('asks the model to fix a skill that does not exist, saying which ones do', async () => {
    const unknown = {
      type: 'add-step',
      afterStepId: 2,
      step: {
        title: 'Yoga',
        description: '',
        kind: 'skill',
        skillId: 'yoga_flow',
        criterionSessions: 2,
        criterionScore: 70
      },
      reason: 'x'
    }
    const model = scriptedModel(
      { summary: 'x', adjustments: [unknown] },
      { summary: 'x', adjustments: [] }
    )

    await generateReview(model, input())

    expect(model.requests[1]?.messages.at(-1)?.content).toContain(
      'unknown skill "yoga_flow". Use one of: squat, pushup.'
    )
  })

  it('accepts a step added right after the one that is done', async () => {
    const early = {
      type: 'add-step',
      afterStepId: 1,
      step: {
        title: 'Descanso',
        description: '',
        kind: 'auxiliary',
        skillId: null,
        criterionSessions: null,
        criterionScore: null
      },
      reason: 'x'
    }
    // After the step that is done is fine: it is exactly where the person is.
    const model = scriptedModel({ summary: 'x', adjustments: [early] })

    await expect(generateReview(model, input())).resolves.toMatchObject({ pathId: 7 })
  })

  it('fails with a clear error when the model keeps proposing what cannot be applied', async () => {
    const bad = { summary: 'x', adjustments: [{ ...lowerGoal, stepId: 99 }] }
    const model = scriptedModel(bad, bad, bad)

    await expect(generateReview(model, input())).rejects.toMatchObject({ kind: 'invalid-response' })
    expect(model.requests).toHaveLength(3)
  })

  it('does not accept more than five changes', async () => {
    const six = { summary: 'x', adjustments: Array(6).fill(lowerGoal) }
    const model = scriptedModel(six, six, six)

    await expect(generateReview(model, input())).rejects.toMatchObject({ kind: 'invalid-response' })
  })
})
