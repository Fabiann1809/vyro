import { afterEach, describe, expect, it } from 'vitest'
import { planObjectsForLater } from '@shared/feasibilityFixtures'
import type { GenerateSkillInput } from '@shared/skillGeneration'
import { parseSkillConfig } from '@shared/skill/skillLoader'
import { parseJsonAnswer } from './answer'
import type { GenerateRequest, LlmClient } from './llmClient'
import { generateSkill, readSkillText } from './skillGenerator'
import {
  EXAMPLE_AUDIO_SKILL,
  EXAMPLE_HAND_SKILL,
  EXAMPLE_OBJECT_SKILL,
  EXAMPLE_SKILL,
  skillGeneratorPrompt
} from './skillPrompts'

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

  it('has one for the hands too, which is valid and passes the limits of generated skills', () => {
    expect(parseSkillConfig(EXAMPLE_HAND_SKILL).ok).toBe(true)
    expect(readSkillText(JSON.stringify(EXAMPLE_HAND_SKILL), [], ['hands'])).toMatchObject({
      ok: true
    })
  })
})

describe('a skill that looks at an object', () => {
  const hold = {
    ...EXAMPLE_OBJECT_SKILL,
    id: 'custom_guitar_hold',
    name: { es: 'Sujetar la guitarra', en: 'Holding the guitar' }
  }
  const needs = { channels: ['hands', 'object'], objects: ['guitar'] }

  it('has an example that is valid and passes the limits of generated skills', () => {
    expect(parseSkillConfig(EXAMPLE_OBJECT_SKILL).ok).toBe(true)
    expect(
      readSkillText(JSON.stringify(EXAMPLE_OBJECT_SKILL), [], ['hands', 'object'], ['guitar'])
    ).toMatchObject({ ok: true })
  })

  it('is generated and validated when the coach says it needs the guitar', async () => {
    const model = scriptedModel(answer(hold, needs))

    const result = await generateSkill(
      model,
      input({ description: 'Quiero sujetar bien la guitarra' })
    )

    expect(result).toMatchObject({
      kind: 'skill',
      skill: { id: 'custom_guitar_hold', object: 'guitar' }
    })
  })

  it('is declined, not repaired, when the coach also needs an object with no detector', async () => {
    const model = scriptedModel(
      answer(hold, { channels: ['body', 'object'], objects: ['guitar', 'violin'] }),
      answer(hold, needs)
    )

    // The first answer needs a violin too, which has no detector: it is declined, not repaired.
    const result = await generateSkill(model, input())

    expect(result).toMatchObject({ kind: 'out-of-scope', reasons: ['unsupported-object'] })
    expect(model.requests).toHaveLength(1)
  })

  it('reports that the object is not listed in the requirement', () => {
    const read = readSkillText(JSON.stringify(hold), [], ['hands', 'object'], ['violin'])

    expect(read).toMatchObject({ ok: false })
    expect(!read.ok && read.problems.join()).toContain('"requirement.objects"')
  })

  it('sends back a guitar lesson that measures the body, or is filmed from the side', () => {
    const body = {
      ...hold,
      camera: { view: 'side', fullBody: false, hand: 'auto' },
      metrics: {
        ...hold.metrics,
        torso: { type: 'tilt', from: 'hip', to: 'shoulder' }
      }
    }

    const read = readSkillText(JSON.stringify(body), [], ['body', 'hands', 'object'], ['guitar'])

    expect(read).toMatchObject({ ok: false })
    expect(!read.ok && read.problems.join()).toContain('guitar_posture')
    expect(!read.ok && read.problems.join()).toContain('"front"')
  })

  it('declines an object that has no detector, such as a dumbbell', async () => {
    const model = scriptedModel(answer('', { channels: ['body', 'object'], objects: ['dumbbell'] }))

    expect(await generateSkill(model, input())).toMatchObject({
      kind: 'out-of-scope',
      reasons: ['unsupported-object']
    })
  })
})

