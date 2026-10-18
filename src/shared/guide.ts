import { z } from 'zod'
import { diagramRefSchema, MAX_DIAGRAMS } from './diagrams'

// What a step of a path says about how to do it, apart from the one-sentence description: a few
// short tips and about how long it takes. It is what fills the gap left by the steps that VYRO
// cannot measure, so the person is told what to do and not only "mark it as done".

export const MAX_TIPS = 5
export const MAX_TIP_LENGTH = 160

export const guideSchema = z
  .object({
    tips: z.array(z.string().trim().min(1).max(MAX_TIP_LENGTH)).min(1).max(MAX_TIPS),
    // About how long the step takes, or null when it has no fixed time.
    minutes: z.number().int().min(1).max(120).nullable(),
    // Drawings that help to do it, by name (D18); none when nothing is worth drawing.
    diagrams: z.array(diagramRefSchema).max(MAX_DIAGRAMS).default([])
  })
  .strict()

// What a step is given with (diagrams may be left out) and what it is read as.
export type GuideInput = z.input<typeof guideSchema>
export type Guide = z.infer<typeof guideSchema>
