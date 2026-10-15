import { describe, expect, it, vi } from 'vitest'
import { createWithDelegateFallback } from './delegate'

describe('createWithDelegateFallback', () => {
  it('uses the GPU when it works', async () => {
    const create = vi.fn().mockResolvedValue('landmarker')

    await expect(createWithDelegateFallback(create)).resolves.toEqual({
      value: 'landmarker',
      delegate: 'GPU'
    })
    expect(create).toHaveBeenCalledTimes(1)
  })

  it('falls back to the CPU when the GPU fails', async () => {
    const create = vi
      .fn()
      .mockRejectedValueOnce(new Error('no webgl'))
      .mockResolvedValueOnce('landmarker')

    await expect(createWithDelegateFallback(create)).resolves.toEqual({
      value: 'landmarker',
      delegate: 'CPU'
    })
    expect(create.mock.calls).toEqual([['GPU'], ['CPU']])
  })

  it('fails when the CPU fails too', async () => {
    const create = vi.fn().mockRejectedValue(new Error('broken'))

    await expect(createWithDelegateFallback(create)).rejects.toThrow('broken')
  })
})
