import { t } from '@renderer/i18n'
import type { DiagramRef } from '@shared/diagrams'
import { ChordDiagram } from './ChordDiagram'
import { KeyboardDiagram } from './KeyboardDiagram'

function Diagram({ diagram }: { diagram: DiagramRef }): React.JSX.Element {
  switch (diagram.kind) {
    case 'chord':
      return <ChordDiagram name={diagram.name} />
    case 'keys':
      return <KeyboardDiagram notes={diagram.notes} />
  }
}

// The diagrams of a step, by what they are. Each kind draws itself from the library.
export function DiagramView({
  diagrams
}: {
  diagrams: readonly DiagramRef[]
}): React.JSX.Element | null {
  if (diagrams.length === 0) return null

  return (
    <div className="mt-3 flex flex-col gap-2">
      <div className="flex flex-wrap gap-5">
        {diagrams.map((diagram) => (
          <Diagram key={JSON.stringify(diagram)} diagram={diagram} />
        ))}
      </div>
      {diagrams.some((diagram) => diagram.kind === 'chord') && (
        <p className="text-[0.8125rem] text-mut">{t('diagram.chord.legend')}</p>
      )}
    </div>
  )
}
