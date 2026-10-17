import { describe, expect, it } from 'vitest'
import {
  assessFeasibility,
  CHANNEL_REGISTRY,
  FLAGGABLE_REASONS,
  OBJECT_REGISTRY,
  skillRequirementSchema,
  type ChannelRegistry,
  type SkillRequirement
} from './feasibility'
import { DETECTABLE_OBJECTS } from './skill/objects'

// What the registries will say when a later phase brings a new object: nothing is pending today.
const LATER: ChannelRegistry = { ...CHANNEL_REGISTRY, object: { status: 'planned', phase: 20 } }
const LATER_OBJECTS = { guitar: { status: 'planned', phase: 20 } } as const

describe('the objects with a detector', () => {
  it('are exactly the ones the skill format lets a skill name', () => {
    expect(Object.keys(OBJECT_REGISTRY)).toEqual([...DETECTABLE_OBJECTS])
  })
})

describe('a skill that can be coached today', () => {
  it('is supported when it looks at the guitar, the one object with a detector', () => {
    const result = assessFeasibility({ channels: ['body', 'object'], objects: ['guitar'] })

    expect(result.verdict).toBe('supported')
    expect(result.channels.map((c) => c.status)).toEqual(['supported', 'supported'])
  })

  it('is supported when only the body is needed', () => {
    expect(assessFeasibility({ channels: ['body'] })).toEqual({
      verdict: 'supported',
      channels: [{ channel: 'body', status: 'supported', phase: null, unsupportedObjects: [] }],
      reasons: [],
      measurable: ['body']
    })
  })
})

describe('a skill that will be coached in a later phase', () => {
  it('is planned for the phase that brings the object when a detector is on the way', () => {
    const result = assessFeasibility(
      { channels: ['body', 'object'], objects: ['guitar'] },
      LATER,
      LATER_OBJECTS
    )

    expect(result.verdict).toBe('planned')
    expect(result.channels.map((c) => [c.channel, c.status, c.phase])).toEqual([
      ['body', 'supported', null],
      ['object', 'planned', 20]
    ])
  })

  it('tells apart what is ready from what is not in a skill with several channels', () => {
    const result = assessFeasibility(
      { channels: ['body', 'object'], objects: ['guitar'] },
      LATER,
      LATER_OBJECTS
    )

    expect(result.verdict).toBe('planned')
    expect(result.channels.map((c) => c.status)).toEqual(['supported', 'planned'])
  })
})

describe('a skill that needs several channels at once', () => {
  const guitar: SkillRequirement = {
    channels: ['object', 'audio', 'hands', 'body'],
    objects: ['guitar']
  }

  it('lists every channel in the usual order, whatever the order it was asked in', () => {
    const result = assessFeasibility(guitar)

    expect(result.channels.map((c) => c.channel)).toEqual(['body', 'hands', 'audio', 'object'])
    expect(result.measurable).toEqual(['body', 'hands', 'audio', 'object'])
  })

  it('is supported today: the four channels exist and the guitar has a detector', () => {
    expect(assessFeasibility(guitar).verdict).toBe('supported')
  })

  it('is planned when a channel is still to come, and each channel says which phase brings it', () => {
    const result = assessFeasibility(guitar, LATER, LATER_OBJECTS)

    expect(result.verdict).toBe('planned')
    expect(result.channels.map((c) => [c.channel, c.status, c.phase])).toEqual([
      ['body', 'supported', null],
      ['hands', 'supported', null],
      ['audio', 'supported', null],
      ['object', 'planned', 20]
    ])
  })

  it('ignores a channel named twice', () => {
    const result = assessFeasibility({ channels: ['body', 'body', 'hands'] })

    expect(result.channels.map((c) => c.channel)).toEqual(['body', 'hands'])
  })

  it('becomes supported by itself as the phases ship, without any other change', () => {
    const inPhase15: ChannelRegistry = {
      ...CHANNEL_REGISTRY,
      object: { status: 'supported', phase: null }
    }
    const readyObjects = { guitar: { status: 'supported', phase: null } } as const

    expect(assessFeasibility(guitar, inPhase15, readyObjects).verdict).toBe('supported')
    expect(assessFeasibility(guitar, LATER, LATER_OBJECTS).verdict).toBe('planned')
  })

  it('needs the object to be ready as well as the object channel', () => {
    const allReady: ChannelRegistry = {
      body: { status: 'supported', phase: null },
      hands: { status: 'supported', phase: null },
      audio: { status: 'supported', phase: null },
      object: { status: 'supported', phase: null }
    }
    const readyObjects = { guitar: { status: 'supported', phase: null } } as const

    expect(assessFeasibility(guitar, allReady, readyObjects).verdict).toBe('supported')
    expect(assessFeasibility(guitar, allReady, LATER_OBJECTS).verdict).toBe('planned')
  })
})

