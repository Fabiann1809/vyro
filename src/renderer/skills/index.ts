import { loadSkills } from '@shared/skill/skillLoader'

// Every skill is a JSON file in this folder: adding one needs no change in the code.
const sources = import.meta.glob('./*.json', { eager: true, import: 'default' })

export const bundledSkills = loadSkills(sources)
