import { z } from 'zod'
import {
  assessFeasibility,
  dropHeardInstruments,
  skillRequirementSchema,
  type Channel
} from '@shared/feasibility'
import type { GenerateSkillInput, GenerateSkillResult } from '@shared/skillGeneration'
import { generatedSkillProblems, guitarLessonProblems } from '@shared/skill/generatedSafety'
import { skillChannels } from '@shared/skill/skillChannels'
import { parseSkillConfig } from '@shared/skill/skillLoader'
import type { SkillConfig } from '@shared/skill/skillSchema'
import type { LlmClient } from './llmClient'
import { buildMessages, textTurn } from './outbound'
import { generateWithRepair } from './repair'
import { skillGeneratorPrompt } from './skillPrompts'

const SKILL_MAX_TOKENS = 4000

// The text that the model writes comes in a field, as JSON inside JSON: the metrics of a skill are
// keyed by names that the model chooses, which a fixed schema for the answer cannot describe.
const answerSchema = z.object({ requirement: skillRequirementSchema, skill: z.string() }).strict()

// Open models like to wrap what they write in a markdown fence.
function withoutFence(text: string): string {
  const match = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(text.trim())
  return match?.[1] ?? text.trim()
}

export type SkillText =
  | { ok: true; skill: SkillConfig; config: Record<string, unknown> }
  | { ok: false; problems: string[] }

// Reads the skill that the model wrote, with the same checks as the skills that come with the app
// (shape, safe expressions, metrics that exist) and with an id that is not in use. Each problem is a
// sentence that the model can act on.
export function readSkillText(
  text: string,
  usedIds: readonly string[],
  // The channels the coach said the skill needs: it may not measure with any other.
  declared?: readonly Channel[],
  // The objects the coach said the skill needs: it may look at no other.
  declaredObjects?: readonly string[]
): SkillText {
  const source = withoutFence(text)
  if (source === '') return { ok: false, problems: ['The skill is empty: write the whole JSON.'] }

  let config: unknown
  try {
    config = JSON.parse(source)
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'it cannot be read'
    return { ok: false, problems: [`The skill is not valid JSON (${reason}).`] }
  }

  const parsed = parseSkillConfig(config)
  if (!parsed.ok) return { ok: false, problems: parsed.errors }
  if (usedIds.includes(parsed.skill.id)) {
    return {
      ok: false,
      problems: [`id: "${parsed.skill.id}" is already used. Pick another id.`]
    }
  }
  const unsafe = [...generatedSkillProblems(parsed.skill), ...guitarLessonProblems(parsed.skill)]
  if (unsafe.length > 0) return { ok: false, problems: unsafe }
  const undeclared = declared
    ? skillChannels(parsed.skill).filter((channel) => !declared.includes(channel))
    : []
  if (undeclared.length > 0) {
    return {
      ok: false,
      problems: [
        `metrics: they use the ${undeclared.join(' and ')} but "requirement.channels" does not list it. List every channel the metrics use.`
      ]
    }
  }
  const object = parsed.skill.object
  if (object && declaredObjects && !declaredObjects.includes(object)) {
    return {
      ok: false,
      problems: [
        `object: "${object}" is not listed in "requirement.objects". List every object the skill looks at.`
      ]
    }
  }
  return { ok: true, skill: parsed.skill, config: config as Record<string, unknown> }
}

export type SkillGeneration =
  | { kind: 'skill'; skill: SkillConfig; config: Record<string, unknown> }
  | Exclude<GenerateSkillResult, { kind: 'skill' }>

// Asks the coach for the configuration of a skill. First the app decides, with the rule of the
// scope, whether this is something VYRO can coach with what it measures today; only then is the
// skill read, and anything wrong in it goes back to the coach to be fixed.
export async function generateSkill(
  llm: LlmClient,
  input: GenerateSkillInput
): Promise<SkillGeneration> {
  const schema = answerSchema.superRefine((value, context) => {
    if (assessFeasibility(value.requirement).verdict !== 'supported') return
    const requirement = dropHeardInstruments(value.requirement)
    const read = readSkillText(
      value.skill,
      input.existingSkillIds,
      requirement.channels,
      requirement.objects
    )
    if (!read.ok) {
      for (const message of read.problems) {
        context.addIssue({ code: 'custom', path: ['skill'], message })
      }
    }
  })

  const answer = await generateWithRepair(llm, {
    system: skillGeneratorPrompt(input.language),
    messages: buildMessages([textTurn('user', input.description)]),
    schema,
    tier: 'capable',
    maxTokens: SKILL_MAX_TOKENS
  })

  const feasibility = assessFeasibility(answer.requirement)
  if (feasibility.verdict === 'out-of-scope') {
    return {
      kind: 'out-of-scope',
      reasons: feasibility.reasons,
      measurable: feasibility.measurable
    }
  }
  if (feasibility.verdict === 'planned') {
    return {
      kind: 'planned',
      pending: feasibility.channels
        .filter((assessment) => assessment.status === 'planned')
        .map(({ channel, phase }) => ({ channel, phase })),
      measurable: feasibility.measurable
    }
  }

  // It was read once already inside the schema; reading it again gives the skill itself.
  const requirement = dropHeardInstruments(answer.requirement)
  const read = readSkillText(
    answer.skill,
    input.existingSkillIds,
    requirement.channels,
    requirement.objects
  )
  if (!read.ok) throw new Error('A skill that was already checked cannot be read.')
  return { kind: 'skill', skill: read.skill, config: read.config }
}
