import { MAX_PATH_STEPS } from '@shared/paths'
import { MAX_QUESTIONS, type PlanPathInput } from '@shared/pathPlan'
import type { Language } from '@shared/settings'
import { buildSystem, type OutboundSystem } from './outbound'
import { requirementPrompt } from './requirementPrompt'

const LANGUAGE_NAME: Record<Language, string> = { es: 'Spanish', en: 'English' }

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

  return buildSystem(
    [
      'You plan learning paths for VYRO, a desktop app that watches a person practise a skill with the camera (and sometimes the microphone) and corrects their technique in real time.',
      `Write every piece of text for the user (questions, the goal, step titles and descriptions) in ${LANGUAGE_NAME[input.language]}, in a close, positive and precise tone.`,
      '',
      ...requirementPrompt(),
      'Fill "requirement" in every answer, even when you ask a question.',
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

// For the weekly review. The numbers say how the path is going; the model proposes changes and the
// app checks that they can be applied.
export function reviewPrompt(language: Language, skills: PlanPathInput['skills']): OutboundSystem {
  const skillList = skills.map((skill) => `- ${skill.id}: "${skill.name.en}"`).join('\n')

  return buildSystem(
    [
      'You review one week of a learning path in VYRO, a desktop app that watches a person practise a skill with the camera and corrects their technique.',
      'You receive the path and the numbers as JSON. "goal" is what the person wants; "daysSinceStart" is how long ago the path began; each of "steps" has an "id", its "position", a "title", its "kind" ("skill" or "auxiliary"), the "skillId" and the goal of the step ("criterionSessions" sessions with "criterionScore" points or more), its "state" ("done", "current" or "locked"), "counted" (the sessions that count so far) and "attempts" (the sessions tried); "skills" has, for each skill practised, how many sessions, the average score, the last scores (oldest first) and how many times each rule was failed ("errors", most frequent first).',
      `Write in ${LANGUAGE_NAME[language]}, in a close, positive and precise tone, with no jargon. Rule names are internal: explain them in plain words.`,
      'Answer with "summary" (two to four sentences on how the week went, using only the numbers you were given) and "adjustments" (0 to 5 changes, only when the numbers justify them; an empty list is a perfectly good answer when the path is fine).',
      'Each adjustment has a "type" and a short "reason" for the person:',
      '- "change-criteria": a different goal for a step ("stepId", "criterionSessions", "criterionScore"). Lower it if the person struggles (many attempts, few counted, scores below the goal); raise it if they pass easily.',
      '- "add-step": a new step put right after another one ("afterStepId", and a "step" like those of the path: a "skill" step needs a "skillId", "criterionSessions" and "criterionScore"; an "auxiliary" one has them set to null). Use it to practise a skill that keeps failing the same rule, or to add a rest.',
      '- "remove-step": take out a step that no longer helps ("stepId").',
      'Only steps whose state is "current" or "locked" may be changed or removed, never a "done" one, and nothing may be added before a step that is done. A path always keeps at least one skill step.',
      'The only skill ids a skill step may use are:',
      skillList,
      'Be conservative: prefer small changes, slow and controlled work, and never push through pain. Never give medical advice or a diagnosis.',
      'Answer with a single JSON object that follows the schema you are given.'
    ].join('\n')
  )
}
