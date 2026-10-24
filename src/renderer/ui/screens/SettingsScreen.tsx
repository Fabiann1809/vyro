import { useState } from 'react'
import { t, type Language, type MessageKey } from '@renderer/i18n'
import type { TextSize } from '@shared/settings'
import { SAMPLE_CLIP_ID } from '@renderer/voice/clipList'
import { voice } from '@renderer/voice'
import { AiSettings } from '../AiSettings'
import { AudioInputPicker } from '../AudioInputPicker'
import { CameraStage } from '../CameraStage'
import { GeneratedSkillsSettings } from '../GeneratedSkillsSettings'
import { Button } from '../kit/Button'
import { Card } from '../kit/Card'
import { FIELD } from '../kit/fields'
import { Switch } from '../kit/Switch'
import { Choice, SettingsCard } from '../settings/SettingsCard'
import { deleteAllData } from '../settingsSync'
import { useSettings } from '../settingsStore'
import { SETTINGS_TABS, useSettingsTab, type SettingsTab } from '../settingsTabStore'
import { THEME_PREFERENCES, useTheme, type ThemePreference } from '../theme'
import { changeTheme } from '../themeTransition'

const TAB_LABEL: Record<SettingsTab, MessageKey> = {
  general: 'settings.tab.general',
  voice: 'settings.voice',
  camera: 'settings.camera',
  microphone: 'settings.microphone',
  ai: 'settings.ai',
  skills: 'settings.tab.skills',
  privacy: 'settings.tab.privacy',
  about: 'settings.tab.about'
}

const TEXT_SIZES: ReadonlyArray<{ id: TextSize; label: MessageKey }> = [
  { id: 'normal', label: 'settings.textSize.normal' },
  { id: 'large', label: 'settings.textSize.large' },
  { id: 'extra-large', label: 'settings.textSize.extraLarge' }
]

const THEME_LABEL: Record<ThemePreference, MessageKey> = {
  dark: 'settings.theme.dark',
  light: 'settings.theme.light',
  system: 'settings.theme.system'
}

const LANGUAGE_LABEL: Record<Language, MessageKey> = {
  es: 'settings.language.es',
  en: 'settings.language.en'
}

function General(): React.JSX.Element {
  const settings = useSettings()
  const preference = useTheme((state) => state.preference)

  return (
    <>
      <SettingsCard title={t('settings.language')}>
        <select
          aria-label={t('settings.language')}
          value={settings.language}
          onChange={(event) => settings.setLanguage(event.target.value as Language)}
          className={`${FIELD} w-60`}
        >
          {(['es', 'en'] as const).map((language) => (
            <option key={language} value={language}>
              {t(LANGUAGE_LABEL[language])}
            </option>
          ))}
        </select>
      </SettingsCard>

      <SettingsCard title={t('settings.appearance')} description={t('settings.appearance.note')}>
        <Choice
          name="theme"
          label={t('settings.appearance')}
          value={preference}
          options={THEME_PREFERENCES.map((option) => ({
            id: option,
            label: t(THEME_LABEL[option])
          }))}
          onChange={changeTheme}
        />
      </SettingsCard>

      <SettingsCard title={t('settings.accessibility')}>
        <p className="text-[0.8125rem] text-mut">{t('settings.textSize')}</p>
        <Choice
          name="text-size"
          label={t('settings.textSize')}
          value={settings.textSize}
          options={TEXT_SIZES.map((option) => ({ id: option.id, label: t(option.label) }))}
          onChange={settings.setTextSize}
        />
        <Switch
          label={t('settings.reduceMotion')}
          checked={settings.reduceMotion}
          onChange={settings.setReduceMotion}
        />
      </SettingsCard>
    </>
  )
}

function Voice(): React.JSX.Element {
  const settings = useSettings()
  const [missing, setMissing] = useState(false)

  const test = (): void => {
    const result = voice.say(
      { clipId: SAMPLE_CLIP_ID, text: t('settings.voice.sample') },
      { language: settings.language, volume: settings.volume }
    )
    setMissing(result === 'silent')
  }

  return (
    <SettingsCard title={t('settings.voice')}>
      <Switch
        label={t('settings.voice.enabled')}
        checked={settings.voiceEnabled}
        onChange={settings.setVoiceEnabled}
      />
      <label className="flex items-center gap-4">
        <span className="text-[0.9375rem]">{t('settings.voice.volume')}</span>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(settings.volume * 100)}
          disabled={!settings.voiceEnabled}
          onChange={(event) => settings.setVolume(Number(event.target.value) / 100)}
          className="w-64 accent-brand"
        />
        <span className="tabular-nums">{Math.round(settings.volume * 100)}%</span>
      </label>
      <Button
        variant="secondary"
        className="self-start"
        disabled={!settings.voiceEnabled}
        onClick={test}
      >
        {t('settings.voice.test')}
      </Button>
      {missing && (
        <p role="status" className="text-sm text-warn-text">
          {t('settings.voice.missing')}
        </p>
      )}
    </SettingsCard>
  )
}

