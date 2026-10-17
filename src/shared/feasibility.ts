import { z } from 'zod'

// Can VYRO coach this skill? The rule (D14): only if its success leaves a signal that the camera or
// the microphone can measure. This module decides it from a description of what the skill needs,
// without asking any model and without touching the database.

export type Channel = 'body' | 'hands' | 'audio' | 'object'

// In the order they are shown and listed.
export const CHANNELS: readonly Channel[] = ['body', 'hands', 'audio', 'object']

// Why a skill cannot be coached whatever channels exist (the list of the scope in the spec).
export type OutOfScopeReason =
  // The result cannot be seen or heard: meditation, chess, maths.
  | 'invisible-outcome'
  // Too fine for a webcam: calligraphy, embroidery, the quality of a stroke.
  | 'too-fine-detail'
  // The movement leaves the frame: running outdoors, swimming, team sports.
  | 'out-of-frame'
  // It is done by touch: massage, cooking, soldering.
  | 'needs-touch'
  // There is a physical or clinical risk: diagnosis, rehabilitation, nutrition.
  | 'physical-risk'
  // None of the channels measures it.
  | 'no-signal'
  // It needs an object that has no trained detector.
  | 'unsupported-object'

export const FLAGGABLE_REASONS = [
  'invisible-outcome',
  'too-fine-detail',
  'out-of-frame',
  'needs-touch',
  'physical-risk'
] as const

// What the classifier (a model, or a person) says a skill needs.
export const skillRequirementSchema = z
  .object({
    // The signals that would measure its success.
    channels: z.array(z.enum(['body', 'hands', 'audio', 'object'])).max(4),
    // Which objects, when the object channel is needed (for example "dumbbell", "guitar").
    objects: z.array(z.string().trim().toLowerCase().min(1).max(40)).max(5).default([]),
    // Reasons it is out of scope, if any apply.
    outOfScope: z.array(z.enum(FLAGGABLE_REASONS)).max(FLAGGABLE_REASONS.length).default([])
  })
  .strict()

export type SkillRequirement = z.input<typeof skillRequirementSchema>

// Where a channel or an object stands. `phase` is the phase of the spec that brings it.
export interface Availability {
  status: 'supported' | 'planned'
  phase: number | null
}

export type ChannelRegistry = Record<Channel, Availability>
export type ObjectRegistry = Record<string, Availability>

// What works today. When a phase ships, its entry changes from planned to supported: nothing else
// in the app has to change.
export const CHANNEL_REGISTRY: ChannelRegistry = {
  body: { status: 'supported', phase: null },
  hands: { status: 'supported', phase: null },
  audio: { status: 'supported', phase: null },
  object: { status: 'planned', phase: 15 }
}

// The objects that have (or will have) a trained detector.
export const OBJECT_REGISTRY: ObjectRegistry = {
  dumbbell: { status: 'planned', phase: 15 },
  guitar: { status: 'planned', phase: 15 }
}

export type ChannelStatus = 'supported' | 'planned' | 'out-of-scope'

export interface ChannelAssessment {
  channel: Channel
  status: ChannelStatus
  // The phase that brings it, when it is planned.
  phase: number | null
  // Only for the object channel: the named objects that have no detector.
  unsupportedObjects: string[]
}

export interface Feasibility {
  verdict: ChannelStatus
  // One entry per channel the skill needs, in the usual order.
  channels: ChannelAssessment[]
  reasons: OutOfScopeReason[]
  // The channels that are or will be available, to suggest the part that can be measured when the
  // skill as asked cannot be coached.
  measurable: Channel[]
}

function assessChannel(
  channel: Channel,
  objects: readonly string[],
  channelRegistry: ChannelRegistry,
  objectRegistry: ObjectRegistry
): ChannelAssessment {
  const base = channelRegistry[channel]
  if (channel !== 'object') {
    return { channel, status: base.status, phase: base.phase, unsupportedObjects: [] }
  }

  // The object channel is only as ready as the objects it was asked for. Without a named object
  // there is nothing to detect, which is the same as an object nobody can detect.
  if (objects.length === 0) {
    return { channel, status: 'out-of-scope', phase: null, unsupportedObjects: [] }
  }
  const unsupportedObjects = objects.filter((name) => !(name in objectRegistry))
  if (unsupportedObjects.length > 0) {
    return { channel, status: 'out-of-scope', phase: null, unsupportedObjects }
  }

  const parts = [base, ...objects.map((name) => objectRegistry[name] as Availability)]
  const planned = parts.filter((part) => part.status === 'planned')
  if (planned.length === 0)
    return { channel, status: 'supported', phase: null, unsupportedObjects: [] }

  const phases = planned.flatMap((part) => (part.phase === null ? [] : [part.phase]))
  return {
    channel,
    status: 'planned',
    phase: phases.length > 0 ? Math.max(...phases) : null,
    unsupportedObjects: []
  }
}

export function assessFeasibility(
  requirement: SkillRequirement,
  channelRegistry: ChannelRegistry = CHANNEL_REGISTRY,
  objectRegistry: ObjectRegistry = OBJECT_REGISTRY
): Feasibility {
  const parsed = skillRequirementSchema.parse(requirement)
  const needed = CHANNELS.filter((channel) => parsed.channels.includes(channel))
  const channels = needed.map((channel) =>
    assessChannel(channel, parsed.objects, channelRegistry, objectRegistry)
  )
  const measurable = channels
    .filter((assessment) => assessment.status !== 'out-of-scope')
    .map((assessment) => assessment.channel)

  const reasons: OutOfScopeReason[] = [...parsed.outOfScope]
  if (channels.length === 0) reasons.push('no-signal')
  if (channels.some((assessment) => assessment.status === 'out-of-scope')) {
    reasons.push('unsupported-object')
  }
  if (reasons.length > 0) return { verdict: 'out-of-scope', channels, reasons, measurable }

  const verdict = channels.some((assessment) => assessment.status === 'planned')
    ? 'planned'
    : 'supported'
  return { verdict, channels, reasons: [], measurable }
}
