import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AdoptionCheck, AdoptionChoice } from '@shared/localData'
import { checkLocalData, resetLocalData, resolveLocalData, useLocalData } from './localDataStore'

type Api = Parameters<typeof checkLocalData>[0]

function fakeApi(check: AdoptionCheck | Error, resolve: Error | null = null): Api {
  return {
    localData: {
      check: () => (check instanceof Error ? Promise.reject(check) : Promise.resolve(check)),
      resolve: vi.fn<(choice: AdoptionChoice) => Promise<void>>(() =>
        resolve ? Promise.reject(resolve) : Promise.resolve()
      )
    }
  }
}

beforeEach(() => resetLocalData())

describe('checkLocalData', () => {
  it('starts by checking', () => {
    expect(useLocalData.getState().phase).toBe('checking')
  })

  it('opens the app when there is nothing to decide', async () => {
    await checkLocalData(fakeApi({ action: 'none' }))
    expect(useLocalData.getState()).toMatchObject({ phase: 'ready', failed: false })
  })

  it('asks when there is data from before the account', async () => {
    const counts = { sessions: 3, paths: 1, skills: 0 }
    await checkLocalData(fakeApi({ action: 'ask', counts }))
    expect(useLocalData.getState()).toMatchObject({ phase: 'ask', counts })
  })

  it('keeps the app closed when the check fails', async () => {
    await checkLocalData(fakeApi(new Error('no answer')))
    expect(useLocalData.getState()).toMatchObject({ phase: 'checking', failed: true })
  })
})

describe('resolveLocalData', () => {
  it('sends the answer and opens the app', async () => {
    const api = fakeApi({ action: 'none' })
    useLocalData.setState({ phase: 'ask', counts: { sessions: 1, paths: 0, skills: 0 } })
    await resolveLocalData(api, true)
    expect(api.localData.resolve).toHaveBeenCalledWith({ keep: true })
    expect(useLocalData.getState().phase).toBe('ready')
  })

  it('stays on the question when the answer does not go through', async () => {
    const api = fakeApi({ action: 'none' }, new Error('no'))
    useLocalData.setState({ phase: 'ask', counts: { sessions: 1, paths: 0, skills: 0 } })
    await resolveLocalData(api, false)
    expect(useLocalData.getState()).toMatchObject({ phase: 'ask', failed: true })
  })
})

describe('resetLocalData', () => {
  it('asks to check again for the next person to sign in', () => {
    useLocalData.setState({ phase: 'ready' })
    resetLocalData()
    expect(useLocalData.getState().phase).toBe('checking')
  })
})
