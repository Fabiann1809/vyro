import { ipcMain } from 'electron'
import { adoptionChoiceSchema, type AdoptionCheck } from '@shared/localData'
import { IPC } from '@shared/ipc'
import type { LocalAdoption } from '../db/adoption'

// What each channel does, apart from Electron so it can be tested. The account comes from the main
// process, never from the page: the page cannot say whose data it is.
export function createLocalDataHandlers(
  adoption: LocalAdoption,
  currentUserId: () => Promise<string | null>
): {
  check: () => Promise<AdoptionCheck>
  resolve: (choice: unknown) => Promise<void>
} {
  const signedIn = async (): Promise<string> => {
    const id = await currentUserId()
    if (!id) throw new Error('Nobody is signed in.')
    return id
  }
  return {
    check: async () => adoption.check(await signedIn()),
    resolve: async (choice) => {
      const parsed = adoptionChoiceSchema.safeParse(choice)
      if (!parsed.success) throw new Error('The choice is not valid.')
      adoption.resolve(await signedIn(), parsed.data.keep)
    }
  }
}

export function registerLocalDataIpc(
  adoption: LocalAdoption,
  currentUserId: () => Promise<string | null>
): void {
  const handlers = createLocalDataHandlers(adoption, currentUserId)

  ipcMain.handle(IPC.localDataCheck, () => handlers.check())
  ipcMain.handle(IPC.localDataResolve, (_event, choice: unknown) => handlers.resolve(choice))
}
