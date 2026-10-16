import { t, type Language, type MessageKey } from '@renderer/i18n'
import { useState } from 'react'
import { SAMPLE_CLIP_ID } from '@renderer/voice/clipList'
import { voice } from '@renderer/voice'
import { CameraStage } from '../CameraStage'
import { useSettings } from '../settingsStore'
import { THEME_PREFERENCES, useTheme, type ThemePreference } from '../theme'

const THEME_LABEL: Record<ThemePreference, MessageKey> = {
  dark: 'settings.theme.dark',
  light: 'settings.theme.light',
  system: 'settings.theme.system'
}

const LANGUAGE_LABEL: Record<Language, MessageKey> = {
  es: 'settings.language.es',
  en: 'settings.language.en'
}

function Group({
  title,
  children
}: {
  title: MessageKey
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <fieldset className="flex flex-col gap-3 rounded-lg border border-slate-300 p-4 dark:border-slate-700">
      <legend className="px-2 text-lg font-semibold">{t(title)}</legend>
      {children}
    </fieldset>
  )
}

export function SettingsScreen(): React.JSX.Element {
  const settings = useSettings()
  const { preference, setPreference } = useTheme()
  const [voiceMissing, setVoiceMissing] = useState(false)

  const testVoice = (): void => {
    const result = voice.say(
      { clipId: SAMPLE_CLIP_ID, text: t('settings.voice.sample') },
      { language: settings.language, volume: settings.volume }
    )
    setVoiceMissing(result === 'silent')
  }

  return (
    <section className="flex w-full max-w-3xl flex-col gap-5 self-start p-8">
      <h1 className="text-3xl font-semibold">{t('screen.settings.title')}</h1>

      <Group title="settings.language">
        <select
          aria-label={t('settings.language')}
          value={settings.language}
          onChange={(event) => settings.setLanguage(event.target.value as Language)}
          className="w-fit rounded bg-slate-200 px-3 py-2 dark:bg-slate-800"
        >
          {(['es', 'en'] as const).map((language) => (
            <option key={language} value={language}>
              {t(LANGUAGE_LABEL[language])}
            </option>
          ))}
        </select>
      </Group>

      <Group title="settings.voice">
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={settings.voiceEnabled}
            onChange={(event) => settings.setVoiceEnabled(event.target.checked)}
            className="size-5"
          />
          {t('settings.voice.enabled')}
        </label>
        <label className="flex items-center gap-3">
          {t('settings.voice.volume')}
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(settings.volume * 100)}
            disabled={!settings.voiceEnabled}
            onChange={(event) => settings.setVolume(Number(event.target.value) / 100)}
          />
          <span className="tabular-nums">{Math.round(settings.volume * 100)}%</span>
        </label>
        <button
          type="button"
          disabled={!settings.voiceEnabled}
          onClick={testVoice}
          className="w-fit rounded-md bg-slate-200 px-4 py-2 disabled:opacity-50 dark:bg-slate-800"
        >
          {t('settings.voice.test')}
        </button>
        {voiceMissing && <p role="status">{t('settings.voice.missing')}</p>}
      </Group>

      <Group title="settings.appearance">
        <div role="radiogroup" aria-label={t('settings.appearance')} className="flex gap-4">
          {THEME_PREFERENCES.map((option) => (
            <label key={option} className="flex items-center gap-2">
              <input
                type="radio"
                name="theme"
                checked={preference === option}
                onChange={() => setPreference(option)}
              />
              {t(THEME_LABEL[option])}
            </label>
          ))}
        </div>
      </Group>

      <Group title="settings.camera">
        <CameraStage showDevicePicker videoClassName="max-h-60" />
      </Group>
    </section>
  )
}
