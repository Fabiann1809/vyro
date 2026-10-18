import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { afterEach, describe, expect, it } from 'vitest'
import { planObjectsForLater } from '@shared/feasibilityFixtures'
import type { PlanPathInput } from '@shared/pathPlan'
import { parseJsonAnswer } from './answer'
import { LlmError } from './errors'
import type { GenerateRequest, LlmClient } from './llmClient'
import { generatePathTurn, planTurnSchema } from './pathGenerator'

const skills: PlanPathInput['skills'] = [
  { id: 'squat', name: { es: 'Sentadilla', en: 'Squat' }, ruleIds: ['depth', 'torso_lean'] },
  { id: 'pushup', name: { es: 'Flexión', en: 'Push-up' }, ruleIds: ['depth'] }
]

const user = (text: string): PlanPathInput['turns'][number] => ({ role: 'user', text })
const coach = (text: string): PlanPathInput['turns'][number] => ({ role: 'assistant', text })

const input = (
  turns: PlanPathInput['turns'],
  overrides: Partial<PlanPathInput> = {}
): PlanPathInput => ({ turns, language: 'es', skills, ...overrides })

const skillStep = (skillId: string, overrides: Record<string, unknown> = {}): unknown => ({
  title: `Practicar ${skillId}`,
  description: 'Series lentas y controladas.',
  kind: 'skill',
  skillId,
  criterionSessions: 3,
  criterionScore: 75,
  ...overrides
})

const restStep = {
  title: 'Descansar',
  description: 'Un día sin entrenar.',
  kind: 'auxiliary',
  skillId: null,
  criterionSessions: null,
  criterionScore: null,
  guide: { tips: ['Camina diez minutos a paso suave.'], minutes: 10 }
}

const bodyOnly = { channels: ['body'] }

const proposal = (steps: unknown[], requirement: unknown = bodyOnly): string =>
  JSON.stringify({ action: 'propose', requirement, path: { goal: 'Mejorar mi sentadilla', steps } })

