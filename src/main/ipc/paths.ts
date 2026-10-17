import { ipcMain } from 'electron'
import { z } from 'zod'
import { IPC } from '@shared/ipc'
import { pathToSaveSchema, type LearningPath } from '@shared/paths'
import type { PathRepository } from '../db/pathRepository'

const idSchema = z.number().int().min(1)

// What each channel does, apart from Electron so it can be tested. Every argument is validated,
// and the dates are set here, not by the page.
export function createPathHandlers(repository: PathRepository): {
  getActive: () => LearningPath | null
  save: (path: unknown) => number
  setStepDone: (stepId: unknown, done: unknown) => boolean
  archive: (pathId: unknown) => boolean
} {
  return {
    getActive: () => repository.getActive(),
    // One path at a time is followed: a new one takes the place of the one that was active.
    save: (path) => {
      const parsed = pathToSaveSchema.parse(path)
      repository.archiveActive()
      return repository.create(parsed, Date.now())
    },
    setStepDone: (stepId, done) =>
      repository.setStepDone(idSchema.parse(stepId), z.boolean().parse(done) ? Date.now() : null),
    archive: (pathId) => repository.setStatus(idSchema.parse(pathId), 'archived')
  }
}

export function registerPathsIpc(repository: PathRepository): void {
  const handlers = createPathHandlers(repository)

  ipcMain.handle(IPC.pathsGetActive, () => handlers.getActive())
  ipcMain.handle(IPC.pathsSave, (_event, path: unknown) => handlers.save(path))
  ipcMain.handle(IPC.pathsSetStepDone, (_event, stepId: unknown, done: unknown) =>
    handlers.setStepDone(stepId, done)
  )
  ipcMain.handle(IPC.pathsArchive, (_event, pathId: unknown) => handlers.archive(pathId))
}
