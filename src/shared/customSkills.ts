// Skills made after the app was built (by the AI generator), kept in the database.

// draft     made, but the person has not approved it: it is never offered to train
// approved  the person approved it: it appears with the rest of the skills
export type CustomSkillStatus = 'draft' | 'approved'

export interface CustomSkillRecord {
  id: string
  // The JSON of the skill. Not trusted: whoever reads it validates it first.
  config: unknown
  status: CustomSkillStatus
  createdAt: number
}

// What the page needs to load a skill: its id and its JSON.
export interface CustomSkillSource {
  id: string
  config: unknown
}
