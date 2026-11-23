import type { JSX } from 'react'
import type { SkillChannel } from '@shared/skill/skillChannels'

// The picture of each skill that comes with the app, for the library and the dashboard. It is drawn
// with the colours of the theme (the figure with the text colour, the rest with the colour of the
// channel), so it reads on the light theme as well as on the dark one. The background is the
// circle that holds it. A skill that has none (one the coach made) is drawn with its channels.
export const PICTURES: Record<string, JSX.Element> = {
  bicep_curl: (
    <>
      <circle cx="100" cy="100" r="86" fill="none" stroke="var(--line)" strokeOpacity="0.12" />
      <circle
        cx="100"
        cy="100"
        r="66"
        fill="none"
        stroke="var(--line)"
        strokeOpacity="0.08"
        strokeDasharray="2 6"
      />
      <ellipse cx="100" cy="160" rx="54" ry="7" fill="#F08A6A" opacity="0.35" />
      <path
        d="M98 68 L94 104 L96 132"
        stroke="var(--line)"
        strokeOpacity="0.45"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M100 60 V108 M100 108 L90 154 M100 108 L110 154"
        stroke="var(--line)"
        strokeWidth="5.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx="100" cy="46" r="10" fill="var(--line)" />
      <path
        d="M100 68 L104 102 L122 72"
        stroke="var(--line)"
        strokeWidth="5.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path d="M114 67 L130 77" stroke="var(--line)" strokeWidth="7" strokeLinecap="round" />
      <circle cx="100" cy="68" r="5" fill="#F08A6A" stroke="var(--line)" strokeWidth="2" />
      <circle cx="104" cy="102" r="5" fill="#F08A6A" stroke="var(--line)" strokeWidth="2" />
      <circle cx="122" cy="72" r="5" fill="#F08A6A" stroke="var(--line)" strokeWidth="2" />
    </>
  ),
  guitar_posture: (
    <>
      <circle cx="100" cy="100" r="86" fill="none" stroke="var(--line)" strokeOpacity="0.12" />
      <circle
        cx="100"
        cy="100"
        r="66"
        fill="none"
        stroke="var(--line)"
        strokeOpacity="0.08"
        strokeDasharray="2 6"
      />

      <ellipse cx="100" cy="160" rx="54" ry="7" fill="#F2C46B" opacity="0.35" />
      <g>
        <circle cx="80" cy="50" r="10" fill="var(--line)" />
        <path
          d="M80 64 L78 110 L118 112 L118 150 M70 150 H96 M78 110 V150"
          stroke="var(--line)"
          strokeWidth="5.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <g transform="rotate(-28 112 104)">
          <ellipse
            cx="104"
            cy="104"
            rx="20"
            ry="16"
            fill="#F2C46B"
            stroke="var(--line)"
            strokeWidth="3"
          />
          <ellipse
            cx="128"
            cy="104"
            rx="14"
            ry="12"
            fill="#F2C46B"
            stroke="var(--line)"
            strokeWidth="3"
          />
          <circle cx="114" cy="104" r="5" fill="#2A1420" />
          <path d="M140 104 H178" stroke="var(--line)" strokeWidth="5" strokeLinecap="round" />
        </g>
        <path
          d="M80 76 L104 98 M80 76 L126 84"
          stroke="var(--line)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <circle cx="80" cy="64" r="4.5" fill="#F08A6A" stroke="var(--line)" strokeWidth="2" />
        <circle cx="78" cy="110" r="4.5" fill="#F08A6A" stroke="var(--line)" strokeWidth="2" />
        <circle cx="104" cy="98" r="3.5" fill="#B48AE0" stroke="var(--line)" strokeWidth="2" />
      </g>
    </>
  ),
  piano_hand: (
    <>
      <circle cx="100" cy="100" r="86" fill="none" stroke="var(--line)" strokeOpacity="0.12" />
      <circle
        cx="100"
        cy="100"
        r="66"
        fill="none"
        stroke="var(--line)"
        strokeOpacity="0.08"
        strokeDasharray="2 6"
      />

      <ellipse cx="100" cy="160" rx="54" ry="7" fill="#B48AE0" opacity="0.35" />
      <g>
        <rect
          x="44"
          y="124"
          width="15"
          height="38"
          rx="3"
          fill="#FFF2E4"
          stroke="var(--line)"
          strokeOpacity="0.45"
          opacity="0.92"
        />
        <rect
          x="60.5"
          y="124"
          width="15"
          height="38"
          rx="3"
          fill="#FFF2E4"
          stroke="var(--line)"
          strokeOpacity="0.45"
          opacity="0.92"
        />
        <rect
          x="77"
          y="124"
          width="15"
          height="38"
          rx="3"
          fill="#FFF2E4"
          stroke="var(--line)"
          strokeOpacity="0.45"
          opacity="0.92"
        />
        <rect
          x="93.5"
          y="124"
          width="15"
          height="38"
          rx="3"
          fill="#FFF2E4"
          stroke="var(--line)"
          strokeOpacity="0.45"
          opacity="0.92"
        />
        <rect
          x="110"
          y="124"
          width="15"
          height="38"
          rx="3"
          fill="#FFF2E4"
          stroke="var(--line)"
          strokeOpacity="0.45"
          opacity="0.92"
        />
        <rect
          x="126.5"
          y="124"
          width="15"
          height="38"
          rx="3"
          fill="#FFF2E4"
          stroke="var(--line)"
          strokeOpacity="0.45"
          opacity="0.92"
        />
        <rect
          x="143"
          y="124"
          width="15"
          height="38"
          rx="3"
          fill="#FFF2E4"
          stroke="var(--line)"
          strokeOpacity="0.45"
          opacity="0.92"
        />
        <rect x="55" y="124" width="9" height="22" rx="2" fill="#2A1420" />
        <rect x="71.5" y="124" width="9" height="22" rx="2" fill="#2A1420" />
        <rect x="104.5" y="124" width="9" height="22" rx="2" fill="#2A1420" />
        <rect x="121" y="124" width="9" height="22" rx="2" fill="#2A1420" />
        <rect x="137.5" y="124" width="9" height="22" rx="2" fill="#2A1420" />
        <path
          d="M60 116 C66 82 92 70 120 76 C142 82 150 100 144 116"
          stroke="var(--line)"
          strokeWidth="5.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <path
          d="M80 94 Q82 110 86 122 M98 86 Q100 106 102 122 M116 86 Q118 106 118 122 M132 94 Q134 108 134 120"
          stroke="var(--line)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <circle cx="86" cy="122" r="3.5" fill="#B48AE0" stroke="var(--line)" strokeWidth="2" />
        <circle cx="102" cy="122" r="3.5" fill="#B48AE0" stroke="var(--line)" strokeWidth="2" />
        <circle cx="118" cy="122" r="3.5" fill="#B48AE0" stroke="var(--line)" strokeWidth="2" />
        <circle cx="134" cy="120" r="3.5" fill="#B48AE0" stroke="var(--line)" strokeWidth="2" />
      </g>
    </>
  ),
  pushup: (
    <>
      <circle cx="100" cy="100" r="86" fill="none" stroke="var(--line)" strokeOpacity="0.12" />
      <circle
        cx="100"
        cy="100"
        r="66"
        fill="none"
        stroke="var(--line)"
        strokeOpacity="0.08"
        strokeDasharray="2 6"
      />

      <ellipse cx="100" cy="160" rx="54" ry="7" fill="#F08A6A" opacity="0.35" />
      <g>
        <circle cx="150" cy="92" r="9" fill="var(--line)" />
        <path
          d="M138 104 L50 132"
          stroke="var(--line)"
          strokeWidth="5.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <path
          d="M136 104 L138 138"
          stroke="var(--line)"
          strokeWidth="5.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <path
          d="M30 140 H170"
          stroke="var(--line)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          opacity="0.35"
        />
        <circle cx="138" cy="104" r="4.5" fill="#F08A6A" stroke="var(--line)" strokeWidth="2" />
        <circle cx="94" cy="118" r="4.5" fill="#F08A6A" stroke="var(--line)" strokeWidth="2" />
        <circle cx="50" cy="132" r="4.5" fill="#F08A6A" stroke="var(--line)" strokeWidth="2" />
        <circle cx="138" cy="138" r="4.5" fill="#F08A6A" stroke="var(--line)" strokeWidth="2" />
      </g>
    </>
  ),
  squat: (
    <>
      <circle cx="100" cy="100" r="86" fill="none" stroke="var(--line)" strokeOpacity="0.12" />
      <circle
        cx="100"
        cy="100"
        r="66"
        fill="none"
        stroke="var(--line)"
        strokeOpacity="0.08"
        strokeDasharray="2 6"
      />

      <ellipse cx="100" cy="160" rx="54" ry="7" fill="#F08A6A" opacity="0.35" />
      <g>
        <circle cx="104" cy="56" r="10" fill="var(--line)" />
        <path
          d="M102 70 L88 106 L120 110 L114 146 L128 146"
          stroke="var(--line)"
          strokeWidth="5.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <path
          d="M99 80 L138 84"
          stroke="var(--line)"
          strokeWidth="5.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <path
          d="M88 106 L110 116"
          stroke="var(--line)"
          strokeWidth="5.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          opacity="0.5"
        />
        <circle cx="102" cy="70" r="4.5" fill="#F08A6A" stroke="var(--line)" strokeWidth="2" />
        <circle cx="88" cy="106" r="4.5" fill="#F08A6A" stroke="var(--line)" strokeWidth="2" />
        <circle cx="120" cy="110" r="4.5" fill="#F08A6A" stroke="var(--line)" strokeWidth="2" />
        <circle cx="114" cy="146" r="4.5" fill="#F08A6A" stroke="var(--line)" strokeWidth="2" />
      </g>
    </>
  ),
  string_tuning: (
    <>
      <circle cx="100" cy="100" r="86" fill="none" stroke="var(--line)" strokeOpacity="0.12" />
      <circle
        cx="100"
        cy="100"
        r="66"
        fill="none"
        stroke="var(--line)"
        strokeOpacity="0.08"
        strokeDasharray="2 6"
      />

      <ellipse cx="100" cy="160" rx="54" ry="7" fill="#7FB4E8" opacity="0.35" />
      <g>
        <path
          d="M92 160 V96 L84 40 Q100 30 116 40 L108 96 V160"
          stroke="var(--line)"
          strokeWidth="5"
          strokeLinejoin="round"
          fill="var(--bg)"
          fillOpacity="0.6"
        />
        <circle cx="76" cy="52" r="5" fill="#7FB4E8" />
        <circle cx="124" cy="52" r="5" fill="#7FB4E8" />
        <circle cx="76" cy="66" r="5" fill="#7FB4E8" />
        <circle cx="124" cy="66" r="5" fill="#7FB4E8" />
        <circle cx="76" cy="80" r="5" fill="#7FB4E8" />
        <circle cx="124" cy="80" r="5" fill="#7FB4E8" />
        <path
          d="M96 160 V60 M100 160 V56 M104 160 V60"
          stroke="var(--line)"
          strokeWidth="1.6"
          opacity="0.8"
        />
        <path
          d="M30 128 Q45 112 60 128 T90 128 T120 128 T150 128 T180 128"
          stroke="#7FB4E8"
          strokeWidth="3.5"
          strokeLinecap="round"
          fill="none"
        />
      </g>
    </>
  )
}

