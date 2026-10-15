export type PoseDelegate = 'GPU' | 'CPU'

// The GPU delegate is faster but unavailable on some machines (drivers, virtual machines).
export async function createWithDelegateFallback<T>(
  create: (delegate: PoseDelegate) => Promise<T>
): Promise<{ value: T; delegate: PoseDelegate }> {
  try {
    return { value: await create('GPU'), delegate: 'GPU' }
  } catch {
    return { value: await create('CPU'), delegate: 'CPU' }
  }
}
