import type { JSX } from 'react'
import type { SkillChannel } from '@shared/skill/skillChannels'
import { pictureOf } from './skillPictures'

export function SkillIllustration({
  skillId,
  channels,
  className
}: {
  skillId: string
  channels?: readonly SkillChannel[]
  className?: string
}): JSX.Element | null {
  const picture = pictureOf(skillId, channels)
  if (!picture) return null
  return (
    <svg viewBox="0 0 200 200" aria-hidden="true" className={className}>
      {picture}
    </svg>
  )
}
