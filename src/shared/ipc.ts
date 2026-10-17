import type { AiKeyStatus } from './ai'
import type { CustomSkillSource } from './customSkills'
import type { GenerateSkillInput, GenerateSkillResult } from './skillGeneration'
import type { PathToSave } from './paths'
import type { CurrentPath } from './pathProgress'
import type { PlanPathInput, PlanPathResult } from './pathPlan'
import type { ApplyAdjustmentsInput, PathReview, ReviewPathInput } from './pathReview'
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
  coachReviewPath: 'coach:review-path',
  coachGenerateSkill: 'coach:generate-skill',
  pathsGetCurrent: 'paths:get-current',
  pathsSave: 'paths:save',
  pathsSetStepDone: 'paths:set-step-done',
  pathsArchive: 'paths:archive',
  pathsApplyAdjustments: 'paths:apply-adjustments',
  skillsListCustom: 'skills:list-custom'
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
    // The weekly review of the path being followed, built from the numbers kept in this computer.
    reviewPath: (input: ReviewPathInput) => Promise<CoachResult<PathReview>>
    // Makes a new skill with the AI. A valid one is kept as a draft, which has to be approved.
    generateSkill: (input: GenerateSkillInput) => Promise<CoachResult<GenerateSkillResult>>
  }
  paths: {
    // The path being followed, with how far it has got, or null. Asking also brings the progress
    // up to date with the sessions saved so far.
    getCurrent: () => Promise<CurrentPath | null>
    // Saves a path and makes it the active one; returns its id.
    save: (path: PathToSave) => Promise<number>
    // Only auxiliary steps are marked by hand; whether anything changed.
    setStepDone: (stepId: number, done: boolean) => Promise<boolean>
    archive: (pathId: number) => Promise<boolean>
    // Applies the adjustments that the person accepted; false if the path changed in the meantime.
    applyAdjustments: (input: ApplyAdjustmentsInput) => Promise<boolean>
  }
  skills: {
    // The skills made after the app was built that the person has approved. They are JSON that the
    // page validates itself before using.
    listCustom: () => Promise<CustomSkillSource[]>
  }
  data: {
    // Empties the database: sessions and settings.
    deleteAll: () => Promise<void>
  }
}
