import type { SkillConfig } from './skillSchema'

export type SkillCamera = NonNullable<SkillConfig['camera']>

// What a skill asks of the camera when it does not say (a skill that only listens).
export const DEFAULT_CAMERA: SkillCamera = {
  view: 'front',
  fullBody: false,
  side: 'auto',
  hand: 'auto'
}

export const cameraOf = (skill: Pick<SkillConfig, 'camera'>): SkillCamera =>
  skill.camera ?? DEFAULT_CAMERA
