// Shared by the engine tests only: nothing in the app imports this file.

import { parseSkillConfig } from './skillLoader'
import type { SkillConfig } from './skillSchema'

export const kneeMetric = { type: 'angle', points: ['hip', 'knee', 'ankle'] }

export const depthRule = {
  id: 'depth',
  severity: 'high',
  check: 'min(knee) <= 100',
  message: { es: 'Baja más la cadera', en: 'Go deeper' }
}

// A complete, valid skill as it would come out of a JSON file.
export const validSkillInput: Record<string, unknown> = {
  id: 'squat',
  category: 'exercise',
  name: { es: 'Sentadilla', en: 'Squat' },
  camera: { view: 'side', fullBody: true },
  metrics: {
    knee: kneeMetric,
    torso: { type: 'tilt', from: 'hip', to: 'shoulder' },
    kneeDrift: { type: 'offset', from: 'ankle', to: 'knee', axis: 'x', scale: ['hip', 'knee'] }
  },
  phases: [
    { id: 'up', when: { knee: { gt: 160 } } },
    { id: 'down', when: { knee: { lt: 110 } } }
  ],
  rep: { sequence: ['up', 'down', 'up'], minDurationMs: 800 },
  rules: [depthRule]
}

// A skill that uses the four channels at once: the body, the hand, an object and the sound. No skill
// that comes with the app does, so the tests that need all four use this one.
export const fourChannelSkillInput: Record<string, unknown> = {
  id: 'custom_four_channels',
  category: 'instrument',
  name: { es: 'Postura con guitarra', en: 'Guitar posture' },
  camera: { view: 'front', fullBody: false, hand: 'auto' },
  object: 'guitar',
  metrics: {
    torso: { type: 'tilt', from: 'hip', to: 'shoulder' },
    lying: { type: 'objectAspect' },
    chestDrop: { type: 'objectOffset', to: 'shoulder', axis: 'y', scale: ['shoulder', 'hip'] },
    wrist: { type: 'tilt', from: 'handWrist', to: 'middleMcp' },
    level: { type: 'level' },
    cents: { type: 'pitch', target: 'nearest' }
  },
  phases: [
    { id: 'quiet', when: { level: { lt: -45 } } },
    { id: 'sound', when: { level: { gt: -30 } } }
  ],
  rep: { sequence: ['quiet', 'sound', 'quiet'], minDurationMs: 100 },
  rules: [
    {
      id: 'straight_back',
      severity: 'high',
      check: 'max(torso) <= 12',
      message: {
        es: 'MantÃ©n la espalda recta mientras tocas',
        en: 'Keep your back straight while you play'
      }
    },
    {
      id: 'guitar_across',
      severity: 'medium',
      check: 'min(lying) >= 1.3',
      message: {
        es: 'Acuesta la guitarra: el mÃ¡stil debe quedar casi horizontal',
        en: 'Lay the guitar across you: the neck should be almost level'
      }
    },
    {
      id: 'guitar_height',
      severity: 'medium',
      check: 'min(chestDrop) >= 0.15 && max(chestDrop) <= 1',
      message: {
        es: 'Sube o baja la guitarra hasta que quede a la altura del pecho',
        en: 'Raise or lower the guitar until it sits at chest height'
      }
    },
    {
      id: 'fretting_wrist',
      severity: 'medium',
      check: 'min(wrist) >= 70 && max(wrist) <= 110',
      message: {
        es: 'No dobles la muÃ±eca de la mano del mÃ¡stil',
        en: 'Do not bend the wrist of the hand on the neck'
      }
    },
    {
      id: 'out_of_tune',
      severity: 'low',
      check: 'abs(avg(cents)) <= 25',
      message: {
        es: 'La nota suena desafinada: ajusta la cuerda',
        en: 'The note sounds out of tune: adjust the string'
      }
    }
  ]
}

export const fourChannelSkill: SkillConfig = (() => {
  const parsed = parseSkillConfig(fourChannelSkillInput)
  if (!parsed.ok) throw new Error(parsed.errors.join('; '))
  return parsed.skill
})()
