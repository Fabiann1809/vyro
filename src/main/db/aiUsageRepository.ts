import type { Database } from './database'

// How many tokens the AI coach has used each day: only a date and a number. It is not deleted with
// the rest of the data, since erasing it would be a way around the daily limit.
export class AiUsageRepository {
  constructor(private readonly db: Database) {}

  tokensOn(day: string): number {
    const row = this.db.prepare('SELECT tokens FROM ai_usage WHERE day = ?').get(day) as
      { tokens: number } | undefined
    return row?.tokens ?? 0
  }

  add(day: string, tokens: number): void {
    this.db
      .prepare(
        `INSERT INTO ai_usage (day, tokens) VALUES (?, ?)
         ON CONFLICT (day) DO UPDATE SET tokens = tokens + excluded.tokens`
      )
      .run(day, Math.max(0, Math.round(tokens)))
  }
}
