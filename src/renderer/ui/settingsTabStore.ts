import { create } from 'zustand'
import { useNavigation } from './navigation'

export type SettingsTab =
  'general' | 'voice' | 'camera' | 'microphone' | 'ai' | 'skills' | 'privacy' | 'about'

export const SETTINGS_TABS: readonly SettingsTab[] = [
  'general',
  'voice',
  'camera',
  'microphone',
  'ai',
  'skills',
  'privacy',
  'about'
]

interface SettingsTabState {
  tab: SettingsTab
  setTab: (tab: SettingsTab) => void
}

export const useSettingsTab = create<SettingsTabState>((set) => ({
  tab: 'general',
  setTab: (tab) => set({ tab })
}))

// Opens the settings on the part that was asked for: the one that can fix what the person was told.
export function openSettings(tab: SettingsTab = 'general'): void {
  useSettingsTab.getState().setTab(tab)
  useNavigation.getState().go('settings')
}
