import { ipcMain } from 'electron'
import { adoptionChoiceSchema, type AdoptionCheck } from '@shared/localData'
import { IPC } from '@shared/ipc'
import type { LocalAdoption } from '../db/adoption'

// What each channel does, apart from Electron so it can be tested. The account comes from the main
// process, never from the page: the page cannot say whose data it is.
export function createLocalDataHandlers(
  adoption: LocalAdoption,
  currentUserId: () => Promise<string | null>,
  // Called when the data on this computer has become the account's.
  onClaimed: () => void = () => {}
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
    check: async () => {
      const result = adoption.check(await signedIn())
      if (result.action === 'none') onClaimed()
      return result
    },
    resolve: async (choice) => {
      const parsed = adoptionChoiceSchema.safeParse(choice)
      if (!parsed.success) throw new Error('The choice is not valid.')
      adoption.resolve(await signedIn(), parsed.data.keep)
      onClaimed()
    }
  }
}

export function registerLocalDataIpc(
  adoption: LocalAdoption,
  currentUserId: () => Promise<string | null>,
  onClaimed: () => void
): void {
  const handlers = createLocalDataHandlers(adoption, currentUserId, onClaimed)

  ipcMain.handle(IPC.localDataCheck, () => handlers.check())
  ipcMain.handle(IPC.localDataResolve, (_event, choice: unknown) => handlers.resolve(choice))
}
