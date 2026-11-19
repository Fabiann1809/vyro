import { z } from 'zod'

// What is kept on this computer from before the account, for the page to describe to the person.
export interface LocalCounts {
  sessions: number
  paths: number
  skills: number
}

// What happens when someone signs in, as far as the data on this computer is concerned (D21).
export type AdoptionCheck =
  // Nothing to decide: the data is already this account's, or there is none.
  | { action: 'none' }
  // There is data from before the account and the person has to say what to do with it.
  | { action: 'ask'; counts: LocalCounts }

export const adoptionChoiceSchema = z.object({ keep: z.boolean() })

export type AdoptionChoice = z.infer<typeof adoptionChoiceSchema>
