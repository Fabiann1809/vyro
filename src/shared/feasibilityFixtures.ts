// Shared by the tests only: nothing in the app imports this file.

import { CHANNEL_REGISTRY, OBJECT_REGISTRY } from './feasibility'

// Every channel exists today, so nothing is "planned". This puts the object channel and the guitar
// back to waiting for a later phase, so that a test can reach what the app does with a skill whose
// channel has not arrived. It returns the function that puts everything back as it was.
export function planObjectsForLater(phase = 20): () => void {
  const channel = CHANNEL_REGISTRY.object
  const guitar = OBJECT_REGISTRY['guitar']
  CHANNEL_REGISTRY.object = { status: 'planned', phase }
  OBJECT_REGISTRY['guitar'] = { status: 'planned', phase }
  return () => {
    CHANNEL_REGISTRY.object = channel
    if (guitar) OBJECT_REGISTRY['guitar'] = guitar
  }
}
