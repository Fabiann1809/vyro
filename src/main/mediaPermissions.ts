// Who may use the camera and the microphone. The camera is for the app itself. The microphone is
// for the app too, but only while a skill that listens is open: it is never on in any other screen,
// and nothing outside the app can ever turn it on.

export interface MediaRequest {
  permission: string
  // What the request opens: 'video', 'audio', or both. Missing when the system did not say.
  mediaTypes: readonly string[] | undefined
  // The request comes from the app itself and not from some other page.
  fromApp: boolean
  // A skill that listens is open right now.
  microphoneOpen: boolean
}

export function mayOpenMedia({
  permission,
  mediaTypes,
  fromApp,
  microphoneOpen
}: MediaRequest): boolean {
  if (permission !== 'media' || !fromApp) return false
  if (!mediaTypes || mediaTypes.length === 0) return false
  if (!mediaTypes.every((type) => type === 'video' || type === 'audio')) return false
  return mediaTypes.includes('audio') ? microphoneOpen : true
}

// What the system asks without opening anything (for example, whether the app may list its devices).
// Opening a stream always goes through mayOpenMedia.
export function mayCheckMedia(
  permission: string,
  fromApp: boolean,
  mediaType: string | undefined,
  microphoneOpen: boolean
): boolean {
  if (permission !== 'media' || !fromApp) return false
  return mediaType === 'audio' ? microphoneOpen : true
}

// Whether a skill that listens is open. The page says so when it opens or closes one, and it is
// closed again whenever the page is loaded anew.
export class MicrophoneGate {
  private open = false

  get isOpen(): boolean {
    return this.open
  }

  set(open: boolean): void {
    this.open = open
  }
}
