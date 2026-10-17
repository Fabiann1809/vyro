// Shared by the engine tests only: nothing in the app imports this file.

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
