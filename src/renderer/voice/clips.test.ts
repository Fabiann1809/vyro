import { describe, expect, it } from 'vitest'
import en from '@renderer/i18n/en.json'
import es from '@renderer/i18n/es.json'
import { bundledSkills } from '@renderer/skills'
import { clipFiles, clipUrl } from './clips'
import { listClips } from './clipList'

const clips = listClips(bundledSkills.skills, { es, en })

describe('recorded clips', () => {
  it('lists a clip for every message in both languages', () => {
    const squatDepth = clips.filter((clip) => clip.id === 'squat.depth')

    expect(squatDepth.map((clip) => clip.language).sort()).toEqual(['en', 'es'])
    expect(clips.every((clip) => clip.text.trim() !== '')).toBe(true)
  })

  it('has the file of every listed clip (run scripts/generate-voice-clips.ps1 when one is missing)', () => {
    const missing = clips
      .filter((clip) => clipUrl(clip.language, clip.id) === null)
      .map((clip) => `${clip.language}/${clip.id}`)

    expect(missing).toEqual([])
  })

  it('has no file that is not in the list', () => {
    const listed = new Set(clips.map((clip) => `../assets/voice/${clip.language}/${clip.id}.wav`))

    expect(clipFiles.filter((file) => !listed.has(file))).toEqual([])
  })
})
