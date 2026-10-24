import type { Language } from '@shared/settings'
import { DISPLAYS } from '@shared/skill/display'
import { HAND_JOINT_NAMES, JOINT_NAMES } from '@shared/skill/joints'
import { INSTRUMENTS } from '@shared/skill/instruments'
import { DETECTABLE_OBJECTS } from '@shared/skill/objects'
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
  goal: {
    es: 'Baja como si te sentaras hacia atrás y vuelve a subir.',
    en: 'Lower as if sitting back and come up again.'
  },
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

// The same for a skill of the hands, so the model sees how the hand joints and "hand" are used.
export const EXAMPLE_HAND_SKILL = {
  id: 'custom_finger_lift_example',
  category: 'instrument',
  name: {
    es: 'Elevación de dedo de ejemplo',
    en: 'Example finger lift'
  },
  camera: {
    view: 'side',
    fullBody: false,
    hand: 'auto'
  },
  metrics: {
    curve: {
      type: 'angle',
      points: ['indexMcp', 'indexPip', 'indexDip']
    },
    lift: {
      type: 'offset',
      from: 'indexMcp',
      to: 'indexTip',
      axis: 'y',
      scale: ['handWrist', 'middleMcp']
    }
  },
  phases: [
    {
      id: 'down',
      when: {
        lift: {
          gt: 0.45
        }
      }
    },
    {
      id: 'up',
      when: {
        lift: {
          lt: 0.25
        }
      }
    }
  ],
  rep: {
    sequence: ['down', 'up', 'down'],
    minDurationMs: 300
  },
  rules: [
    {
      id: 'curved',
      severity: 'high',
      check: 'max(curve) <= 168',
      message: {
        es: 'Curva más el dedo',
        en: 'Curve your finger more'
      }
    },
    {
      id: 'not_closed',
      severity: 'low',
      check: 'min(curve) >= 105',
      message: {
        es: 'No cierres tanto el dedo',
        en: 'Do not close your finger so much'
      }
    }
  ]
}

// The same for a skill that listens: it has no camera, and it judges the pitch of a note.
export const EXAMPLE_AUDIO_SKILL = {
  id: 'custom_open_string_example',
  category: 'instrument',
  name: {
    es: 'Cuerda al aire de ejemplo',
    en: 'Example open string'
  },
  goal: {
    es: 'Toca la cuerda al aire y deja que suene hasta el final.',
    en: 'Pluck the open string and let it ring until it dies away.'
  },
  audio: {
    a4: 440
  },
  metrics: {
    level: {
      type: 'level'
    },
    cents: {
      type: 'pitch',
      target: 'A2'
    }
  },
  phases: [
    {
      id: 'quiet',
      when: {
        level: {
          lt: -42
        }
      }
    },
    {
      id: 'ringing',
      when: {
        level: {
          gt: -32
        }
      }
    }
  ],
  rep: {
    sequence: ['quiet', 'ringing', 'quiet'],
    minDurationMs: 200
  },
  progress: {
    unit: 'notes',
    measures: ['cleanRate', 'vsPrevious']
  },
  rules: [
    {
      id: 'too_flat',
      severity: 'high',
      check: 'avg(cents) >= -10',
      message: {
        es: 'Está baja: aprieta un poco la clavija',
        en: 'It is flat: tighten the peg a little'
      }
    },
    {
      id: 'too_sharp',
      severity: 'high',
      check: 'avg(cents) <= 10',
      message: {
        es: 'Está alta: afloja un poco la clavija',
        en: 'It is sharp: loosen the peg a little'
      }
    }
  ]
}

// The same for a skill that looks at an object together with the hand: it says which object, and
// judges how the object lies. A guitar lesson never measures the body (see guitarLessonProblems).
export const EXAMPLE_OBJECT_SKILL = {
  id: 'custom_guitar_hold_example',
  category: 'instrument',
  name: {
    es: 'Sujeción de guitarra de ejemplo',
    en: 'Example guitar hold'
  },
  camera: {
    view: 'front',
    fullBody: false,
    hand: 'auto'
  },
  object: 'guitar',
  metrics: {
    lying: {
      type: 'objectAspect'
    },
    wrist: {
      type: 'tilt',
      from: 'handWrist',
      to: 'middleMcp'
    }
  },
  phases: [
    {
      id: 'holding',
      when: {
        lying: {
          gt: 1.3
        }
      }
    },
    {
      id: 'lifted',
      when: {
        lying: {
          lt: 0.9
        }
      }
    }
  ],
  rep: {
    sequence: ['holding', 'lifted', 'holding'],
    minDurationMs: 600
  },
  rules: [
    {
      id: 'guitar_across',
      severity: 'high',
      check: 'min(lying) >= 1.3',
      message: {
        es: 'Acuesta la guitarra: el mástil debe quedar casi horizontal',
        en: 'Lay the guitar across you: the neck should be almost level'
      }
    },
    {
      id: 'fretting_wrist',
      severity: 'medium',
      check: 'min(wrist) >= 70 && max(wrist) <= 110',
      message: {
        es: 'No dobles la muñeca de la mano del mástil',
        en: 'Do not bend the wrist of the hand on the neck'
      }
    }
  ]
}

