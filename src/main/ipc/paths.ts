import { ipcMain } from 'electron'
import { z } from 'zod'
import { IPC } from '@shared/ipc'
import { pathToSaveSchema } from '@shared/paths'
import type { CurrentPath } from '@shared/pathProgress'
import { adjustmentProblems, applyAdjustmentsInputSchema } from '@shared/pathReview'
import type { PathProgressService } from '../db/pathProgressService'
import type { PathRepository } from '../db/pathRepository'

const idSchema = z.number().int().min(1)

// What each channel does, apart from Electron so it can be tested. Every argument is validated,
// and the dates are set here, not by the page.
export function createPathHandlers(
  repository: PathRepository,
  progress: PathProgressService
): {
  getCurrent: () => CurrentPath | null
  save: (path: unknown) => number
  setStepDone: (stepId: unknown, done: unknown) => boolean
  archive: (pathId: unknown) => boolean
  applyAdjustments: (input: unknown) => boolean
} {
  return {
    getCurrent: () => progress.current(),
    // One path at a time is followed: a new one takes the place of the one on show.
    save: (path) => {
      const parsed = pathToSaveSchema.parse(path)
      repository.archiveCurrent()
      return repository.create(parsed, Date.now())
    },
    setStepDone: (stepId, done) =>
      progress.setStepDone(idSchema.parse(stepId), z.boolean().parse(done)),
    archive: (pathId) => repository.setStatus(idSchema.parse(pathId), 'archived'),
    // What the person accepted is checked again against the path as it is now: it may have changed
    // since the review was made, and the page is not trusted with what is allowed.
    applyAdjustments: (input) => {
      const { pathId, adjustments, skillIds } = applyAdjustmentsInputSchema.parse(input)
      const current = progress.current()
      if (current?.path.id !== pathId || current.path.status !== 'active') return false
      if (adjustmentProblems(current.path, adjustments, skillIds).length > 0) return false

      repository.applyAdjustments(pathId, adjustments)
      progress.current()
      return true
    }
  }
}

export function registerPathsIpc(repository: PathRepository, progress: PathProgressService): void {
  const handlers = createPathHandlers(repository, progress)

  ipcMain.handle(IPC.pathsGetCurrent, () => handlers.getCurrent())
  ipcMain.handle(IPC.pathsSave, (_event, path: unknown) => handlers.save(path))
  ipcMain.handle(IPC.pathsSetStepDone, (_event, stepId: unknown, done: unknown) =>
    handlers.setStepDone(stepId, done)
  )
  ipcMain.handle(IPC.pathsArchive, (_event, pathId: unknown) => handlers.archive(pathId))
  ipcMain.handle(IPC.pathsApplyAdjustments, (_event, input: unknown) =>
    handlers.applyAdjustments(input)
  )
}
