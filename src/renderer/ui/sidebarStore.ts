import { create } from 'zustand'

interface SidebarState {
  collapsed: boolean
  toggle: () => void
}

// Only for as long as the app is open: it is a matter of taste, not a setting worth saving.
export const useSidebar = create<SidebarState>((set) => ({
  collapsed: false,
  toggle: () => set((state) => ({ collapsed: !state.collapsed }))
}))
