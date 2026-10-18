import { localize, t } from '@renderer/i18n'
import type { SkillConfig } from '@shared/skill/skillSchema'
import { DiagramView } from '../diagrams/DiagramView'

// The guide that comes with a skill: how to do it, and what the app does not check, which is left
// to the person. Written by hand, so it carries no notice about an AI.
export function SkillGuide({
  guide,
  open
}: {
  guide: NonNullable<SkillConfig['guide']>
  open: boolean
}): React.JSX.Element {
  return (
    <details open={open} className="rounded-xl bg-line/4 px-4 py-3 text-sm">
      <summary className="cursor-pointer font-semibold">{t('guide.skill.title')}</summary>
      <ul className="mt-2.5 flex list-disc flex-col gap-1.5 pl-5 text-t4">
        {guide.tips.map((tip) => (
          <li key={tip.en}>{localize(tip)}</li>
        ))}
      </ul>
      <DiagramView diagrams={guide.diagrams} />
      {guide.notMeasured.length > 0 && (
        <>
          <p className="mt-3.5 font-semibold">{t('guide.skill.notMeasured')}</p>
          <ul className="mt-1.5 flex list-disc flex-col gap-1.5 pl-5 text-t4">
            {guide.notMeasured.map((item) => (
              <li key={item.en}>{localize(item)}</li>
            ))}
          </ul>
        </>
      )}
      <p className="mt-3 text-[0.8125rem] text-mut">{t('guide.notice')}</p>
    </details>
  )
}
