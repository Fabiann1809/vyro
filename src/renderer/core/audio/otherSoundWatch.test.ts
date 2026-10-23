import { describe, expect, it } from 'vitest'
import { OtherSoundWatch } from './otherSoundWatch'

const watch = (): OtherSoundWatch => new OtherSoundWatch(2000, -55)

// Feeds one reading every 50 ms and returns whether it has been said by the end.
function listen(
  target: OtherSoundWatch,
  from: number,
  ms: number,
  levelDb: number,
  heard: boolean | null
): boolean {
  let said = false
  for (let at = from; at < from + ms; at += 50) said = target.update(at, levelDb, heard)
  return said
}

describe('OtherSoundWatch', () => {
  it('waits before saying a sound is not the instrument', () => {
    const target = watch()

    expect(listen(target, 0, 1500, -30, false)).toBe(false)
    expect(listen(target, 1500, 1000, -30, false)).toBe(true)
  })

  it('says nothing while the instrument is heard', () => {
    expect(listen(watch(), 0, 6000, -30, true)).toBe(false)
  })

  it('does not count silence, but does not forget the sound that came before', () => {
    const target = watch()
    listen(target, 0, 1500, -30, false)

    expect(listen(target, 1500, 5000, -80, false)).toBe(false)
    expect(listen(target, 6500, 700, -30, false)).toBe(true)
  })

  it('adds up short sounds with rests between them', () => {
    const target = watch()
    let said = false
    for (let round = 0; round < 12; round++) {
      listen(target, round * 1000, 200, -30, false)
      said = listen(target, round * 1000 + 200, 800, -80, false)
    }

    expect(said).toBe(true)
  })

  it('says nothing when the sound is not being classified', () => {
    expect(listen(watch(), 0, 6000, -30, null)).toBe(false)
  })

  it('starts over as soon as the instrument is heard', () => {
    const target = watch()
    expect(listen(target, 0, 3000, -30, false)).toBe(true)

    expect(listen(target, 3000, 100, -30, true)).toBe(false)
    expect(listen(target, 3100, 1000, -30, false)).toBe(false)
  })

  it('does not count a long gap between readings as sound', () => {
    const target = watch()
    target.update(0, -30, false)

    expect(target.update(60_000, -30, false)).toBe(false)
  })
})
