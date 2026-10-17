// The four little pictures of "How it works". They are drawn here, with the colours of the interface,
// so that they need no file and work with no network. They only decorate: the words say it all.

const FRAME = 'h-full w-full'

export function ChatIllustration(): React.JSX.Element {
  return (
    <svg viewBox="0 0 220 130" aria-hidden="true" className={FRAME}>
      <rect x={70} y={14} width={130} height={34} rx={17} className="fill-fill" />
      <rect x={86} y={27} width={70} height={8} rx={4} className="fill-mut3" />
      <circle cx={34} cy={78} r={16} className="fill-brand" />
      <circle cx={34} cy={78} r={6} className="fill-none stroke-on-brand" strokeWidth={3} />
      <rect x={58} y={60} width={132} height={40} rx={20} className="fill-card2 stroke-line/12" />
      <circle cx={92} cy={80} r={4} className="fill-brand" />
      <circle cx={108} cy={80} r={4} className="fill-brand opacity-60" />
      <circle cx={124} cy={80} r={4} className="fill-brand opacity-30" />
    </svg>
  )
}

export function RouteIllustration(): React.JSX.Element {
  return (
    <svg viewBox="0 0 220 130" aria-hidden="true" className={FRAME}>
      <path
        d="M30 98 C70 98 60 40 110 40 S150 98 190 52"
        className="fill-none stroke-line/20"
        strokeWidth={3}
        strokeDasharray="2 7"
        strokeLinecap="round"
      />
      <circle cx={30} cy={98} r={11} className="fill-brand" />
      <path
        d="M25 98l3.5 3.5 6.5-7.5"
        className="fill-none stroke-on-brand"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={110} cy={40} r={13} className="fill-bg stroke-brand" strokeWidth={3} />
      <circle cx={190} cy={52} r={11} className="fill-lock stroke-line/15" strokeWidth={1.5} />
      <path
        d="M186 52v-3a4 4 0 0 1 8 0v3M184.500 52h11v7h-11z"
        className="fill-none stroke-mut3"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function SensorsIllustration(): React.JSX.Element {
  return (
    <svg viewBox="0 0 220 130" aria-hidden="true" className={FRAME}>
      <g
        className="fill-none stroke-ch-body"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx={78} cy={24} r={9} />
        <path d="M78 33v34M62 40h32M62 40l-8 22 10 10M94 40l12 16M78 67l-12 4 2 36M78 67l16 6 2 34" />
      </g>
      <g className="fill-ch-hands">
        <circle cx={108} cy={54} r={3} />
        <circle cx={115} cy={50} r={3} />
        <circle cx={121} cy={53} r={3} />
      </g>
      <g className="fill-none stroke-ch-audio" strokeWidth={3} strokeLinecap="round">
        <path d="M146 54v22M158 44v42M170 36v58M182 48v34M194 56v18" />
      </g>
    </svg>
  )
}

export function ChartIllustration(): React.JSX.Element {
  return (
    <svg viewBox="0 0 220 130" aria-hidden="true" className={FRAME}>
      <path d="M20 108h180M20 72h180M20 36h180" className="stroke-line/8" strokeWidth={1} />
      <path
        d="M20 100 L62 88 L104 92 L146 60 L182 30"
        className="fill-none stroke-good"
        strokeWidth={3.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M20 100 L62 88 L104 92 L146 60 L182 30 L182 108 L20 108Z" className="fill-good/10" />
      <circle cx={182} cy={30} r={6} className="fill-good stroke-card" strokeWidth={2.5} />
      <rect x={146} y={6} width={72} height={20} rx={10} className="fill-t1" />
      <rect x={160} y={14} width={44} height={4} rx={2} className="fill-inv" />
    </svg>
  )
}