function Privacy(): React.JSX.Element {
  const [step, setStep] = useState<'idle' | 'confirm' | 'done' | 'failed'>('idle')

  const deleteEverything = (): void => {
    deleteAllData(window.api)
      .then(() => setStep('done'))
      .catch(() => setStep('failed'))
  }

  return (
    <SettingsCard title={t('settings.privacy')} description={t('settings.privacy.explanation')}>
      {step === 'confirm' ? (
        <Card
          role="alertdialog"
          aria-label={t('settings.delete.question')}
          className="flex flex-col gap-3 border-bad/40 p-5"
        >
          <p className="font-semibold">{t('settings.delete.question')}</p>
          <div className="flex gap-2.5">
            <Button variant="danger" onClick={deleteEverything}>
              {t('settings.delete.confirm')}
            </Button>
            <Button variant="secondary" onClick={() => setStep('idle')}>
              {t('settings.delete.cancel')}
            </Button>
          </div>
        </Card>
      ) : (
        <Button variant="danger" className="self-start" onClick={() => setStep('confirm')}>
          {t('settings.delete')}
        </Button>
      )}
      {step === 'done' && (
        <p role="status" className="text-sm text-t4">
          {t('settings.delete.done')}
        </p>
      )}
      {step === 'failed' && (
        <p role="alert" className="text-sm text-bad-text">
          {t('settings.delete.failed')}
        </p>
      )}
    </SettingsCard>
  )
}

function About(): React.JSX.Element {
  return (
    <SettingsCard title={t('settings.tab.about')}>
      <p className="text-[0.9375rem] leading-normal text-t4">{t('settings.about.what')}</p>
      <p className="text-[0.9375rem] leading-normal text-t4">{t('settings.about.license')}</p>
      <p className="rounded-2xl bg-sunk p-4 text-sm leading-normal text-t4">
        {t('settings.about.safety')}
      </p>
    </SettingsCard>
  )
}

function Camera(): React.JSX.Element {
  const handControl = useSettings((state) => state.handControl)
  const setHandControl = useSettings((state) => state.setHandControl)

  return (
    <>
      <SettingsCard title={t('settings.camera')}>
        <CameraStage showDevicePicker videoClassName="max-h-60 rounded-2xl" />
      </SettingsCard>
      <SettingsCard title={t('settings.handControl')} description={t('settings.handControl.note')}>
        <Switch
          label={t('settings.handControl.label')}
          checked={handControl}
          onChange={setHandControl}
        />
      </SettingsCard>
    </>
  )
}

const PANEL: Record<SettingsTab, () => React.JSX.Element> = {
  general: General,
  voice: Voice,
  camera: Camera,
  microphone: () => (
    <SettingsCard title={t('settings.microphone')}>
      <AudioInputPicker />
    </SettingsCard>
  ),
  ai: AiSettings,
  skills: () => (
    <div className="flex flex-col gap-3.5">
      <div>
        <h3 className="text-lg font-semibold">{t('settings.skills')}</h3>
      </div>
      <GeneratedSkillsSettings />
    </div>
  ),
  privacy: Privacy,
  about: About
}

export function SettingsScreen(): React.JSX.Element {
  const { tab, setTab } = useSettingsTab()
  const Panel = PANEL[tab]

  return (
    <section className="anim-fade mx-auto grid h-full w-full max-w-275 grid-cols-1 gap-8 self-start overflow-y-auto px-8 pt-7 pb-12 md:grid-cols-[15rem_minmax(0,1fr)]">
      <div className="flex flex-col gap-0.5">
        <h1 className="mb-4.5 font-display text-[2rem] font-bold tracking-[-0.02em]">
          {t('screen.settings.title')}
        </h1>
        <div role="tablist" aria-orientation="vertical" className="flex flex-col gap-0.5">
          {SETTINGS_TABS.map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              id={`settings-tab-${id}`}
              aria-selected={tab === id}
              aria-controls="settings-panel"
              onClick={() => setTab(id)}
              className="flex h-10.5 items-center rounded-2xl border border-transparent px-4 text-left text-sm font-semibold text-mut transition-colors hover:bg-line/6 hover:text-t1 aria-selected:border-brand/35 aria-selected:bg-linear-to-br aria-selected:from-brand/20 aria-selected:to-ch-hands/10 aria-selected:text-t1"
            >
              {t(TAB_LABEL[id])}
            </button>
          ))}
        </div>
      </div>

      <div
        role="tabpanel"
        id="settings-panel"
        aria-labelledby={`settings-tab-${tab}`}
        className="flex flex-col gap-4 md:pt-12"
      >
        <Panel />
      </div>
    </section>
  )
}
