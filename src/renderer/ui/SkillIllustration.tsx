import type { JSX } from 'react'
import { PICTURES } from './skillPictures'

export function SkillIllustration({
  skillId,
  className
}: {
  skillId: string
  className?: string
}): JSX.Element | null {
  const picture = PICTURES[skillId]
  if (!picture) return null
  return (
    <svg viewBox="0 0 200 200" aria-hidden="true" className={className}>
      {picture}
    </svg>
  )
}
