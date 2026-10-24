import type { MessageKey } from '@renderer/i18n'

// The phases of a movement that mean something to the person who moves: where the body is. The
// phases of a sound (quiet, ringing, hit) only help the engine count, so they have no words.
const PHASE_LABEL: Record<string, MessageKey> = {
  up: 'training.phase.up',
  down: 'training.phase.down',
  extended: 'training.phase.extended',
  curled: 'training.phase.curled',
  resting: 'training.phase.resting',
  lifted: 'training.phase.lifted',
  posed: 'training.phase.posed',
  away: 'training.phase.away'
}

export const phaseLabel = (phase: string | null): MessageKey | undefined =>
  phase === null ? undefined : PHASE_LABEL[phase]
