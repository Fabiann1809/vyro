import type { Language } from '@shared/settings'
import { JOINT_NAMES } from '@shared/skill/joints'
import { RESERVED_NAMES } from '@shared/skill/skillSchema'
import { SCALARS, SERIES_FUNCTIONS } from '@shared/skill/expression'
import { buildSystem, type OutboundSystem } from './outbound'
import { requirementPrompt } from './requirementPrompt'

const LANGUAGE_NAME: Record<Language, string> = { es: 'Spanish', en: 'English' }

// A complete, valid skill that the model can copy the shape of. A test checks that it is valid, so
// the example cannot rot when the format changes.
export const EXAMPLE_SKILL = {
  id: 'custom_squat_example',
  category: 'exercise',
  name: { es: 'Sentadilla de ejemplo', en: 'Example squat' },
  camera: { view: 'side', fullBody: true },
  metrics: {
    knee: { type: 'angle', points: ['hip', 'knee', 'ankle'] },
    torso: { type: 'tilt', from: 'hip', to: 'shoulder' }
  },
  phases: [
    { id: 'up', when: { knee: { gt: 160 } } },
    { id: 'down', when: { knee: { lt: 110 } } }
  ],
  rep: { sequence: ['up', 'down', 'up'], minDurationMs: 800 },
  rules: [
    {
      id: 'depth',
      severity: 'high',
      check: 'min(knee) <= 100',
      message: { es: 'Baja más la cadera', en: 'Go deeper' }
    },
    {
      id: 'torso_lean',
      severity: 'medium',
      check: 'max(torso) <= 50',
      message: { es: 'Mantén el pecho más erguido', en: 'Keep your chest more upright' }
    },
    {
      id: 'descent_control',
      severity: 'low',
      check: 'descentMs >= 500',
      message: { es: 'Baja más despacio', en: 'Lower yourself more slowly' }
    }
  ]
}

// Tells the model how to write the configuration of a skill. The format is the one the app loads,
// and whatever the model writes is checked by the same code that checks the skills that come with
// the app; what is wrong is sent back so that the model can correct it.
export function skillGeneratorPrompt(language: Language): OutboundSystem {
  return buildSystem(
    [
      'You write skill configurations for VYRO, a desktop app that watches a person practise a skill with the camera and corrects their technique in real time. A configuration says what to measure on the body, when a repetition starts and ends, and which rules a good repetition follows.',
      '',
      ...requirementPrompt(),
      'Fill "requirement" in every answer. If the skill cannot be measured with the body, write an empty string in "skill": nobody will read it.',
      '',
      'The field "skill" holds the text of ONE JSON object: the whole configuration, with this format.',
      '- "id": "custom_" followed by lowercase words joined by underscores (letters, digits and underscores only). "category": one lowercase word such as "exercise", "stretch", "yoga" or "posture". "name": {"es": ..., "en": ...}.',
      '- "camera": {"view": "side" or "front", "fullBody": true or false}. Use "side" when the movement shows from the side (most do), "front" for symmetry. "fullBody" is true when the legs matter.',
      `- "metrics": an object whose keys are the metric names (lowercase first letter, letters and digits only, not one of: ${RESERVED_NAMES.join(', ')}). Every metric is one of: {"type": "angle", "points": [a, b, c]} (the angle at the middle joint b); {"type": "tilt", "from": a, "to": b} (the angle of the segment from a to b with the vertical: 0 is straight up, 90 is level); {"type": "offset", "from": a, "to": b, "axis": "x" or "y", "scale": [c, d]} (the distance from a to b along one axis, divided by the length of c to d, so it does not depend on how far the person stands). The joints are: ${JOINT_NAMES.join(', ')}; they mean the side of the body the camera sees. Use 2 to 5 metrics.`,
      '- "phases": at least two, each {"id": ..., "when": {metricName: {"gt": number, "lt": number}}} where every condition must hold together ("gt" is greater than, "lt" is less than; use one or both). Leave a gap between the thresholds of the phases so that the phase does not flicker (for example standing: knee greater than 160; down: knee less than 110).',
      '- "rep": {"sequence": [phase ids], "minDurationMs": number}. A repetition goes through the phases of the sequence in order, starting and ending in the same phase (for example ["up", "down", "up"]), with at least three steps. minDurationMs is usually between 600 and 1500.',
      `- "rules": 2 to 5 rules, each {"id": ..., "severity": "high", "medium" or "low", "check": expression, "message": {"es": ..., "en": ...}}. The check is judged at the end of each repetition over all the frames of it, with: ${SERIES_FUNCTIONS.join(', ')} of a metric (min(knee), max(torso), range(torso), avg(knee), first(knee), last(knee)); abs(...); the times ${SCALARS.join(', ')} (in milliseconds); numbers, the comparisons < <= > >= == !=, the logic && || ! and the arithmetic + - * /. The check must be TRUE for a good repetition. Include at least one rule with severity "high": the main thing for safety, or for a repetition to count as valid. The messages are short instructions in a close tone, in both languages.`,
      '',
      'Be conservative: forgiving thresholds that a beginner can reach, never pushing a joint to the end of its range. A person must be able to do the skill well and see no correction.',
      `Write the names and messages in ${LANGUAGE_NAME[language]} and in the other language of the pair, as the format asks.`,
      '',
      'A complete example of the text that goes in "skill":',
      JSON.stringify(EXAMPLE_SKILL),
      '',
      'Never give medical advice. Answer with a single JSON object that follows the schema you are given.'
    ].join('\n')
  )
}
