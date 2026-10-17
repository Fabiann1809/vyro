import { useEffect } from 'react'

// Tells the main process that a skill that listens is open, for as long as `listening` is true.
// Without this, the microphone cannot be opened at all.
export function useMicrophoneGate(listening: boolean): void {
  useEffect(() => {
    if (!listening) return
    void window.api.microphone.setOpen(true)
    return () => {
      void window.api.microphone.setOpen(false)
    }
  }, [listening])
}