describe('a skill that cannot be coached', () => {
  it.each(FLAGGABLE_REASONS)('is out of scope when it is flagged as %s', (reason) => {
    const result = assessFeasibility({ channels: ['body'], outOfScope: [reason] })

    expect(result.verdict).toBe('out-of-scope')
    expect(result.reasons).toEqual([reason])
  })

  it('keeps the channels that could measure a part of it, to suggest them', () => {
    // "Learn drawing": the stroke is too fine, but posture and grip can be seen.
    const result = assessFeasibility({
      channels: ['body', 'hands'],
      outOfScope: ['too-fine-detail']
    })

    expect(result.verdict).toBe('out-of-scope')
    expect(result.measurable).toEqual(['body', 'hands'])
  })

  it('reports every reason that applies', () => {
    const result = assessFeasibility({
      channels: ['body'],
      outOfScope: ['needs-touch', 'physical-risk']
    })

    expect(result.reasons).toEqual(['needs-touch', 'physical-risk'])
  })

  it('is out of scope, for lack of a signal, when no channel measures it', () => {
    const result = assessFeasibility({ channels: [] })

    expect(result).toEqual({
      verdict: 'out-of-scope',
      channels: [],
      reasons: ['no-signal'],
      measurable: []
    })
  })

  it('is out of scope when it needs an object that has no detector', () => {
    const result = assessFeasibility({ channels: ['body', 'object'], objects: ['violin'] })

    expect(result.verdict).toBe('out-of-scope')
    expect(result.reasons).toEqual(['unsupported-object'])
    expect(result.channels.find((c) => c.channel === 'object')).toMatchObject({
      status: 'out-of-scope',
      unsupportedObjects: ['violin']
    })
    // The body can still be measured, which is what the chat can offer instead.
    expect(result.measurable).toEqual(['body'])
  })

  it('lists only the objects that have no detector', () => {
    const result = assessFeasibility({
      channels: ['object'],
      objects: ['guitar', 'violin', 'drum']
    })

    expect(result.channels[0]?.unsupportedObjects).toEqual(['violin', 'drum'])
  })

  it('is out of scope when the object channel is needed but no object is named', () => {
    const result = assessFeasibility({ channels: ['object'] })

    expect(result.verdict).toBe('out-of-scope')
    expect(result.reasons).toEqual(['unsupported-object'])
  })

  it('is out of scope when it needs a dumbbell, whose detector was left for later', () => {
    const result = assessFeasibility({ channels: ['body', 'object'], objects: ['dumbbell'] })

    expect(result.verdict).toBe('out-of-scope')
    expect(result.channels.find((c) => c.channel === 'object')?.unsupportedObjects).toEqual([
      'dumbbell'
    ])
  })

  it('reads the names of objects without caring about capitals or spaces', () => {
    const result = assessFeasibility({ channels: ['object'], objects: ['  Guitar '] })

    expect(result.verdict).toBe('supported')
  })
})

describe('skillRequirementSchema', () => {
  it('fills in what is left out', () => {
    expect(skillRequirementSchema.parse({ channels: ['body'] })).toEqual({
      channels: ['body'],
      objects: [],
      outOfScope: []
    })
  })

  it.each([
    ['a channel that does not exist', { channels: ['smell'] }],
    ['a reason that is not one of the list', { channels: ['body'], outOfScope: ['boring'] }],
    ['a field that is not listed', { channels: ['body'], danger: 'high' }],
    ['more than five objects', { channels: ['object'], objects: ['a', 'b', 'c', 'd', 'e', 'f'] }],
    ['an empty object name', { channels: ['object'], objects: [' '] }]
  ])('rejects %s', (_name, bad) => {
    expect(skillRequirementSchema.safeParse(bad).success).toBe(false)
  })
})
