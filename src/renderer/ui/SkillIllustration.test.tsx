import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { bundledSkills } from '@renderer/skills'
import { SkillIllustration } from './SkillIllustration'
import { pictureOf } from './skillPictures'

describe('SkillIllustration', () => {
  it('has a picture for each skill that comes with the app', () => {
    for (const skill of bundledSkills.skills) {
      expect(pictureOf(skill.id), skill.id).not.toBeNull()
    }
  })

  it('has none for a skill it does not know, such as one the coach made', () => {
    expect(pictureOf('custom_flute')).toBeNull()
    expect(pictureOf('custom_flute', ['audio'])).toBeNull()
    expect(SkillIllustration({ skillId: 'custom_flute' })).toBeNull()
  })

  it('gives a skill made by the coach the picture of its channel, when there is one', () => {
    expect(pictureOf('custom_sign_a', ['hands'])).not.toBeNull()
  })

  it('paints the figure with the colours of the theme, never a fixed light colour', () => {
    for (const skill of bundledSkills.skills) {
      const svg = renderToStaticMarkup(<SkillIllustration skillId={skill.id} />)

      expect(svg, skill.id).toContain('var(--line)')
      // The cream of the old dark-only picture would vanish on the light theme.
      expect(svg.toLowerCase(), skill.id).not.toContain('#fff2e4"')
    }
  })
})
