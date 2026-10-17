import { describe, expect, it } from 'vitest'
import type { GenerateSkillInput } from '@shared/skillGeneration'
import { parseSkillConfig } from '@shared/skill/skillLoader'
import { parseJsonAnswer } from './answer'
import type { GenerateRequest, LlmClient } from './llmClient'
import { generateSkill, readSkillText } from './skillGenerator'
import { EXAMPLE_SKILL } from './skillPrompts'

const input = (overrides: Partial<GenerateSkillInput> = {}): GenerateSkillInput => ({
  description: 'Quiero aprender la postura del perro boca abajo',
  language: 'es',
  existingSkillIds: ['squat', 'pushup', 'bicep_curl'],
  ...overrides
})

const yoga = {
  ...EXAMPLE_SKILL,
  id: 'custom_downward_dog',
  category: 'yoga',
  name: { es: 'Perro boca abajo', en: 'Downward dog' }
}

const bodyOnly = { channels: ['body'] }

const answer = (skill: unknown, requirement: unknown = bodyOnly): string =>
  JSON.stringify({ requirement, skill: typeof skill === 'string' ? skill : JSON.stringify(skill) })

// A model that answers with the texts it is given, held to the schema of the request like the real
// adapters, so that what is wrong in the skill is sent back and the repair loop really runs.
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

describe('the example in the prompt', () => {
  it('is a valid skill, so that the model is never shown a format that does not work', () => {
    expect(parseSkillConfig(EXAMPLE_SKILL).ok).toBe(true)
  })
})

describe('a skill that can be generated', () => {
  it('gives the skill, validated like those that come with the app', async () => {
    const model = scriptedModel(answer(yoga))

    const result = await generateSkill(model, input())

    expect(result).toMatchObject({ kind: 'skill', skill: { id: 'custom_downward_dog' } })
    expect(result.kind === 'skill' && result.config).toEqual(yoga)
  })

  it('reads a skill that comes wrapped in a markdown fence', async () => {
    const model = scriptedModel(answer('```json\n' + JSON.stringify(yoga) + '\n```'))

    expect((await generateSkill(model, input())).kind).toBe('skill')
  })

  it('sends only what the person wrote, and tells the model the format, the joints and the language', async () => {
    const model = scriptedModel(answer(yoga))

    await generateSkill(model, input({ language: 'en' }))

    const [request] = model.requests
    expect(request?.messages.map((m) => [m.role, m.content])).toEqual([
      ['user', 'Quiero aprender la postura del perro boca abajo']
    ])
    const system = String(request?.system)
    expect(system).toContain('in English')
    expect(system).toContain('shoulder, elbow, wrist, hip, knee, ankle, heel, footIndex')
    expect(system).toContain(
      'min, max, range, avg, first, last, abs, durationMs, descentMs, ascentMs'
    )
    expect(system).toContain('"custom_"')
    expect(request?.tier).toBe('capable')
  })
})

describe('a skill that has to be fixed', () => {
  it('sends back what is wrong with the JSON, and takes the corrected one', async () => {
    const model = scriptedModel(answer('{"id": "custom_x", '), answer(yoga))

    const result = await generateSkill(model, input())

    expect(result.kind).toBe('skill')
    expect(model.requests[1]?.messages.at(-1)?.content).toContain('The skill is not valid JSON')
  })

  it('sends back the error of the validator when a phase uses a metric that does not exist', async () => {
    const broken = {
      ...yoga,
      phases: [
        { id: 'up', when: { hip: { gt: 160 } } },
        { id: 'down', when: { knee: { lt: 110 } } }
      ]
    }
    const model = scriptedModel(answer(broken), answer(yoga))

    await generateSkill(model, input())

    expect(model.requests[1]?.messages.at(-1)?.content).toContain('uses the unknown metric "hip"')
  })

  it('refuses a rule that is not a safe expression, and says why', async () => {
    const evil = {
      ...yoga,
      rules: [
        { id: 'depth', severity: 'high', check: 'process.exit(1)', message: { es: 'x', en: 'x' } }
      ]
    }
    const model = scriptedModel(answer(evil), answer(yoga))

    await generateSkill(model, input())

    expect(model.requests[1]?.messages.at(-1)?.content).toContain('rules.0.check')
  })

  it('sends back the limits of safety when a threshold is impossible', async () => {
    const reckless = {
      ...yoga,
      phases: [
        { id: 'up', when: { knee: { gt: 400 } } },
        { id: 'down', when: { knee: { lt: 110 } } }
      ]
    }
    const model = scriptedModel(answer(reckless), answer(yoga))

    await generateSkill(model, input())

    expect(model.requests[1]?.messages.at(-1)?.content).toContain('outside what "knee" can measure')
  })

  it('asks for another id when the one it chose is in use', async () => {
    const taken = { ...yoga, id: 'squat' }
    const model = scriptedModel(answer(taken), answer(yoga))

    await generateSkill(model, input())

    expect(model.requests[1]?.messages.at(-1)?.content).toContain('"squat" is already used')
  })

  it('asks for the whole skill when it leaves it empty', async () => {
    const model = scriptedModel(answer(''), answer(yoga))

    await generateSkill(model, input())

    expect(model.requests[1]?.messages.at(-1)?.content).toContain('The skill is empty')
  })

  it('fails with a clear error when it never gets it right', async () => {
    const wrong = answer({ ...yoga, rules: [] })
    const model = scriptedModel(wrong, wrong, wrong)

    await expect(generateSkill(model, input())).rejects.toMatchObject({
      kind: 'invalid-response',
      message: 'The answer did not match the expected format.'
    })
    expect(model.requests).toHaveLength(3)
  })
})

describe('what VYRO cannot coach', () => {
  it('declines it without reading the skill, which may even be empty', async () => {
    const model = scriptedModel(answer('', { channels: [], outOfScope: ['invisible-outcome'] }))

    expect(await generateSkill(model, input())).toEqual({
      kind: 'out-of-scope',
      reasons: ['invisible-outcome', 'no-signal'],
      measurable: []
    })
    expect(model.requests).toHaveLength(1)
  })

  it('says what has not arrived yet when it needs the hands, and does not read the skill', async () => {
    const model = scriptedModel(answer('not even json', { channels: ['body', 'hands'] }))

    expect(await generateSkill(model, input())).toEqual({
      kind: 'planned',
      pending: [{ channel: 'hands', phase: 13 }],
      measurable: ['body', 'hands']
    })
  })
})

describe('readSkillText', () => {
  it('reads a valid skill', () => {
    expect(readSkillText(JSON.stringify(yoga), [])).toMatchObject({ ok: true })
  })

  it('does not accept an id that is in use', () => {
    expect(readSkillText(JSON.stringify(yoga), ['custom_downward_dog'])).toEqual({
      ok: false,
      problems: ['id: "custom_downward_dog" is already used. Pick another id.']
    })
  })
})
