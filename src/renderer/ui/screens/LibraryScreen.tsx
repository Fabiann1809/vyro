import { useState } from 'react'
import { currentLanguage, localize, t, type MessageKey } from '@renderer/i18n'
import type { SkillChannel } from '@shared/skill/skillChannels'
import { CHANNEL_LOOK, CHANNEL_ORDER } from '../kit/channels'
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
import { illustrationOf } from '../skillIllustration'
import { useSkills } from '../skillsStore'

const CATEGORY_LABEL: Record<LibraryCategory, MessageKey> = {
  fitness: 'library.category.fitness',
  music: 'library.category.music',
  generated: 'library.category.generated',
  other: 'library.category.other'
}

const PILL =
  'inline-flex h-9 items-center gap-2 rounded-full border border-transparent px-3.5 text-[0.84rem] font-semibold text-mut transition-all duration-200 hover:text-t1 aria-pressed:bg-grad aria-pressed:text-on-brand'

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
  const color = lead ? CHANNEL_LOOK[lead].color : 'var(--mut)'
  const picture = illustrationOf(skill.id)
  const needs = listOf(skillNeeds(skill).map((need) => t(need)))

  return (
    <Card
      data-expand
      className="anim-up group flex w-full flex-col items-center gap-3 rounded-t-[12.5rem] p-4 pb-5 text-center transition duration-300 hover:-translate-y-1.5 hover:border-line/24"
    >
      <div aria-hidden="true" className="relative mb-2.5 aspect-square w-full max-w-50">
        <div
          className="absolute inset-0 overflow-hidden rounded-full border"
          style={{
            borderColor: `color-mix(in oklab, ${color} 45%, transparent)`,
            background: `repeating-linear-gradient(135deg, color-mix(in oklab, var(--line) 6%, transparent) 0 8px, color-mix(in oklab, var(--line) 1.5%, transparent) 8px 16px), radial-gradient(circle at 50% 35%, color-mix(in oklab, ${color} 30%, transparent), transparent 70%)`,
            boxShadow: `inset 0 0 40px color-mix(in oklab, ${color} 30%, transparent), 0 0 46px color-mix(in oklab, ${color} 22%, transparent)`
          }}
        >
          {picture ? (
            <img src={picture} alt="" className="size-full object-cover" />
          ) : (
            <span className="flex size-full items-center justify-center gap-2">
              {channels.map((channel) => (
                <span key={channel} className={CHANNEL_LOOK[channel].text}>
                  <Icon name={CHANNEL_LOOK[channel].icon} className="size-11" strokeWidth={1.2} />
                </span>
              ))}
            </span>
          )}
        </div>
        {category === 'generated' && (
          <span className="absolute top-1.5 left-1/2 flex h-6 -translate-x-1/2 items-center rounded-full border border-dashed border-warn bg-bg px-2.5 text-[0.69rem] font-bold whitespace-nowrap text-warn-text">
            {t('library.badge.experimental')}
          </span>
        )}
        <div className="absolute -bottom-3.5 left-1/2 flex -translate-x-1/2 gap-1">
          {channels.map((channel) => (
            <span
              key={channel}
              className={`flex size-8.5 items-center justify-center rounded-full border-[3px] border-bg ${CHANNEL_LOOK[channel].fill} text-on-brand`}
            >
              <Icon name={CHANNEL_LOOK[channel].icon} className="size-4" strokeWidth={2} />
            </span>
          ))}
        </div>
      </div>

      <p className="text-[0.72rem] font-bold tracking-[0.1em] text-mut uppercase">
        {t(CATEGORY_LABEL[category])}
      </p>
      <h2 className="-mt-1.5 font-display text-xl font-bold">{name}</h2>
      <p className="flex-1 text-[0.84rem] leading-snug text-mut text-pretty">
        {t(skillLine(skill))}
      </p>
      <ul aria-label={t('library.channels.label')} className="sr-only">
        {channels.map((channel) => (
          <li key={channel}>{t(CHANNEL_LOOK[channel].label)}</li>
        ))}
      </ul>
      <p className="text-xs text-mut2">{t('library.needs.label', { things: needs })}</p>
      <button
        type="button"
        aria-label={t('library.start', { name })}
        onClick={(event) => onStart(skill.id, cardOf(event.currentTarget))}
        className="inline-flex h-11 w-full items-center justify-center rounded-full border border-line/14 bg-line/6 text-[0.9rem] font-bold transition duration-200 hover:border-transparent hover:bg-grad hover:text-on-brand focus-visible:bg-grad focus-visible:text-on-brand"
      >
        {t('library.start.short')}
      </button>
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
          <p className="text-[0.8125rem] font-bold tracking-[0.14em] text-accent uppercase">
            {t('screen.library.title')}
          </p>
          <h1 className="mt-2 font-display text-[2.375rem] leading-tight font-bold tracking-[-0.03em]">
            {t('library.title')}
          </h1>
        </div>
        <button
          type="button"
          onClick={() => go('skillNew')}
          className="inline-flex h-13 items-center gap-2.5 rounded-full border border-brand/50 bg-brand/12 pr-5.5 pl-2.5 text-[0.9375rem] font-bold text-accent transition-colors hover:bg-brand/22"
        >
          <CoachAvatar size={22} />
          {t('library.create')}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div
          role="group"
          aria-label={t('library.filter.channels')}
          className="glass flex flex-wrap gap-1 rounded-full p-1.25"
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
        <div
          role="group"
          aria-label={t('library.filter.categories')}
          className="glass flex flex-wrap gap-1 rounded-full p-1.25"
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
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(15.5rem,1fr))] gap-4">
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
