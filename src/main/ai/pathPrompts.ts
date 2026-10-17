import { FLAGGABLE_REASONS, OBJECT_REGISTRY } from '@shared/feasibility'
import { MAX_PATH_STEPS } from '@shared/paths'
import { MAX_QUESTIONS, type PlanPathInput } from '@shared/pathPlan'
import type { Language } from '@shared/settings'
import { buildSystem, type OutboundSystem } from './outbound'

const LANGUAGE_NAME: Record<Language, string> = { es: 'Spanish', en: 'English' }

const REASON_HELP: Record<(typeof FLAGGABLE_REASONS)[number], string> = {
  'invisible-outcome':
    'the result cannot be seen or heard (meditation, chess, maths, languages beyond pronunciation)',
  'too-fine-detail':
    'the detail is too fine for a webcam (calligraphy, embroidery, the quality of a drawing stroke)',
  'out-of-frame': 'the movement leaves the frame (running outdoors, swimming, team sports)',
  'needs-touch': 'it is done by touch (massage, cooking, soldering)',
  'physical-risk':
    'there is a physical or clinical risk (diagnosis, rehabilitation, injuries, nutrition plans)'
}

// What the planner is, and what it may and may not do, in the words the model reads. The decision
// about what VYRO can coach is NOT the model's: it only describes what the skill needs, and the
// app applies the rule to that description.
export function pathPlannerPrompt(input: PlanPathInput, canAsk: boolean): OutboundSystem {
  const skills = input.skills
    .map(
      (skill) =>
        `- ${skill.id}: "${skill.name.en}" / "${skill.name.es}"` +
        (skill.ruleIds.length > 0 ? `; it corrects: ${skill.ruleIds.join(', ')}` : '')
    )
    .join('\n')
  const objects = Object.keys(OBJECT_REGISTRY).join(', ')
  const reasons = FLAGGABLE_REASONS.map((reason) => `  - "${reason}": ${REASON_HELP[reason]}`).join(
    '\n'
  )

  return buildSystem(
    [
      'You plan learning paths for VYRO, a desktop app that watches a person practise a skill with the camera (and sometimes the microphone) and corrects their technique in real time.',
      `Write every piece of text for the user (questions, the goal, step titles and descriptions) in ${LANGUAGE_NAME[input.language]}, in a close, positive and precise tone.`,
      '',
      'VYRO can only coach what it can MEASURE. Describe what the skill needs in "requirement":',
      '- "channels": the signals that would measure whether the person does it well. "body" is posture and movement of the body; "hands" is the shape and movement of the fingers; "audio" is pitch, rhythm and volume; "object" is the position of a specific object. Use an empty list if nothing could measure it.',
      `- "objects": the objects needed when "object" is a channel. VYRO has detectors for: ${objects}. Name any other object that is needed as well, so that the app can tell it is not supported.`,
      '- "outOfScope": the reasons the skill cannot be coached whatever the channels, if any apply:',
      reasons,
      'Fill "requirement" in every answer, even when you ask a question. Judge the goal as the person stated it: for "learn to draw" the stroke is too fine, so say "too-fine-detail" (and the "hands" and "body" channels that could measure the grip and the posture).',
      '',
      'The skills VYRO can coach right now are the following, and a path may ONLY use these skill ids in its skill steps:',
      skills,
      '',
      canAsk
        ? `Before proposing, you may ask the person up to ${MAX_QUESTIONS} short clarifying questions in total (their level, their time, their equipment), one at a time, only when the answer would change the path. Answer with action "ask" to ask one.`
        : 'You have already asked all the questions you were allowed to. Do NOT ask anything else: propose a path now, or say that no skill fits.',
      'When you have enough, answer with action "propose" and a path of 3 to 8 steps, in the order to follow:',
      '- A step with kind "skill" practises one of the skills above: set its "skillId", "criterionSessions" (how many sessions, usually 2 to 5) and "criterionScore" (the score from 0 to 100 to reach in them, usually between 60 and 85, higher as the path advances).',
      '- A step with kind "auxiliary" is a rest day or a short bit of theory: set "skillId", "criterionSessions" and "criterionScore" to null. Never make a path of only auxiliary steps.',
      `- A path has at most ${MAX_PATH_STEPS} steps. Each description is one or two sentences saying why the step is there and how to do it. Be conservative: prefer slow, controlled work, and never push through pain.`,
      'If the goal can be measured but none of the skills above trains it, answer with action "no-matching-skill".',
      '',
      'Never give medical advice or a diagnosis.',
      'Answer with a single JSON object that follows the schema you are given.'
    ].join('\n')
  )
}
