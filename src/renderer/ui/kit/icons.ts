// Paths of the icons, drawn on a 16 or 24 unit square with a round stroke (see docs/DESIGN_SYSTEM.md).
// An icon is only a path: <Icon> draws it, so a screen never carries raw SVG data.

export const ICON_PATHS = {
  // The four channels (16 units)
  body: 'M8 2.2a1.8 1.8 0 1 0 0.01 0M8 6.5v7.5M4.5 8.5h7',
  hands: 'M4.5 9V5.5M7 8V3.5M9.5 8V4M12 9V6M4.5 9c0 3.5 1.8 5 4.5 5s3-2 3-5',
  object: 'M4 3.5h8v9H4zM6.5 6.5h3',
  audio: 'M3 6.5v3M5.75 4v8M8.5 2.5v11M11.25 5v6M14 7v2',
  // Marks (16 units)
  check: 'M3.5 8.5l3 3 6-7',
  lock: 'M5 7V5a3 3 0 0 1 6 0v2M4 7h8v6.5H4z',
  send: 'M8 13V3M3.5 7.5L8 3l4.5 4.5',
  mic: 'M8 1.5a2 2 0 0 0-2 2v4a2 2 0 0 0 4 0v-4a2 2 0 0 0-2-2zM4 7.5a4 4 0 0 0 8 0M8 11.5V14.5',
  book: 'M5 4h6v8H5zM7 7h2',
  warning: 'M8 2.5l6 10.5H2zM8 6.5v3M8 11.2v.1',
  // Navigation (24 units)
  chat: 'M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 3.5V17A2.5 2.5 0 0 1 4 14.5z',
  chart: 'M4 20h16M7 16v-5M12 16V6M17 16v-8',
  route:
    'M6 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM8 18h6.5a3.5 3.5 0 0 0 0-7h-5a3.5 3.5 0 0 1 0-7H16',
  library: 'M4 4h6.5v6.5H4zM13.5 4H20v6.5h-6.5zM4 13.5h6.5V20H4zM13.5 13.5H20V20h-6.5z',
  settings: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5.5M12 7.6v.4',
  sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z',
  chevron: 'M15 6l-6 6 6 6',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  shield: 'M12 3l7.5 3v5.5c0 4.5-3.2 8.2-7.5 9.5-4.3-1.3-7.5-5-7.5-9.5V6zM9 12l2 2 4-4',
  offline:
    'M3 3l18 18M8.5 15.5a5 5 0 0 1 7 0M5 12a10 10 0 0 1 4.5-2.6M14.5 9.5A10 10 0 0 1 19 12M2 8.5a15 15 0 0 1 4.3-2.6M10.5 4.6A15 15 0 0 1 22 8.5M12 19.2h.01',
  target:
    'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zM12 7.5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9zM12 11.2a.8.8 0 1 1 0 1.6.8.8 0 0 1 0-1.6z',
  play: 'M8 5.5v13l10.5-6.5z',
  flame:
    'M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-4 2.5-5 .3 2 1.3 3 2.5 3.2C11.5 8.5 12 6 12 3z'
} as const

export type IconName = keyof typeof ICON_PATHS

// Icons that are drawn on a 24 unit square; all the others use 16.
const LARGE_ICONS: ReadonlySet<IconName> = new Set([
  'chat',
  'chart',
  'route',
  'library',
  'settings',
  'info',
  'sun',
  'moon',
  'chevron',
  'flame',
  'arrow',
  'shield',
  'offline',
  'target',
  'play'
])

export const iconViewBox = (name: IconName): string =>
  LARGE_ICONS.has(name) ? '0 0 24 24' : '0 0 16 16'