// A model that answers with the texts it is given, in order, and is held to the schema of the
// request exactly like the real adapters do: what does not fit is an invalid-response error that
// carries what was wrong, so the repair loop is exercised for real.
function scriptedModel(...answers: string[]): LlmClient & { requests: GenerateRequest<unknown>[] } {
  const requests: GenerateRequest<unknown>[] = []
  const queue = [...answers]
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

describe('a path for a skill that can be coached', () => {
  it('gives a valid path, ready to save', async () => {
    const model = scriptedModel(proposal([skillStep('squat'), restStep, skillStep('pushup')]))

    const result = await generatePathTurn(model, input([user('Quiero mejorar mi sentadilla')]))

    expect(result).toEqual({
      kind: 'path',
      path: {
        goal: 'Mejorar mi sentadilla',
        steps: [
          expect.objectContaining({ kind: 'skill', skillId: 'squat' }),
          expect.objectContaining({ kind: 'auxiliary', skillId: null }),
          expect.objectContaining({ kind: 'skill', skillId: 'pushup' })
        ]
      }
    })
  })

  it('sends the conversation as it is, and tells the model what exists and what to answer in', async () => {
    const model = scriptedModel(proposal([skillStep('squat')]))

    await generatePathTurn(
      model,
      input([user('Quiero mejorar'), coach('¿Qué nivel tienes?'), user('Principiante')], {
        language: 'en'
      })
    )

    const [request] = model.requests
    expect(request?.messages.map((m) => [m.role, m.content])).toEqual([
      ['user', 'Quiero mejorar'],
      ['assistant', '¿Qué nivel tienes?'],
      ['user', 'Principiante']
    ])
    expect(request?.tier).toBe('capable')
    const system = String(request?.system)
    expect(system).toContain('in English')
    expect(system).toContain('- squat: "Squat" / "Sentadilla"; it corrects: depth, torso_lean')
    expect(system).toContain('guitar')
  })

  it('does not accept a path that has to be fixed, and asks the model to fix it', async () => {
    const model = scriptedModel(proposal([skillStep('yoga_flow')]), proposal([skillStep('squat')]))

    const result = await generatePathTurn(model, input([user('Quiero mejorar')]))

    expect(result.kind).toBe('path')
    expect(model.requests).toHaveLength(2)
    const repairTurn = model.requests[1]?.messages.at(-1)
    expect(repairTurn?.content).toContain('Unknown skill "yoga_flow". Use one of: squat, pushup.')
  })

  it('asks for a guide in every auxiliary step, and keeps it when it is there', async () => {
    const bare = { ...restStep, guide: undefined }
    const model = scriptedModel(
      proposal([skillStep('squat'), bare]),
      proposal([skillStep('squat'), restStep])
    )

    const result = await generatePathTurn(model, input([user('Quiero mejorar')]))

    expect(model.requests[1]?.messages.at(-1)?.content).toContain('An auxiliary step needs a guide')
    expect(result).toMatchObject({
      kind: 'path',
      path: { steps: [{ guide: null }, { guide: { minutes: 10 } }] }
    })
  })

  it('asks again when a diagram is not in the library, and tells the model the names', async () => {
    const withDiagram = (name: string): unknown => ({
      ...restStep,
      guide: { ...restStep.guide, diagrams: [{ kind: 'chord', name }] }
    })
    const model = scriptedModel(
      proposal([skillStep('squat'), withDiagram('Zm9')]),
      proposal([skillStep('squat'), withDiagram('Am')])
    )

    const result = await generatePathTurn(model, input([user('Quiero mejorar')]))

    expect(model.requests[1]?.messages.at(-1)?.content).toContain('diagrams')
    expect(result).toMatchObject({
      kind: 'path',
      path: { steps: [{}, { guide: { diagrams: [{ kind: 'chord', name: 'Am' }] } }] }
    })
    expect(String(model.requests[0]?.system)).toContain('Asus2, B7, Bm')
  })

  it('asks for at least one skill step, since a path of rests measures nothing', async () => {
    const model = scriptedModel(proposal([restStep, restStep]), proposal([skillStep('squat')]))

    const result = await generatePathTurn(model, input([user('Quiero mejorar')]))

    expect(result.kind).toBe('path')
    expect(model.requests[1]?.messages.at(-1)?.content).toContain(
      'at least one step with kind "skill"'
    )
  })

  it('fails with a clear error when the model keeps getting it wrong', async () => {
    const wrong = proposal([skillStep('yoga_flow')])
    const model = scriptedModel(wrong, wrong, wrong)

    await expect(generatePathTurn(model, input([user('Quiero mejorar')]))).rejects.toMatchObject({
      kind: 'invalid-response'
    })
    expect(model.requests).toHaveLength(3)
  })

  it('fails with a clear error when the model answers something that is not JSON at all', async () => {
    const model = scriptedModel('Claro, aquí tienes', 'Claro, aquí tienes', 'Claro, aquí tienes')

    await expect(generatePathTurn(model, input([user('Hola')]))).rejects.toBeInstanceOf(LlmError)
  })
})

describe('the clarifying questions', () => {
  const asking = (question: string): string =>
    JSON.stringify({ action: 'ask', requirement: bodyOnly, question })

  it('passes the question on', async () => {
    const model = scriptedModel(asking('¿Qué nivel tienes?'))

    expect(await generatePathTurn(model, input([user('Quiero mejorar')]))).toEqual({
      kind: 'question',
      question: '¿Qué nivel tienes?'
    })
  })

  it('lets the model ask while it has questions left', async () => {
    const model = scriptedModel(asking('¿Y el tiempo?'))
    const twoAsked = input([user('a'), coach('q1'), user('b'), coach('q2'), user('c')])

    expect((await generatePathTurn(model, twoAsked)).kind).toBe('question')
    expect(String(model.requests[0]?.system)).toContain('up to 3 short clarifying questions')
  })

  it('stops the questions after the third, and makes the model propose', async () => {
    const model = scriptedModel(asking('¿Una cuarta?'), proposal([skillStep('squat')]))
    const threeAsked = input([
      user('a'),
      coach('q1'),
      user('b'),
      coach('q2'),
      user('c'),
      coach('q3'),
      user('d')
    ])

    const result = await generatePathTurn(model, threeAsked)

    expect(result.kind).toBe('path')
    expect(String(model.requests[0]?.system)).toContain('Do NOT ask anything else')
    // The first answer was a fourth question, which the schema of that request did not allow.
    expect(model.requests).toHaveLength(2)
  })
})

describe('a skill that VYRO cannot coach', () => {
  it('declines it, saying why, whatever the model proposed', async () => {
    const model = scriptedModel(
      proposal([skillStep('squat')], { channels: [], outOfScope: ['invisible-outcome'] })
    )

    expect(await generatePathTurn(model, input([user('Quiero aprender a meditar')]))).toEqual({
      kind: 'out-of-scope',
      reasons: ['invisible-outcome', 'no-signal'],
      measurable: []
    })
  })

  it('declines it at once, without asking questions that would lead nowhere', async () => {
    const model = scriptedModel(
      JSON.stringify({
        action: 'ask',
        requirement: { channels: ['body'], outOfScope: ['physical-risk'] },
        question: '¿Cuánto tiempo llevas lesionado?'
      })
    )

    const result = await generatePathTurn(model, input([user('Quiero rehabilitar mi rodilla')]))

    expect(result).toEqual({
      kind: 'out-of-scope',
      reasons: ['physical-risk'],
      measurable: ['body']
    })
  })

  it('suggests the part that can be measured', async () => {
    const model = scriptedModel(
      proposal([skillStep('squat')], {
        channels: ['body', 'hands'],
        outOfScope: ['too-fine-detail']
      })
    )

    const result = await generatePathTurn(model, input([user('Quiero aprender a dibujar')]))

    expect(result).toEqual({
      kind: 'out-of-scope',
      reasons: ['too-fine-detail'],
      measurable: ['body', 'hands']
    })
  })

  it('declines an object that has no detector', async () => {
    const model = scriptedModel(
      proposal([skillStep('squat')], { channels: ['body', 'object'], objects: ['violin'] })
    )

    const result = await generatePathTurn(model, input([user('Quiero tocar el violín')]))

    expect(result).toMatchObject({
      kind: 'out-of-scope',
      reasons: ['unsupported-object'],
      measurable: ['body']
    })
  })
})

let restore: (() => void) | undefined
afterEach(() => restore?.())

describe('a skill that needs a channel that has not arrived yet', () => {
  it('says what is pending and in which phase, and what could be measured already', async () => {
    restore = planObjectsForLater()
    const model = scriptedModel(
      proposal([skillStep('squat')], {
        channels: ['body', 'hands', 'audio', 'object'],
        objects: ['guitar']
      })
    )

    const result = await generatePathTurn(model, input([user('Quiero aprender guitarra')]))

    expect(result).toEqual({
      kind: 'planned',
      pending: [{ channel: 'object', phase: 20 }],
      measurable: ['body', 'hands', 'audio', 'object']
    })
  })
})

describe('a goal that no existing skill trains', () => {
  it('says so', async () => {
    const model = scriptedModel(
      JSON.stringify({ action: 'no-matching-skill', requirement: bodyOnly })
    )

    expect(await generatePathTurn(model, input([user('Quiero hacer yoga')]))).toEqual({
      kind: 'no-matching-skill'
    })
  })
})

describe('what is sent', () => {
  it('blocks a message that carries a picture, and sends nothing', async () => {
    const model = scriptedModel(proposal([skillStep('squat')]))
    const withImage = input([user(`mira esto ${'iVBORw0KGgoAAAANSUhEUg'.repeat(20)}`)])

    await expect(generatePathTurn(model, withImage)).rejects.toMatchObject({ kind: 'blocked' })
    expect(model.requests).toEqual([])
  })
})

describe('the schema that the model has to follow', () => {
  it('is accepted by the schema converter of the Claude SDK, which has stricter limits', () => {
    for (const canAsk of [true, false]) {
      const format = zodOutputFormat(planTurnSchema(['squat'], canAsk))

      expect(format.type).toBe('json_schema')
      expect(JSON.stringify(format.schema)).toContain('propose')
    }
  })

  it('accepts a question only while there are questions left', () => {
    const question = {
      action: 'ask',
      requirement: { channels: ['body'] },
      question: '¿Qué nivel tienes?'
    }

    expect(planTurnSchema(['squat'], true).safeParse(question).success).toBe(true)
    expect(planTurnSchema(['squat'], false).safeParse(question).success).toBe(false)
  })
})
