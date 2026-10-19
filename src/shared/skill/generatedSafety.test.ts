import { describe, expect, it } from 'vitest'
import { generatedSkillProblems, guitarLessonProblems, isGeneratedSkillId } from './generatedSafety'
import { parseSkillConfig } from './skillLoader'
import type { SkillConfig } from './skillSchema'

const base = {
  id: 'custom_squat',
  category: 'exercise',
  name: { es: 'Sentadilla', en: 'Squat' },
  camera: { view: 'side', fullBody: true },
  metrics: { knee: { type: 'angle', points: ['hip', 'knee', 'ankle'] } },
  phases: [
    { id: 'up', when: { knee: { gt: 160 } } },
    { id: 'down', when: { knee: { lt: 110 } } }
  ],
  rep: { sequence: ['up', 'down', 'up'], minDurationMs: 800 },
  rules: [
    { id: 'depth', severity: 'high', check: 'min(knee) <= 100', message: { es: 'a', en: 'a' } }
  ]
}

function skill(changes: Record<string, unknown> = {}): SkillConfig {
  const parsed = parseSkillConfig({ ...base, ...changes })
  if (!parsed.ok) throw new Error(parsed.errors.join(', '))
  return parsed.skill
}

describe('generatedSkillProblems', () => {
  it('accepts a reasonable skill', () => {
    expect(generatedSkillProblems(skill())).toEqual([])
  })

  it('rejects an id without the custom_ prefix', () => {
    expect(generatedSkillProblems(skill({ id: 'squat' }))).toEqual([
      'id: "squat" must start with "custom_"'
    ])
  })

  it('rejects a skill without a rule of high severity', () => {
    const rules = [{ ...base.rules[0], severity: 'medium' }]
    expect(generatedSkillProblems(skill({ rules }))[0]).toContain('severity "high"')
  })

  it('rejects an angle threshold outside 0 to 180 degrees', () => {
    const phases = [
      { id: 'up', when: { knee: { gt: 400 } } },
      { id: 'down', when: { knee: { lt: 110 } } }
    ]
    expect(generatedSkillProblems(skill({ phases }))).toEqual([
      'phases.0.when.knee: 400 is outside what "knee" can measure (0 to 180)'
    ])
  })

  it('rejects a phase that can never happen', () => {
    const phases = [
      { id: 'up', when: { knee: { gt: 150, lt: 100 } } },
      { id: 'down', when: { knee: { lt: 110 } } }
    ]
    expect(generatedSkillProblems(skill({ phases }))[0]).toContain('can never happen')
  })

  it('rejects a repetition that is too fast or too slow', () => {
    for (const minDurationMs of [50, 60_000]) {
      const rep = { ...base.rep, minDurationMs }
      expect(generatedSkillProblems(skill({ rep }))[0]).toContain('rep.minDurationMs')
    }
  })

  it('accepts a skill that looks at hands', () => {
    const hands = skill({
      metrics: { curl: { type: 'angle', points: ['indexMcp', 'indexPip', 'indexDip'] } },
      phases: [
        { id: 'open', when: { curl: { gt: 160 } } },
        { id: 'closed', when: { curl: { lt: 110 } } }
      ],
      rep: { sequence: ['open', 'closed', 'open'], minDurationMs: 800 },
      rules: [
        { id: 'curl', severity: 'high', check: 'min(curl) <= 100', message: { es: 'a', en: 'a' } }
      ]
    })

    expect(generatedSkillProblems(hands)).toEqual([])
  })

  it('accepts a skill that listens, when its numbers are plausible', () => {
    const listening = skill({
      metrics: { cents: { type: 'pitch', target: 'nearest' } },
      phases: [
        { id: 'sharp', when: { cents: { gt: 20 } } },
        { id: 'tuned', when: { cents: { lt: 10 } } }
      ],
      rep: { sequence: ['tuned', 'sharp', 'tuned'], minDurationMs: 800 },
      rules: [
        { id: 'tuned', severity: 'high', check: 'max(cents) <= 15', message: { es: 'a', en: 'a' } }
      ]
    })

    expect(generatedSkillProblems(listening)).toEqual([])
  })

  it('knows which ids are generated', () => {
    expect(isGeneratedSkillId('custom_yoga')).toBe(true)
    expect(isGeneratedSkillId('squat')).toBe(false)
  })
})

describe('guitarLessonProblems', () => {
  const lesson = {
    id: 'custom_guitar_open_string',
    category: 'instrument',
    name: { es: 'Cuerda abierta de guitarra', en: 'Open guitar string' },
    camera: { view: 'front', fullBody: false, hand: 'auto' },
    metrics: {
      wrist: { type: 'tilt', from: 'handWrist', to: 'middleMcp' },
      level: { type: 'level' }
    },
    phases: [
      { id: 'quiet', when: { level: { lt: -42 } } },
      { id: 'ringing', when: { level: { gt: -32 } } }
    ],
    rep: { sequence: ['quiet', 'ringing', 'quiet'], minDurationMs: 300 },
    rules: [
      {
        id: 'wrist',
        severity: 'high',
        check: 'min(wrist) >= 70 && max(wrist) <= 110',
        message: { es: 'No dobles la muñeca', en: 'Do not bend the wrist' }
      }
    ]
  }

  it('accepts a lesson of the hand and the sound, filmed from the front', () => {
    expect(guitarLessonProblems(skill(lesson))).toEqual([])
  })

  it('rejects a guitar lesson that measures the body', () => {
    const withBody = {
      ...lesson,
      metrics: { ...lesson.metrics, torso: { type: 'tilt', from: 'hip', to: 'shoulder' } }
    }

    expect(guitarLessonProblems(skill(withBody)).join()).toContain('guitar_posture')
  })

  it('rejects a guitar lesson filmed from the side', () => {
    const fromTheSide = { ...lesson, camera: { view: 'side', fullBody: false, hand: 'auto' } }

    expect(guitarLessonProblems(skill(fromTheSide)).join()).toContain('"front"')
  })

  it('leaves alone the skills that are not about the guitar', () => {
    expect(guitarLessonProblems(skill())).toEqual([])
  })
})
