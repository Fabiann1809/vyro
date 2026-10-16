import type { TextSize } from '@shared/settings'

// The whole interface is sized in rem, so changing the root font size scales all of it.
const ROOT_FONT_SIZE: Record<TextSize, string> = {
  normal: '100%',
  large: '125%',
  'extra-large': '150%'
}

export const rootFontSize = (textSize: TextSize): string => ROOT_FONT_SIZE[textSize]
