import { t } from '@renderer/i18n'
import type { NoteName } from '@shared/diagrams'
import { keyboardLayout, type KeyShape } from './keyboardLayout'

// How a note is called on screen: Do, Re, Mi in Spanish, C, D, E in English.
const noteLabel = (note: NoteName): string => t(`note.${note}`)

function Key({ shape, black }: { shape: KeyShape; black: boolean }): React.JSX.Element {
  const unlit = black ? 'fill-neutral-900' : 'fill-white'
  return (
    <g>
      <rect
        x={shape.x}
        y={4}
        width={shape.width}
        height={shape.height}
        rx={black ? 2 : 3}
        stroke="currentColor"
        strokeWidth={1}
        className={shape.lit ? 'fill-brand' : unlit}
      />
      {shape.lit && (
        <text
          x={shape.x + shape.width / 2}
          y={shape.height - (black ? 4 : 6)}
          textAnchor="middle"
          fontSize={black ? 7 : 9}
          fontWeight={700}
          className="fill-on-brand"
        >
          {noteLabel(shape.note)}
        </text>
      )}
    </g>
  )
}

// One octave of a piano with some keys lit. The notes are also written on the keys and above, so
// the meaning does not rest on the colour alone.
export function KeyboardDiagram({ notes }: { notes: readonly NoteName[] }): React.JSX.Element {
  const { width, height, whites, blacks } = keyboardLayout(notes)
  const names = notes.map(noteLabel).join(', ')

  return (
    <figure className="flex w-fit flex-col items-center gap-1.5 text-t4">
      <figcaption className="text-sm font-semibold text-t1">{names}</figcaption>
      <svg
        role="img"
        aria-label={t('diagram.keys.label', { notes: names })}
        viewBox={`0 0 ${width} ${height}`}
        className="h-28 w-auto"
      >
        {whites.map((shape) => (
          <Key key={shape.note} shape={shape} black={false} />
        ))}
        {blacks.map((shape) => (
          <Key key={shape.note} shape={shape} black />
        ))}
      </svg>
    </figure>
  )
}
