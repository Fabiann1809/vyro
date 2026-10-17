import type { CameraErrorKind } from '@renderer/core/camera'
import { t, type MessageKey } from '@renderer/i18n'

const MESSAGES: Record<CameraErrorKind, { title: MessageKey; body: MessageKey }> = {
  'permission-denied': {
    title: 'camera.error.permissionDenied.title',
    body: 'camera.error.permissionDenied.body'
  },
  'no-device': { title: 'camera.error.noDevice.title', body: 'camera.error.noDevice.body' },
  'in-use': { title: 'camera.error.inUse.title', body: 'camera.error.inUse.body' },
  unknown: { title: 'camera.error.unknown.title', body: 'camera.error.unknown.body' }
}

interface Props {
  kind: CameraErrorKind
  canOpenSettings: boolean
  onRetry: () => void
  onOpenSettings: () => void
}

export function CameraProblem({
  kind,
  canOpenSettings,
  onRetry,
  onOpenSettings
}: Props): React.JSX.Element {
  const message = MESSAGES[kind]

  return (
    <div role="alert" className="flex max-w-md flex-col items-center gap-4 text-center">
      <h2 className="text-2xl font-semibold">{t(message.title)}</h2>
      <p className="text-t4">{t(message.body)}</p>
      <div className="flex gap-3">
        {kind === 'permission-denied' && canOpenSettings && (
          <button
            onClick={onOpenSettings}
            className="rounded-full border border-line/14 px-5 py-2.5 hover:bg-line/5"
          >
            {t('camera.openSettings')}
          </button>
        )}
        <button
          onClick={onRetry}
          className="rounded-full bg-brand px-5 py-2.5 font-semibold text-on-brand"
        >
          {t('camera.retry')}
        </button>
      </div>
    </div>
  )
}