// What a skill the coach made gets when it has no picture of its own: one for its channel. The id of
// such a skill is made from what it is about, so it cannot be known here.
export const CHANNEL_PICTURES: Partial<Record<SkillChannel, JSX.Element>> = {
  hands: (
    <>
      <circle cx="100" cy="100" r="86" fill="none" stroke="var(--line)" strokeOpacity="0.12" />
      <circle
        cx="100"
        cy="100"
        r="66"
        fill="none"
        stroke="var(--line)"
        strokeOpacity="0.08"
        strokeDasharray="2 6"
      />
      <ellipse cx="100" cy="160" rx="54" ry="7" fill="#B48AE0" opacity="0.35" />
      <path
        d="M72 148 C66 130 68 112 76 100 L126 100 C134 112 134 130 128 148 Q100 166 72 148 Z"
        fill="var(--line)"
        fillOpacity="0.14"
        stroke="var(--line)"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <path
        d="M84 100 V58 M99 100 V44 M114 100 V52 M127 106 V74 M74 120 L52 96"
        stroke="var(--line)"
        strokeWidth="9"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="84" cy="58" r="4.5" fill="#B48AE0" stroke="var(--line)" strokeWidth="2" />
      <circle cx="99" cy="44" r="4.5" fill="#B48AE0" stroke="var(--line)" strokeWidth="2" />
      <circle cx="114" cy="52" r="4.5" fill="#B48AE0" stroke="var(--line)" strokeWidth="2" />
      <circle cx="127" cy="74" r="4.5" fill="#B48AE0" stroke="var(--line)" strokeWidth="2" />
      <circle cx="52" cy="96" r="4.5" fill="#B48AE0" stroke="var(--line)" strokeWidth="2" />
      <circle cx="100" cy="146" r="4.5" fill="#B48AE0" stroke="var(--line)" strokeWidth="2" />
    </>
  )
}

export function pictureOf(
  skillId: string,
  channels: readonly SkillChannel[] = []
): JSX.Element | null {
  const own = PICTURES[skillId]
  if (own) return own
  const channel = channels.find((candidate) => CHANNEL_PICTURES[candidate])
  return (channel && CHANNEL_PICTURES[channel]) || null
}
