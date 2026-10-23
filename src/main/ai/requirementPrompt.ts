import { FLAGGABLE_REASONS, OBJECT_REGISTRY } from '@shared/feasibility'

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

// The lines that explain to a model what VYRO can measure and how to describe what a skill needs.
// The decision about what VYRO can coach is NOT the model's: it only describes the skill, and the
// app applies the rule to that description.
export function requirementPrompt(): string[] {
  const objects = Object.keys(OBJECT_REGISTRY).join(', ')
  const reasons = FLAGGABLE_REASONS.map((reason) => `  - "${reason}": ${REASON_HELP[reason]}`).join(
    '\n'
  )

  return [
    'VYRO can only coach what it can MEASURE. Describe what the skill needs in "requirement":',
    '- "channels": the signals that would measure whether the person does it well. "body" is posture and movement of the body; "hands" is the shape and movement of the fingers; "audio" is pitch, rhythm and volume; "object" is the position of a specific object. Use an empty list if nothing could measure it.',
    '- "channels" lists ONLY the signals that really measure this goal, never all four by default. If the result of the skill is heard (an instrument, the voice, a rhythm), measure it with "audio": the pitch, the pace and the volume say how well it is played. An instrument is an "object" only when where it is or how it is held is what must be measured; otherwise it is not an object, even if VYRO has no detector for it (a flute, a violin or a saxophone is measured by its sound, not listed as an object). Do not add "body" or "hands" to a sound skill just because a person plays it: add them only if the posture or the shape of the fingers is what would be corrected.',
    `- "objects": the objects needed when "object" is a channel. VYRO has detectors for: ${objects}. Name any other object that is needed as well, so that the app can tell it is not supported.`,
    '- "outOfScope": the reasons the skill cannot be coached whatever the channels, if any apply:',
    reasons,
    'Judge the goal as the person stated it: for "learn to draw" the stroke is too fine, so say "too-fine-detail" (and the "hands" and "body" channels that could measure the grip and the posture).'
  ]
}
