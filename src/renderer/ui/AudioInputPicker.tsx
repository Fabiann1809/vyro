import { useEffect, useState } from 'react'
import { t } from '@renderer/i18n'
import { useSettings } from './settingsStore'

interface Input {
  deviceId: string
  label: string
}

// The microphone to use in the skills that listen. The list does not turn the microphone on: names
// only show once the system has allowed it, and until then the inputs are numbered.
export function AudioInputPicker(): React.JSX.Element {
  const audioDeviceId = useSettings((state) => state.audioDeviceId)
  const setAudioDeviceId = useSettings((state) => state.setAudioDeviceId)
  const [inputs, setInputs] = useState<Input[]>([])

  useEffect(() => {
    let cancelled = false
    navigator.mediaDevices
      .enumerateDevices()
      .then((devices) => {
        if (cancelled) return
        setInputs(
          devices
            .filter((device) => device.kind === 'audioinput' && device.deviceId !== '')
            .map(({ deviceId, label }) => ({ deviceId, label }))
        )
      })
      .catch(() => {
        if (!cancelled) setInputs([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <>
      <p>{t('settings.microphone.note')}</p>
      <label className="flex flex-wrap items-center gap-3">
        {t('settings.microphone.choose')}
        <select
          value={audioDeviceId ?? ''}
          onChange={(event) =>
            setAudioDeviceId(event.target.value === '' ? null : event.target.value)
          }
          className="rounded bg-slate-200 px-3 py-2 dark:bg-slate-800"
        >
          <option value="">{t('settings.microphone.default')}</option>
          {inputs.map((input, index) => (
            <option key={input.deviceId} value={input.deviceId}>
              {input.label || t('settings.microphone.fallbackName', { n: index + 1 })}
            </option>
          ))}
        </select>
      </label>
    </>
  )
}
