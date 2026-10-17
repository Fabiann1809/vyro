import { compileExpression } from './expression'
import { skillConfigSchema, type SkillConfig } from './skillSchema'

export type ParseResult = { ok: true; skill: SkillConfig } | { ok: false; errors: string[] }

export interface SkillLoadError {
  // File or name the configuration came from, for example "squat.json".
  source: string
  errors: string[]
}

export interface SkillLoadResult {
  skills: SkillConfig[]
  errors: SkillLoadError[]
}

// Validates one raw configuration, including that every rule expression is well formed and only
// uses the metrics of the skill. Each error reads "path: what is wrong".
export function parseSkillConfig(raw: unknown): ParseResult {
  const result = skillConfigSchema.safeParse(raw)
  if (result.success) {
    const problems = ruleExpressionProblems(result.data)
    return problems.length === 0
      ? { ok: true, skill: result.data }
      : { ok: false, errors: problems }
  }

  return {
    ok: false,
    errors: result.error.issues.map((issue) => {
      const path = issue.path.join('.')
      return path ? `${path}: ${issue.message}` : issue.message
    })
  }
}

function ruleExpressionProblems(skill: SkillConfig): string[] {
  const metricNames = Object.keys(skill.metrics)

  return skill.rules.flatMap((rule, index) => {
    const compiled = compileExpression(rule.check, metricNames)
    return compiled.ok ? [] : [`rules.${index}.check: ${compiled.error}`]
  })
}

// Loads every configuration it can. An invalid one is skipped and reported, so a single bad file
// never takes the whole app down. Skills come back ordered by id, whatever the source order.
export function loadSkills(sources: Readonly<Record<string, unknown>>): SkillLoadResult {
  const skills = new Map<string, { skill: SkillConfig; source: string }>()
  const errors: SkillLoadError[] = []

  for (const source of Object.keys(sources).sort()) {
    const parsed = parseSkillConfig(sources[source])

    if (!parsed.ok) {
      errors.push({ source, errors: parsed.errors })
      continue
    }

    const existing = skills.get(parsed.skill.id)
    if (existing) {
      errors.push({
        source,
        errors: [
          `id: duplicate skill id "${parsed.skill.id}" (already defined in ${existing.source})`
        ]
      })
      continue
    }

    skills.set(parsed.skill.id, { skill: parsed.skill, source })
  }

  return {
    skills: [...skills.values()]
      .map((entry) => entry.skill)
      .sort((a, b) => a.id.localeCompare(b.id)),
    errors
  }
}
