import {
  DEFAULT_SETTINGS,
  SETTING_KEYS,
  settingSchemas,
  type AppSettings,
  type SettingsPatch
} from '@shared/settings'
import type { Database } from './database'

export class SettingsRepository {
  constructor(private readonly db: Database) {}

  // Every setting, with the default for any that is missing or has a value that no longer makes
  // sense (for example one written by another version of the app).
  getAll(): AppSettings {
    const rows = this.db.prepare('SELECT key, value FROM settings').all() as Array<{
      key: string
      value: string
    }>
    const stored = new Map(rows.map((row) => [row.key, row.value]))
    const settings: Record<string, unknown> = { ...DEFAULT_SETTINGS }

    for (const key of SETTING_KEYS) {
      const raw = stored.get(key)
      if (raw === undefined) continue
      const parsed = parseJson(raw)
      const valid = settingSchemas[key].safeParse(parsed)
      if (valid.success) settings[key] = valid.data
    }
    return settings as unknown as AppSettings
  }

  set(patch: SettingsPatch): void {
    const upsert = this.db.prepare(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value'
    )
    this.db.exec('BEGIN')
    try {
      for (const key of SETTING_KEYS) {
        const value = patch[key]
        if (value !== undefined) upsert.run(key, JSON.stringify(value))
      }
      this.db.exec('COMMIT')
    } catch (error) {
      this.db.exec('ROLLBACK')
      throw error
    }
  }

  deleteAll(): void {
    this.db.exec('DELETE FROM settings')
  }
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return undefined
  }
}