// Tells the model how to write the configuration of a skill. The format is the one the app loads,
// and whatever the model writes is checked by the same code that checks the skills that come with
// the app; what is wrong is sent back so that the model can correct it.
export function skillGeneratorPrompt(language: Language): OutboundSystem {
  return buildSystem(
    [
      'You write skill configurations for VYRO, a desktop app that watches a person practise a skill with the camera and corrects their technique in real time. A configuration says what to measure on the body, on the hands, on an object or in the sound, when a repetition starts and ends, and which rules a good repetition follows.',
      '',
      ...requirementPrompt(),
      'Fill "requirement" in every answer. If the skill cannot be measured with the body, the hands or the sound, write an empty string in "skill": nobody will read it.',
      '',
      'The field "skill" holds the text of ONE JSON object: the whole configuration, with this format.',
      '- "id": "custom_" followed by lowercase words joined by underscores (letters, digits and underscores only). "category": one lowercase word such as "exercise", "stretch", "yoga" or "posture". "name": {"es": ..., "en": ...}.',
      '- "goal": ONE short sentence, in both languages ({"es": ..., "en": ...}, at most 160 characters), that tells the person what to do in the skill, in the second person ("Baja como si te sentaras y vuelve a subir"). It is shown before and while they practise.',
      '- "camera": {"view": "side" or "front", "fullBody": true or false, "hand": "auto", "left" or "right"}. Use "side" when the movement shows from the side (most do), "front" for symmetry. "fullBody" is true when the legs matter; it is false for a skill of the hands. Leave "camera" out when the skill only listens. "hand" says which hand the hand joints belong to ("auto" for the one the camera sees best); leave it out for a skill of the body.',
      `- "metrics": an object whose keys are the metric names (lowercase first letter, letters and digits only, not one of: ${RESERVED_NAMES.join(', ')}). Every metric is one of: {"type": "angle", "points": [a, b, c]} (the angle at the middle joint b); {"type": "tilt", "from": a, "to": b} (the angle of the segment from a to b with the vertical: 0 is straight up, 90 is level); {"type": "offset", "from": a, "to": b, "axis": "x" or "y", "scale": [c, d]} (the distance from a to b along one axis, divided by the length of c to d, so it does not depend on how far the person stands); {"type": "gap", "from": a, "to": b, "scale": [c, d]} (the straight distance from a to b, divided by the length of c to d: how far apart two points are). The body joints are: ${JOINT_NAMES.join(', ')}; they mean the side of the body the camera sees. The hand joints are: ${HAND_JOINT_NAMES.join(', ')}; they mean the hand being followed, and each finger goes from its base (Mcp) to its tip. A metric may mix body and hand joints, for example the angle at the wrist between "elbow", "handWrist" and "middleMcp". The metrics of sound do not use joints: {"type": "level"} (how loud the sound is, in dBFS: -100 is silence, about -50 a quiet room, about -20 a note played near the microphone); {"type": "pitch", "target": a note such as "A2", "E4" or "C#3", or "nearest"} (how far the pitch is from the note, in cents: 0 is in tune, positive is sharp, negative is flat; "nearest" measures from the closest note, which suits tuning any string); {"type": "interval", "semitones": n} (how far the step between the last two notes is from n semitones, in cents: 0 is exact); {"type": "tempo"} (the beats per minute of the last notes; it is known from the third note on); {"type": "instrument", "name": one of ${INSTRUMENTS.join(', ')}} (how sure the sound is of being that instrument, from 0 to 1). Add the instrument metric when WHO is sounding matters, that is, when the person plays one of those instruments, and read its average in a rule (for example "avg(flute) >= 0.5", with a message such as "I do not hear a flute: play it near the microphone"); it is not needed to judge pitch or pace, and an instrument that is not in that list cannot be named, so for it measure the pitch, the pace and the volume only. The metrics of an object look at the box that the detector draws around it: {"type": "objectOffset", "to": a joint, "axis": "x" or "y", "scale": [c, d]} (where the centre of the object is compared with that joint, in times the length of c to d: positive when the object is to the right of it (x) or below it (y)); {"type": "objectAspect"} (the width of the box over its height: above 1 the object lies across the picture, below 1 it stands up; a box has no slant, so there is no angle of the object). A skill with these metrics names the object in a top-level field "object"; the objects allowed today are: ${DETECTABLE_OBJECTS.join(', ')}. Use 2 to 5 metrics. A skill that uses an object needs "object" in requirement.channels and the object in requirement.objects. A skill that uses hand joints needs "hands" in requirement.channels, one that uses body joints needs "body", and one that uses the metrics of sound needs "audio". A skill that listens counts a repetition per note: define the phases with "level" (for example quiet: level less than -42; ringing: level greater than -32), and judge the pitch or the pace in the rules.`,
      '- "phases": at least two, each {"id": ..., "when": {metricName: {"gt": number, "lt": number}}} where every condition must hold together ("gt" is greater than, "lt" is less than; use one or both). Leave a gap between the thresholds of the phases so that the phase does not flicker (for example standing: knee greater than 160; down: knee less than 110).',
      '- "rep": {"sequence": [phase ids], "minDurationMs": number}. A repetition goes through the phases of the sequence in order, starting and ending in the same phase (for example ["up", "down", "up"]), with at least three steps. minDurationMs is usually between 600 and 1500.',
      '- For a posture or a note that is HELD instead of repeated (a sustained note, a position kept), add "holdMs" to "rep" (between 2000 and 8000): the middle step of a three-step sequence (away, in position, away) then counts once the person has stayed in it for that time, and is judged again while it is kept.',
      '- "progress" (optional): how the person sees their progress, {"unit": ..., "measures": [...]}. Leave it out for an exercise of the body that is counted in repetitions. "unit" is what an attempt is called: "holds" (a posture or a sustained note), "notes" (single notes played or sung), "attempts" (chords, changes, patterns) or "reps". "measures" lists what is shown, each at most once: "cleanRate" (share of attempts done well), "timeWell" (share of the time done well; ONLY with "rep.holdMs"), "bestStreak" (the longest run of good attempts) and "vsPrevious" (compared with the last session). A sustained note: unit "holds", measures "timeWell", "bestStreak", "vsPrevious". Single notes: unit "notes", measures "cleanRate", "vsPrevious".',
      `- "display" (optional): how the practice screen shows the skill, one of ${DISPLAYS.join(', ')}. Leave it out for an exercise counted in repetitions ("counter"). "tuner" shows the note being heard against the note wanted, and "target-note" shows the note to play and whether it was played; both need a "pitch" metric. "hold" shows a posture or note that is kept, with the time it was held well; it needs "rep.holdMs". "beat" shows the pace of a rhythm against the pace asked for, with a dot that beats at that pace; it needs a "tempo" metric and "audio": {"bpm": the beats per minute asked for, from 30 to 240}.`,
      `- "rules": 2 to 5 rules, each {"id": ..., "severity": "high", "medium" or "low", "check": expression, "message": {"es": ..., "en": ...}}. The check is judged at the end of each repetition over all the frames of it, with: ${SERIES_FUNCTIONS.join(', ')} of a metric (min(knee), max(torso), range(torso), avg(knee), first(knee), last(knee)); abs(...); the times ${SCALARS.join(', ')} (in milliseconds); numbers, the comparisons < <= > >= == !=, the logic && || ! and the arithmetic + - * /. The check must be TRUE for a good repetition. Include at least one rule with severity "high": the main thing for safety, or for a repetition to count as valid. The messages are short instructions in a close tone, in both languages.`,
      '- A skill about the guitar is a lesson: film it from the front ("front") and measure only the hand, the guitar and the sound, never the body. The posture of the person who plays has its own skill that comes with the app ("guitar_posture"), so a lesson does not judge it again.',
      '',
      'Be conservative: forgiving thresholds that a beginner can reach, never pushing a joint to the end of its range. A person must be able to do the skill well and see no correction.',
      `Write the names and messages in ${LANGUAGE_NAME[language]} and in the other language of the pair, as the format asks.`,
      '',
      'A complete example of the text that goes in "skill":',
      JSON.stringify(EXAMPLE_SKILL),
      '',
      'And a complete example of a skill of the hands:',
      JSON.stringify(EXAMPLE_HAND_SKILL),
      '',
      'And a complete example of a skill that listens:',
      JSON.stringify(EXAMPLE_AUDIO_SKILL),
      '',
      'And a complete example of a skill that looks at an object:',
      JSON.stringify(EXAMPLE_OBJECT_SKILL),
      '',
      'Never give medical advice. Answer with a single JSON object that follows the schema you are given.'
    ].join('\n')
  )
}
