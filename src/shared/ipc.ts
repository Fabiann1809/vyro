import type { AiKeyStatus } from './ai'
import type { LearningPath, PathToSave } from './paths'
import type { PlanPathInput, PlanPathResult } from './pathPlan'
import type {
  CoachChatInput,
  CoachChatReply,
  CoachResult,
  CoachSummaryInput,
  CoachSummaryReply
} from './coach'
import type { CameraAccessStatus } from './camera'
import type { AppSettings, SettingsPatch } from './settings'
import type { ErrorCount, SessionDetail, SessionQuery, SessionRow, SessionToSave } from './sessions'

export const IPC = {
  cameraRequestAccess: 'camera:request-access',
  cameraOpenSettings: 'camera:open-settings',
  sessionsSave: 'sessions:save',
  sessionsList: 'sessions:list',
  sessionsGet: 'sessions:get',
  sessionsErrorCounts: 'sessions:error-counts',
  settingsGet: 'settings:get',
  settingsSet: 'settings:set',
  dataDeleteAll: 'data:delete-all',
  aiKeyStatus: 'ai:key-status',
  aiKeySave: 'ai:key-save',
  aiKeyClear: 'ai:key-clear',
  coachChat: 'coach:chat',
  coachSummarize: 'coach:summarize',
  coachPlanPath: 'coach:plan-path',
  pathsGetActive: 'paths:get-active',
  pathsSave: 'paths:save',
  pathsSetStepDone: 'paths:set-step-done',
  pathsArchive: 'paths:archive'
} as const

// The only API the renderer can call. Everything else stays in the main process.
export interface VyroApi {
  platform: string
  camera: {
    requestAccess: () => Promise<CameraAccessStatus>
    openSystemSettings: () => Promise<void>
  }
  sessions: {
    // Returns the id of the saved session.
    save: (session: SessionToSave) => Promise<number>
    list: (query?: SessionQuery) => Promise<SessionRow[]>
    get: (id: number) => Promise<SessionDetail | null>
    errorCounts: (skillId?: string) => Promise<ErrorCount[]>
  }
  settings: {
    get: () => Promise<AppSettings>
    set: (patch: SettingsPatch) => Promise<void>
  }
  ai: {
    // Whether a key exists; its value never reaches the page.
    keyStatus: () => Promise<AiKeyStatus>
    saveKey: (key: string) => Promise<void>
    clearKey: () => Promise<void>
  }
  coach: {
    // Failures come back as data (a kind of error), never as text from the provider.
    chat: (input: CoachChatInput) => Promise<CoachResult<CoachChatReply>>
    // A few words about one session, from its numbers only.
    summarize: (input: CoachSummaryInput) => Promise<CoachResult<CoachSummaryReply>>
    // One step of planning a learning path: a question, a path, or why it cannot be done.
    planPath: (input: PlanPathInput) => Promise<CoachResult<PlanPathResult>>
  }
  paths: {
    // The path being followed, or null.
    getActive: () => Promise<LearningPath | null>
    // Saves a path and makes it the active one; returns its id.
    save: (path: PathToSave) => Promise<number>
    // Whether the step exists.
    setStepDone: (stepId: number, done: boolean) => Promise<boolean>
    archive: (pathId: number) => Promise<boolean>
  }
  data: {
    // Empties the database: sessions and settings.
    deleteAll: () => Promise<void>
  }
}