describe('a skill that listens', () => {
  const tuner = {
    ...EXAMPLE_AUDIO_SKILL,
    id: 'custom_low_a',
    name: { es: 'La grave', en: 'Low A' }
  }

  it('has an example that is valid and passes the limits of generated skills', () => {
    expect(parseSkillConfig(EXAMPLE_AUDIO_SKILL).ok).toBe(true)
    expect(readSkillText(JSON.stringify(EXAMPLE_AUDIO_SKILL), [], ['audio'])).toMatchObject({
      ok: true
    })
  })

  it('is generated and validated when the coach says it needs the sound', async () => {
    const model = scriptedModel(answer(tuner, { channels: ['audio'] }))

    const result = await generateSkill(model, input({ description: 'Quiero afinar mi guitarra' }))

    expect(result).toMatchObject({ kind: 'skill', skill: { id: 'custom_low_a' } })
    expect(result.kind === 'skill' && result.skill.camera).toBeUndefined()
  })

  it('is generated when the coach lists the instrument it hears as an object too', async () => {
    const model = scriptedModel(
      answer(tuner, { channels: ['audio', 'object'], objects: ['flute'] })
    )

    const result = await generateSkill(model, input({ description: 'Quiero tocar flauta' }))

    expect(result).toMatchObject({ kind: 'skill', skill: { id: 'custom_low_a' } })
    expect(model.requests).toHaveLength(1)
  })

  describe('and says how its progress is measured', () => {
    const sustained = {
      ...tuner,
      id: 'custom_long_note',
      rep: { ...tuner.rep, holdMs: 4000 },
      progress: { unit: 'holds', measures: ['timeWell', 'bestStreak', 'vsPrevious'] }
    }

    it('keeps the unit and the measures of a sustained note', async () => {
      const model = scriptedModel(answer(sustained, { channels: ['audio'] }))

      const result = await generateSkill(model, input({ description: 'Quiero tocar flauta' }))

      expect(result.kind === 'skill' && result.skill.progress).toEqual({
        unit: 'holds',
        measures: ['timeWell', 'bestStreak', 'vsPrevious']
      })
    })

    it('is asked to be fixed when it measures the time done well without holding', async () => {
      const loose = { ...sustained, rep: tuner.rep }
      const model = scriptedModel(
        answer(loose, { channels: ['audio'] }),
        answer(sustained, { channels: ['audio'] })
      )

      const result = await generateSkill(model, input())

      expect(result.kind).toBe('skill')
      expect(model.requests[1]?.messages.at(-1)?.content).toContain('rep.holdMs')
    })

    it('is asked to be fixed when the hold is too short to be real', async () => {
      const blink = { ...sustained, rep: { ...tuner.rep, holdMs: 100 } }
      const model = scriptedModel(
        answer(blink, { channels: ['audio'] }),
        answer(sustained, { channels: ['audio'] })
      )

      const result = await generateSkill(model, input())

      expect(result.kind).toBe('skill')
      expect(model.requests[1]?.messages.at(-1)?.content).toContain('rep.holdMs: must be between')
    })

    it('tells the coach about the unit, the measures and the hold in its instructions', () => {
      const prompt: string = skillGeneratorPrompt('es')

      expect(prompt).toContain('"progress"')
      expect(prompt).toContain('"timeWell"')
      expect(prompt).toContain('"holdMs"')
    })
  })

  describe('and says what to do', () => {
    it('keeps the line that tells the person what to do', async () => {
      const goal = { es: 'Toca la nota y déjala sonar.', en: 'Play the note and let it ring.' }
      const model = scriptedModel(answer({ ...tuner, goal }, { channels: ['audio'] }))

      const result = await generateSkill(model, input({ description: 'Quiero tocar flauta' }))

      expect(result.kind === 'skill' && result.skill.goal).toEqual(goal)
    })

    it('is asked to be fixed when the line is not in both languages', async () => {
      const model = scriptedModel(
        answer({ ...tuner, goal: { es: 'Toca la nota.' } }, { channels: ['audio'] }),
        answer(tuner, { channels: ['audio'] })
      )

      const result = await generateSkill(model, input())

      expect(result.kind).toBe('skill')
      expect(model.requests[1]?.messages.at(-1)?.content).toContain('goal.en')
    })

    it('tells the coach to write it', () => {
      expect(skillGeneratorPrompt('es')).toContain('"goal"')
    })
  })

  describe('and says how it is displayed', () => {
    it('keeps a tuner for a skill that hears a pitch', async () => {
      const model = scriptedModel(answer({ ...tuner, display: 'tuner' }, { channels: ['audio'] }))

      const result = await generateSkill(model, input({ description: 'Quiero afinar mi guitarra' }))

      expect(result.kind === 'skill' && result.skill.display).toBe('tuner')
    })

    it('is asked to be fixed when it shows a hold without holding', async () => {
      const model = scriptedModel(
        answer({ ...tuner, display: 'hold' }, { channels: ['audio'] }),
        answer(tuner, { channels: ['audio'] })
      )

      const result = await generateSkill(model, input())

      expect(result.kind).toBe('skill')
      expect(model.requests[1]?.messages.at(-1)?.content).toContain('rep.holdMs')
    })

    it('tells the coach the displays it can name', () => {
      const prompt: string = skillGeneratorPrompt('es')

      expect(prompt).toContain('"display"')
      expect(prompt).toContain('target-note')
    })
  })

  describe('and asks to hear an instrument', () => {
    const flute = {
      ...tuner,
      id: 'custom_flute_note',
      metrics: { ...tuner.metrics, flute: { type: 'instrument', name: 'flute' } },
      rules: [
        ...tuner.rules,
        {
          id: 'not_flute',
          severity: 'high',
          check: 'avg(flute) >= 0.5',
          message: { es: 'No oigo una flauta', en: 'I do not hear a flute' }
        }
      ]
    }

    it('keeps the instrument it names, and listens without a camera', async () => {
      const model = scriptedModel(answer(flute, { channels: ['audio'] }))

      const result = await generateSkill(model, input({ description: 'Quiero tocar flauta' }))

      expect(result.kind === 'skill' && result.skill.metrics['flute']).toEqual({
        type: 'instrument',
        name: 'flute'
      })
      expect(result.kind === 'skill' && result.skill.camera).toBeUndefined()
    })

    it('is asked to be fixed when it names an instrument that is not in the list', async () => {
      const kazoo = {
        ...flute,
        metrics: { ...flute.metrics, flute: { type: 'instrument', name: 'kazoo' } }
      }
      const model = scriptedModel(
        answer(kazoo, { channels: ['audio'] }),
        answer(flute, { channels: ['audio'] })
      )

      const result = await generateSkill(model, input())

      expect(result.kind).toBe('skill')
      const repair = model.requests[1]?.messages.at(-1)?.content ?? ''
      expect(repair).toContain('metrics.flute.name')
      expect(repair).toContain('"voice"')
    })

    it('tells the coach which instruments it can name', () => {
      const prompt: string = skillGeneratorPrompt('es')

      expect(prompt).toContain('"type": "instrument"')
      for (const name of ['flute', 'guitar', 'piano', 'voice']) expect(prompt).toContain(name)
    })
  })

  it('is asked to be fixed when it listens but the coach did not say so', async () => {
    const model = scriptedModel(answer(tuner, bodyOnly), answer(tuner, { channels: ['audio'] }))

    const result = await generateSkill(model, input())

    expect(result.kind).toBe('skill')
    const repair = model.requests[1]?.messages.at(-1)?.content ?? ''
    expect(repair).toContain('"requirement.channels" does not list it')
  })

  it('is asked to be fixed when a note is not a note', async () => {
    const wrong = {
      ...tuner,
      metrics: { ...tuner.metrics, cents: { type: 'pitch', target: 'Z9' } }
    }
    const model = scriptedModel(
      answer(wrong, { channels: ['audio'] }),
      answer(tuner, { channels: ['audio'] })
    )

    const result = await generateSkill(model, input())

    expect(result.kind).toBe('skill')
    expect(model.requests[1]?.messages.at(-1)?.content).toContain('must be a note')
  })

  it('is rejected when its thresholds cannot happen', async () => {
    const impossible = {
      ...tuner,
      phases: [
        { id: 'quiet', when: { level: { lt: -42 } } },
        { id: 'ringing', when: { level: { gt: 20 } } }
      ]
    }
    const model = scriptedModel(
      answer(impossible, { channels: ['audio'] }),
      answer(tuner, { channels: ['audio'] })
    )

    await generateSkill(model, input())

    expect(model.requests[1]?.messages.at(-1)?.content).toContain(
      'outside what "level" can measure'
    )
  })

  it('shows the model the sound metrics and the example', async () => {
    const model = scriptedModel(answer(tuner, { channels: ['audio'] }))

    await generateSkill(model, input())

    const system = String(model.requests[0]?.system)
    expect(system).toContain('"type": "pitch"')
    expect(system).toContain('"type": "tempo"')
    expect(system).toContain('custom_open_string_example')
  })
})

