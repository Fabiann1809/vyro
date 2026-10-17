import { create } from 'zustand'
import { bundledSkills, bundledSources } from '@renderer/skills'
import type { CustomSkillSource } from '@shared/customSkills'
import type { VyroApi } from '@shared/ipc'
import { loadSkills, type SkillLoadError } from '@shared/skill/skillLoader'
import type { SkillConfig } from '@shared/skill/skillSchema'

interface SkillsState {
  // Every skill that can be practised: the ones that come with the app and the approved ones that
  // were made later.
  skills: SkillConfig[]
  // Skills that were left out because they are not valid; the rest still load.
  errors: SkillLoadError[]
}

// The skills that come with the app are there from the first moment; the others are added once
// they have been read from the database.
export const useSkills = create<SkillsState>(() => ({
  skills: bundledSkills.skills,
  errors: bundledSkills.errors
}))

// Puts the skills made later with the ones that come with the app. Each one is validated like any
// other, so a damaged or tampered row costs that one skill and never the rest. A skill cannot take
// the place of one that comes with the app: the loader keeps the first one it sees, and those that
// come with the app are read first.
export function mergeSkills(custom: readonly CustomSkillSource[]): SkillsState {
  const extra = Object.fromEntries(custom.map((source) => [`custom:${source.id}`, source.config]))
  return loadSkills({ ...bundledSources, ...extra })
}

// Reads the approved skills from the database. If that fails, the app goes on with its own skills.
export async function loadCustomSkills(api: Pick<VyroApi, 'skills'>): Promise<void> {
  try {
    useSkills.setState(mergeSkills(await api.skills.listCustom()))
  } catch {
    useSkills.setState({ skills: bundledSkills.skills, errors: bundledSkills.errors })
  }
}

// For code that is not a component and needs a skill by its id.
export const findSkill = (skillId: string): SkillConfig | undefined =>
  useSkills.getState().skills.find((skill) => skill.id === skillId)
