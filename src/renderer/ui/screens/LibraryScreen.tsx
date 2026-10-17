import { useState } from 'react'
import { currentLanguage, localize, t, type MessageKey } from '@renderer/i18n'
import type { SkillChannel } from '@shared/skill/skillChannels'
import { ChannelChips } from '../kit/ChannelChip'
import { CHANNEL_LOOK, CHANNEL_ORDER } from '../kit/channels'
import { Button } from '../kit/Button'
import { Card } from '../kit/Card'
import { CoachAvatar } from '../kit/CoachAvatar'
import { Icon } from '../kit/Icon'
import {
  FILTER_CATEGORIES,
  filterSkills,
  skillLine,
  skillNeeds,
  toLibrarySkill,
  type LibraryCategory,
  type LibrarySkill
} from '../librarySkills'
import { cardOf, startWithExpand } from '../expandTransition'
import { useNavigation } from '../navigation'
import { useSession } from '../sessionStore'
import { useSkills } from '../skillsStore'

const CATEGORY_LABEL: Record<LibraryCategory, MessageKey> = {
  fitness: 'library.category.fitness',
  music: 'library.category.music',
  generated: 'library.category.generated',
  other: 'library.category.other'
}

const PILL =
  'inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[0.84rem] transition-colors aria-pressed:border-t1 aria-pressed:bg-t1 aria-pressed:text-inv border-line/12 text-t4 hover:bg-line/5 aria-pressed:hover:bg-t1'

function FilterPill({
  pressed,
  onClick,
  children
}: {
  pressed: boolean
  onClick: () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <button type="button" aria-pressed={pressed} onClick={onClick} className={PILL}>
      {children}
    </button>
  )
}

const listOf = (things: string[]): string =>
  new Intl.ListFormat(currentLanguage(), { style: 'long', type: 'conjunction' }).format(things)

function SkillCard({
  entry,
  onStart
}: {
  entry: LibrarySkill
  onStart: (skillId: string, card: Element | null) => void
}): React.JSX.Element {
  const { skill, category, channels } = entry
  const name = localize(skill.name)
  const lead = channels[0]
  const needs = listOf(skillNeeds(skill).map((need) => t(need)))

  return (
    <Card
      data-expand
      className="anim-up flex w-full flex-col gap-3.5 p-3 pb-5 transition duration-200 hover:-translate-y-0.5 hover:border-line/14"
    >
      <div
        aria-hidden="true"
        className="relative flex h-36 items-end gap-2 overflow-hidden rounded-[1.125rem] bg-sunk p-3"
      >
        {lead && <span className={`absolute inset-0 opacity-15 ${CHANNEL_LOOK[lead].fill}`} />}
        <span className="absolute inset-0 bg-[repeating-linear-gradient(135deg,color-mix(in_oklab,var(--line)_4%,transparent)_0_10px,transparent_10px_20px)]" />
        {channels.map((channel) => (
          <span key={channel} className={`relative ${CHANNEL_LOOK[channel].text}`}>
            <Icon name={CHANNEL_LOOK[channel].icon} className="size-9" strokeWidth={1.2} />
          </span>
        ))}
        {category === 'generated' && (
          <span className="absolute top-3 left-3 flex h-6 items-center rounded-full border border-dashed border-warn bg-card px-2.5 text-[0.72rem] font-semibold text-warn-text">
            {t('library.badge.experimental')}
          </span>
        )}
        <span className="absolute top-3 right-3 flex h-6 items-center rounded-full bg-bg/70 px-2.5 text-[0.72rem] text-t4">
          {t(CATEGORY_LABEL[category])}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2 px-2">
        <h2 className="text-lg font-semibold">{name}</h2>
        <p className="text-sm leading-snug text-mut">{t(skillLine(skill))}</p>
        <ChannelChips channels={channels} />
        <p className="mt-auto pt-1.5 text-xs text-mut2">
          {t('library.needs.label', { things: needs })}
        </p>
      </div>

      <div className="px-2">
        <Button
          variant="light"
          className="w-full"
          aria-label={t('library.start', { name })}
          onClick={(event) => onStart(skill.id, cardOf(event.currentTarget))}
        >
          {t('library.start.short')}
        </Button>
      </div>
    </Card>
  )
}

export function LibraryScreen(): React.JSX.Element {
  const go = useNavigation((state) => state.go)
  const selectSkill = useSession((state) => state.selectSkill)
  const skills = useSkills((state) => state.skills)
  const [channel, setChannel] = useState<SkillChannel | null>(null)
  const [category, setCategory] = useState<LibraryCategory | null>(null)

  const start = (skillId: string, card: Element | null): void => {
    startWithExpand(card, () => {
      selectSkill(skillId)
      go('calibration')
    })
  }

  const shown = filterSkills(skills.map(toLibrarySkill), { channel, category })

  return (
    <section className="mx-auto flex h-full w-full max-w-[82rem] flex-col gap-5 self-start overflow-y-auto px-8 pt-7 pb-12">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-sm text-mut">{t('screen.library.title')}</p>
          <h1 className="mt-1.5 font-display text-[2.125rem] leading-tight font-semibold tracking-tight">
            {t('library.title')}
          </h1>
        </div>
        <button
          type="button"
          onClick={() => go('skillNew')}
          className="inline-flex h-12 items-center gap-2.5 rounded-full border border-brand/50 bg-brand/8 px-5 text-[0.9375rem] font-semibold text-accent transition-colors hover:bg-brand/14"
        >
          <CoachAvatar size={22} />
          {t('library.create')}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div
          role="group"
          aria-label={t('library.filter.channels')}
          className="flex flex-wrap gap-1.5"
        >
          <FilterPill pressed={channel === null} onClick={() => setChannel(null)}>
            {t('library.filter.allChannels')}
          </FilterPill>
          {CHANNEL_ORDER.map((item) => (
            <FilterPill key={item} pressed={channel === item} onClick={() => setChannel(item)}>
              <span
                aria-hidden="true"
                className={`size-2 rounded-full ${CHANNEL_LOOK[item].fill}`}
              />
              {t(CHANNEL_LOOK[item].label)}
            </FilterPill>
          ))}
        </div>
        <span aria-hidden="true" className="h-6 w-px bg-line/10" />
        <div
          role="group"
          aria-label={t('library.filter.categories')}
          className="flex flex-wrap gap-1.5"
        >
          <FilterPill pressed={category === null} onClick={() => setCategory(null)}>
            {t('library.filter.allCategories')}
          </FilterPill>
          {FILTER_CATEGORIES.map((item) => (
            <FilterPill key={item} pressed={category === item} onClick={() => setCategory(item)}>
              {t(CATEGORY_LABEL[item])}
            </FilterPill>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <p
          role="status"
          className="rounded-3xl border border-dashed border-line/10 p-14 text-center text-mut"
        >
          {t('library.empty')}
        </p>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(17rem,1fr))] gap-4.5">
          {shown.map((entry) => (
            <li key={entry.skill.id} className="flex">
              <SkillCard entry={entry} onStart={start} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
