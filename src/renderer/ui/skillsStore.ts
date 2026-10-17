import { create } from 'zustand'
import { bundledSkills, bundledSources } from '@renderer/skills'
import type { CustomSkillSource } from '@shared/customSkills'
import type { VyroApi } from '@shared/ipc'
import { generatedSkillProblems, isGeneratedSkillId } from '@shared/skill/generatedSafety'
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
  const loaded = loadSkills({ ...bundledSources, ...extra })
  return withoutUnsafe(loaded)
}

// A generated skill must pass the limits again when it is read: the row could have been edited.
// The ones that come with the app are not held to them.
function withoutUnsafe(loaded: SkillsState): SkillsState {
  const errors = [...loaded.errors]
  const skills = loaded.skills.filter((skill) => {
    if (bundledSkills.skills.some((bundled) => bundled.id === skill.id)) return true
    const problems = isGeneratedSkillId(skill.id)
      ? generatedSkillProblems(skill)
      : generatedSkillProblems(skill).slice(0, 1)
    if (problems.length > 0) errors.push({ source: `custom:${skill.id}`, errors: problems })
    return problems.length === 0
  })
  return { skills, errors }
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
