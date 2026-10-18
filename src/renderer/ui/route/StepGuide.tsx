import { t } from '@renderer/i18n'
import type { Guide } from '@shared/guide'

// The tips of a step, to be read before doing it. Open for the step that is next, folded for the
// rest so that the way stays short. The notice is always there: the tips come from an AI and are
// general orientation, not advice for one body.
export function StepGuide({ guide, open }: { guide: Guide; open: boolean }): React.JSX.Element {
  return (
    <details open={open} className="rounded-xl bg-line/4 px-4 py-3 text-sm">
      <summary className="cursor-pointer font-semibold">
        {t('guide.title')}
        {guide.minutes !== null && (
          <span className="ml-2 font-normal text-mut">
            · {t('guide.minutes', { minutes: guide.minutes })}
          </span>
        )}
      </summary>
      <ul className="mt-2.5 flex list-disc flex-col gap-1.5 pl-5 text-t4">
        {guide.tips.map((tip) => (
          <li key={tip}>{tip}</li>
        ))}
      </ul>
      <p className="mt-3 text-[0.8125rem] text-mut">{t('guide.notice')}</p>
    </details>
  )
}
