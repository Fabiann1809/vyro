import { t } from '@renderer/i18n'
import { CHORDS, type ChordName } from '@shared/diagrams'
import { CHART, chordLayout } from './chordLayout'

// What a screen reader says: the name, then what each string does, from the lowest.
function describe(name: ChordName): string {
  const strings = CHORDS[name].frets.map((fret, index) => {
    const string = 6 - index
    if (fret === null) return t('diagram.chord.muted', { string })
    if (fret === 0) return t('diagram.chord.open', { string })
    const finger = CHORDS[name].fingers[index] ?? 0
    return t('diagram.chord.pressed', { string, fret, finger })
  })
  return `${t('diagram.chord.name', { name })}. ${strings.join('. ')}.`
}

// A chord chart: the nut on top, the lowest string on the left, a number in each finger. The
// numbers carry the meaning, not the colour.
export function ChordDiagram({ name }: { name: ChordName }): React.JSX.Element {
  const { stringXs, fretYs, marks, barre } = chordLayout(name)
  const first = stringXs[0] ?? 0
  const last = stringXs[stringXs.length - 1] ?? 0
  const nutY = fretYs[0] ?? 0

  return (
    <figure className="flex w-fit flex-col items-center gap-1 text-t4">
      <figcaption className="font-display text-lg font-semibold text-t1">{name}</figcaption>
      <svg
        role="img"
        aria-label={describe(name)}
        viewBox={`0 0 ${CHART.width} ${CHART.height}`}
        className="h-36 w-auto"
      >
        {fretYs.map((y, index) => (
          <line
            key={`fret-${y}`}
            x1={first}
            x2={last}
            y1={y}
            y2={y}
            stroke="currentColor"
            strokeWidth={index === 0 ? 4 : 1}
            opacity={index === 0 ? 1 : 0.5}
          />
        ))}
        {stringXs.map((x) => (
          <line
            key={`string-${x}`}
            x1={x}
            x2={x}
            y1={nutY}
            y2={fretYs[fretYs.length - 1]}
            stroke="currentColor"
            strokeWidth={1}
            opacity={0.7}
          />
        ))}
        {barre && (
          <rect
            x={barre.x1 - 7}
            y={barre.y - 7}
            width={barre.x2 - barre.x1 + 14}
            height={14}
            rx={7}
            className="fill-brand"
          />
        )}
        {marks.map((mark) => {
          if (mark.type === 'muted') {
            return (
              <path
                key={`mark-${mark.x}`}
                d={`M${mark.x - 4} ${mark.y - 4} L${mark.x + 4} ${mark.y + 4} M${mark.x + 4} ${mark.y - 4} L${mark.x - 4} ${mark.y + 4}`}
                stroke="currentColor"
                strokeWidth={1.6}
                strokeLinecap="round"
              />
            )
          }
          if (mark.type === 'open') {
            return (
              <circle
                key={`mark-${mark.x}`}
                cx={mark.x}
                cy={mark.y}
                r={4.5}
                fill="none"
                stroke="currentColor"
                strokeWidth={1.6}
              />
            )
          }
          return (
            <g key={`mark-${mark.x}`}>
              <circle cx={mark.x} cy={mark.y} r={7.5} className="fill-brand" />
              <text
                x={mark.x}
                y={mark.y + 4}
                textAnchor="middle"
                fontSize={11}
                fontWeight={700}
                className="fill-on-brand"
              >
                {mark.finger}
              </text>
            </g>
          )
        })}
      </svg>
    </figure>
  )
}
