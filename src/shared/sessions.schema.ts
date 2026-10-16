import { z } from 'zod'

// The renderer is not trusted by the main process: everything that arrives over IPC is checked
// here before it reaches the database.

const identifier = z.string().min(1).max(64)

const DAY_MS = 24 * 60 * 60 * 1000

const repToSave = z
  .object({
    index: z.number().int().min(1).max(10_000),
    quality: z.enum(['good', 'needs-work', 'bad', 'unknown']),
    durationMs: z.number().int().min(0).max(DAY_MS),
    failedRuleIds: z.array(identifier).max(50)
  })
  .strict()

export const sessionToSaveSchema = z
  .object({
    skillId: identifier,
    startedAt: z.number().int().min(0),
    durationMs: z.number().int().min(0).max(DAY_MS),
    score: z.number().int().min(0).max(100).nullable(),
    reps: z.array(repToSave).max(10_000)
  })
  .strict()

export const sessionQuerySchema = z
  .object({
    skillId: identifier.optional(),
    limit: z.number().int().min(1).max(1000).optional()
  })
  .strict()

export const sessionIdSchema = z.number().int().min(1)

export const optionalSkillIdSchema = identifier.optional()
