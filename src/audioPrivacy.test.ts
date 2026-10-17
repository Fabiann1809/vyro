import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { describe, expect, it } from 'vitest'

// The sound of the microphone is measured and forgotten. These look through the source of the app
// for anything that could keep it, copy it out of the one place that reads it, or send it away.

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : []
  })
}

const files = sourceFiles('src').map((path) => ({
  path: relative('src', path).split(sep).join('/'),
  text: readFileSync(path, 'utf-8')
}))

const CAPTURE = 'renderer/core/audio/capture.ts'

const where = (pattern: RegExp): string[] =>
  files.filter((file) => pattern.test(file.text)).map((file) => file.path)

describe('what the app can do with sound', () => {
  it('has nothing that records it', () => {
    expect(where(/MediaRecorder|createMediaStreamDestination|createScriptProcessor/)).toEqual([])
  })

  it('reads samples in one place only', () => {
    expect(where(/get(Float|Byte)(TimeDomain|Frequency)Data|getChannelData/)).toEqual([CAPTURE])
  })

  it('opens the audio context in one place only', () => {
    expect(where(/new (webkit)?AudioContext|new OfflineAudioContext/)).toEqual([CAPTURE])
  })

  it('builds the constraints of the microphone in one place only', () => {
    expect(where(/buildMicrophoneConstraints\(/)).toEqual([CAPTURE])
  })

  it('does not play what it hears', () => {
    expect(where(/\.destination\b/)).toEqual([])
  })

  it('does not let samples or sound buffers into the main process, the bridge or the shared types', () => {
    const outside = files.filter(
      (file) =>
        file.path.startsWith('main/') ||
        file.path.startsWith('preload/') ||
        file.path.startsWith('shared/')
    )

    expect(
      outside
        .filter((file) => /Float32Array|AudioBuffer|MediaStream\b|MediaRecorder/.test(file.text))
        .map((file) => file.path)
    ).toEqual([])
  })
})
