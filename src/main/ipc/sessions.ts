import { ipcMain } from 'electron'
import { IPC } from '@shared/ipc'
import {
  optionalSkillIdSchema,
  sessionIdSchema,
  sessionQuerySchema,
  sessionToSaveSchema
} from '@shared/sessions.schema'
import type { ErrorCount, SessionDetail, SessionRow } from '@shared/sessions'
import type { SessionRepository } from '../db/sessionRepository'

// What each channel does, apart from Electron so it can be tested. Every argument is validated.
export function createSessionHandlers(repository: SessionRepository): {
  save: (session: unknown) => number
  list: (query: unknown) => SessionRow[]
  get: (id: unknown) => SessionDetail | null
  errorCounts: (skillId: unknown) => ErrorCount[]
} {
  return {
    save: (session) => repository.save(sessionToSaveSchema.parse(session)),
    list: (query) => repository.list(sessionQuerySchema.parse(query ?? {})),
    get: (id) => repository.get(sessionIdSchema.parse(id)),
    errorCounts: (skillId) => repository.errorCounts(optionalSkillIdSchema.parse(skillId))
  }
}

export function registerSessionsIpc(repository: SessionRepository): void {
  const handlers = createSessionHandlers(repository)

  ipcMain.handle(IPC.sessionsSave, (_event, session: unknown) => handlers.save(session))
  ipcMain.handle(IPC.sessionsList, (_event, query: unknown) => handlers.list(query))
  ipcMain.handle(IPC.sessionsGet, (_event, id: unknown) => handlers.get(id))
  ipcMain.handle(IPC.sessionsErrorCounts, (_event, skillId: unknown) =>
    handlers.errorCounts(skillId)
  )
}