describe('a skill of the hands', () => {
  const piano = {
    ...EXAMPLE_HAND_SKILL,
    id: 'custom_finger_arch',
    name: { es: 'Arco del dedo', en: 'Finger arch' }
  }

  it('is generated and validated when the coach says it needs the hands', async () => {
    const model = scriptedModel(answer(piano, { channels: ['hands'] }))

    const result = await generateSkill(model, input({ description: 'Quiero tocar el piano' }))

    expect(result).toMatchObject({ kind: 'skill', skill: { id: 'custom_finger_arch' } })
  })

  it('is asked to be fixed when it measures with a channel it did not declare', async () => {
    const model = scriptedModel(answer(piano, bodyOnly), answer(piano, { channels: ['hands'] }))

    const result = await generateSkill(model, input())

    expect(result.kind).toBe('skill')
    expect(model.requests).toHaveLength(2)
    const repair = model.requests[1]?.messages.at(-1)?.content ?? ''
    expect(repair).toContain('"requirement.channels" does not list it')
  })

  it('is rejected, with the problem named, when what it is told is wrong for a hand joint', async () => {
    const wrong = {
      ...piano,
      metrics: { curve: { type: 'angle', points: ['indexMcp', 'knee', 'indexDip'] } }
    }
    const model = scriptedModel(
      answer(wrong, { channels: ['hands', 'body'] }),
      answer(wrong, { channels: ['hands', 'body'] }),
      answer(wrong, { channels: ['hands', 'body'] })
    )

    await expect(generateSkill(model, input())).rejects.toMatchObject({ kind: 'invalid-response' })
  })

  it('shows the model the hand joints and the hand example', async () => {
    const model = scriptedModel(answer(piano, { channels: ['hands'] }))

    await generateSkill(model, input())

    const system = String(model.requests[0]?.system)
    expect(system).toContain('indexPip')
    expect(system).toContain('"gap"')
    expect(system).toContain('custom_finger_lift_example')
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

let restore: (() => void) | undefined
afterEach(() => restore?.())

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

  it('says what has not arrived yet when it needs an object, and does not read the skill', async () => {
    restore = planObjectsForLater()
    const model = scriptedModel(
      answer('not even json', { channels: ['body', 'object'], objects: ['guitar'] })
    )

    expect(await generateSkill(model, input())).toEqual({
      kind: 'planned',
      pending: [{ channel: 'object', phase: 20 }],
      measurable: ['body', 'object']
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
