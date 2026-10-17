import { skillChannels, type SkillChannel } from './skillChannels'
import type { SkillConfig } from './skillSchema'

const escapeForPattern = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// The channel a rule is about: the one of the first metric its check uses. A rule that only looks
// at the time a repetition took has no metric, and belongs to what the skill mostly looks at.
export function ruleChannel(
  skill: Pick<SkillConfig, 'metrics' | 'rules'>,
  ruleId: string
): SkillChannel {
  const fallback = skillChannels(skill)[0] ?? 'body'
  const rule = skill.rules.find((candidate) => candidate.id === ruleId)
  if (!rule) return fallback

  for (const [name, metric] of Object.entries(skill.metrics)) {
    if (!new RegExp(`\\b${escapeForPattern(name)}\\b`).test(rule.check)) continue
    const channels = skillChannels({ metrics: { [name]: metric } })
    // A measure of an object is placed with joints of the body, but it is the object it judges.
    const channel = channels.includes('object') ? 'object' : channels[0]
    if (channel) return channel
  }
  return fallback
}
