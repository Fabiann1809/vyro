import { randomUUID } from 'node:crypto'
import type { Database } from '../db/database'
import type { RemoteStore } from './remote'
import {
  REMOTE_ROW_SCHEMAS,
  TABLE_SPECS,
  type RemoteRow,
  type SyncTable,
  type TableSpec
} from './tables'

const UPLOAD_BATCH = 200
const DOWNLOAD_PAGE = 500
// A download starts a little before where the last one ended, so that a row written by a computer
// whose clock runs a little behind is not missed. Applying a row twice changes nothing.
const OVERLAP_MS = 5 * 60_000
// Moves a step out of the way while the positions of a whole path are being rewritten.
const SHIFT = 10_000_000

// Kept in `sync_state` like the download cursors: a request to erase the cloud copy has to survive
// a restart and a lack of connection, and be remembered until the cloud has done it.
const ERASE_FLAG = '__erase_cloud__'

export interface SyncReport {
  uploaded: number
  downloaded: number
  deleted: number
  // Rows that came down but were left out: not valid, or they do not fit with what is here.
  skipped: number
}

type SqlValue = string | number | null
type LocalRow = Record<string, SqlValue>

// A row is waiting to go up when it has never been uploaded or it changed after it was. `alias` is
// the prefix of the table when the query has a join (such as "t.").
function waiting(spec: TableSpec, alias = ''): string {
  const neverUploaded = spec.key === 'remote_id' ? `${alias}remote_id IS NULL OR ` : ''
  return `(${neverUploaded}${alias}synced_at IS NULL OR ${alias}updated_at > ${alias}synced_at)`
}

const keyColumn = (spec: TableSpec): string => (spec.key === 'remote_id' ? 'remote_id' : 'id')

// Keeps this computer and the cloud account in step (D21): the changes of this computer go up, the
// changes of the others come down, and when both changed the same row the latest change wins. It
// only ever talks to `remote`, and `remote` only ever sees the columns of `tables.ts`.
export class SyncService {
  private running: Promise<SyncReport> | null = null

  constructor(
    private readonly db: Database,
    private readonly remote: RemoteStore
  ) {}

  // Asks for the copy in the cloud to be erased for good (not marked: erased). The next round does
  // it, as soon as there is a connection, and the request is not forgotten until then.
  requestErase(): void {
    this.db
      .prepare('INSERT OR IGNORE INTO sync_state (table_name, pulled_up_to) VALUES (?, 1)')
      .run(ERASE_FLAG)
  }

  private eraseRequested(): boolean {
    return (
      this.db.prepare('SELECT 1 FROM sync_state WHERE table_name = ?').get(ERASE_FLAG) !== undefined
    )
  }

  // Whether anything here is waiting to go up. Cheap: the runner asks it often.
  hasPending(): boolean {
    if (this.eraseRequested()) return true
    const tombstones = this.db.prepare('SELECT 1 FROM sync_tombstones LIMIT 1').get()
    if (tombstones) return true
    return TABLE_SPECS.some((spec) => {
      const where = [waiting(spec), spec.uploadWhere].filter(Boolean).join(' AND ')
      return (
        this.db.prepare(`SELECT 1 FROM ${spec.name} WHERE ${where} LIMIT 1`).get() !== undefined
      )
    })
  }

  // One round: deletes, then new and changed rows, then what the cloud has that this does not. A
  // round that is already going on is the one that answers a second request.
  run(): Promise<SyncReport> {
    this.running ??= this.round().finally(() => {
      this.running = null
    })
    return this.running
  }

  private async round(): Promise<SyncReport> {
    const report: SyncReport = { uploaded: 0, downloaded: 0, deleted: 0, skipped: 0 }
    if (this.eraseRequested()) await this.eraseCloud()
    // Deletes first, so that nothing deleted here comes back. Then what the cloud has, so that a
    // change that is older than the one in the cloud never overwrites it. Then what is new here.
    await this.pushDeletes(report)
    for (const spec of TABLE_SPECS) await this.pull(spec, report)
    for (const spec of TABLE_SPECS) await this.pushRows(spec, report)
    return report
  }

  // Erases the copy in the cloud. What is still kept here (if anything) stops counting as uploaded, so
  // the same round sends it again as new; deletes that were waiting are no longer news.
  private async eraseCloud(): Promise<void> {
    await this.remote.eraseAll()
    this.db.exec('BEGIN')
    try {
      this.db.exec('DELETE FROM sync_tombstones')
      this.db.exec('DELETE FROM sync_state')
      for (const spec of TABLE_SPECS) {
        const forget = spec.key === 'remote_id' ? 'remote_id = NULL, ' : ''
        this.db.exec(`UPDATE ${spec.name} SET ${forget}synced_at = NULL`)
      }
      this.db.exec('COMMIT')
    } catch (error) {
      this.db.exec('ROLLBACK')
      throw error
    }
  }

  // --- going up -----------------------------------------------------------------------------

  private async pushDeletes(report: SyncReport): Promise<void> {
    // Children first: a table never loses its parent while rows still point at it.
    for (const spec of [...TABLE_SPECS].reverse()) {
      const notes = this.db
        .prepare('SELECT id, row_key FROM sync_tombstones WHERE table_name = ? ORDER BY id')
        .all(spec.name) as Array<{ id: number; row_key: string }>
      for (let at = 0; at < notes.length; at += UPLOAD_BATCH) {
        const batch = notes.slice(at, at + UPLOAD_BATCH)
        await this.remote.remove(
          spec.name,
          batch.map((note) => note.row_key),
          Date.now()
        )
        const forget = this.db.prepare('DELETE FROM sync_tombstones WHERE id = ?')
        for (const note of batch) forget.run(note.id)
        report.deleted += batch.length
      }
    }
  }

  private async pushRows(spec: TableSpec, report: SyncReport): Promise<void> {
    this.giveIds(spec)
    const parent = spec.parent
    const columns = spec.columns.map((column) => `t.${column}`).join(', ')
    const join = parent ? `LEFT JOIN ${parent.table} p ON p.id = t.${parent.column}` : ''
    const parentSelect = parent ? ', p.remote_id AS parent_key' : ''
    // A child whose parent has no id in the cloud yet has to wait: the parent goes up first.
    const parentReady = parent ? 'AND p.remote_id IS NOT NULL' : ''
    // `uploadWhere` is only used by a table that has no parent, so it needs no prefix.
    const where = [waiting(spec, 't.'), spec.uploadWhere].filter(Boolean).join(' AND ')
    const select = this.db.prepare(
      `SELECT t.rowid AS local_rowid, t.${keyColumn(spec)} AS row_key, t.updated_at${parentSelect}, ${columns}
       FROM ${spec.name} t ${join}
       WHERE ${where} ${parentReady}
       ORDER BY t.rowid LIMIT ${UPLOAD_BATCH}`
    )
    const markSynced = this.db.prepare(`UPDATE ${spec.name} SET synced_at = ? WHERE rowid = ?`)

    for (;;) {
      const rows = select.all() as LocalRow[]
      if (rows.length === 0) return
      await this.remote.upsert(
        spec.name,
        rows.map((row) => this.toRemote(spec, row))
      )
      // `synced_at` takes the date of the row as it was sent: a change made in the meantime leaves
      // the row waiting again.
      for (const row of rows)
        markSynced.run(row['updated_at'] as number, row['local_rowid'] as number)
      report.uploaded += rows.length
    }
  }

  // Gives the rows that have never been uploaded the id that they will have in the cloud, before
  // anything is sent, so that a retry after a failure sends the same id and not a second copy.
  private giveIds(spec: TableSpec): void {
    if (spec.key !== 'remote_id') return
    const fresh = this.db
      .prepare(`SELECT rowid AS rid FROM ${spec.name} WHERE remote_id IS NULL`)
      .all() as Array<{ rid: number }>
    const give = this.db.prepare(`UPDATE ${spec.name} SET remote_id = ? WHERE rowid = ?`)
    for (const row of fresh) give.run(randomUUID(), row.rid)
  }

  // Only the listed columns, the id, the parent's id and the date: nothing else of the row leaves.
  private toRemote(spec: TableSpec, row: LocalRow): RemoteRow {
    const remote: RemoteRow = { id: row['row_key'] as string }
    if (spec.parent) remote[spec.parent.column] = row['parent_key'] as string
    for (const column of spec.columns) remote[column] = row[column] ?? null
    remote['updated_at'] = row['updated_at'] as number
    return remote
  }

  // --- coming down --------------------------------------------------------------------------

  private async pull(spec: TableSpec, report: SyncReport): Promise<void> {
    const state = this.db
      .prepare('SELECT pulled_up_to FROM sync_state WHERE table_name = ?')
      .get(spec.name) as { pulled_up_to: number } | undefined
    let cursor = state?.pulled_up_to ?? 0
    let since = Math.max(0, cursor - OVERLAP_MS)

    for (;;) {
      const raw = await this.remote.changedSince(spec.name, since, DOWNLOAD_PAGE)
      const rows: RemoteRow[] = []
      for (const candidate of raw) {
        const parsed = REMOTE_ROW_SCHEMAS[spec.name].safeParse(candidate)
        if (parsed.success) rows.push(parsed.data)
        else report.skipped += 1
      }
      this.applyPage(spec, rows, report)

      const newest = rows.reduce((latest, row) => Math.max(latest, Number(row['updated_at'])), 0)
      if (newest > cursor) {
        cursor = newest
        this.db
          .prepare(
            `INSERT INTO sync_state (table_name, pulled_up_to) VALUES (?, ?)
             ON CONFLICT (table_name) DO UPDATE SET pulled_up_to = excluded.pulled_up_to`
          )
          .run(spec.name, cursor)
      }
      // A short page was the last one; a page that did not get any further would never end.
      if (raw.length < DOWNLOAD_PAGE || newest <= since) return
      since = newest
    }
  }

  private applyPage(spec: TableSpec, rows: RemoteRow[], report: SyncReport): void {
    this.db.exec('BEGIN')
    try {
      const mark = (
        this.db.prepare('SELECT coalesce(max(id), 0) AS id FROM sync_tombstones').get() as {
          id: number
        }
      ).id
      const pending = this.deletedHere(spec)
      const plan = rows.map((row) => ({ row, action: this.decide(spec, row, pending) }))

      // The positions of the steps of a path are rewritten all at once, but they can only be applied
      // one by one: the steps that are about to move are put out of the way first.
      if (spec.name === 'path_steps') {
        const moving = plan.filter((entry) => entry.action === 'update')
        const shift = this.db.prepare(
          `UPDATE path_steps SET position = position + ${SHIFT} WHERE remote_id = ?`
        )
        for (const entry of moving) shift.run(entry.row['id'] as string)
      }

      for (const { row, action } of plan) {
        if (action === 'skip') continue
        try {
          if (action === 'insert') this.insert(spec, row)
          else if (action === 'delete') this.erase(spec, row)
          else this.update(spec, row)
          report.downloaded += 1
        } catch {
          // A row that does not fit (for example a position that is taken) is left for a later round.
          report.skipped += 1
        }
      }
      // The deletes that were made to follow the cloud are not news to tell the cloud again.
      this.db.prepare('DELETE FROM sync_tombstones WHERE id > ?').run(mark)
      this.db.exec('COMMIT')
    } catch (error) {
      this.db.exec('ROLLBACK')
      throw error
    }
  }

  // The ids of the rows deleted here whose delete has not reached the cloud: they must not come back.
  private deletedHere(spec: TableSpec): Set<string> {
    const notes = this.db
      .prepare('SELECT row_key FROM sync_tombstones WHERE table_name = ?')
      .all(spec.name) as Array<{ row_key: string }>
    return new Set(notes.map((note) => note.row_key))
  }

  private decide(
    spec: TableSpec,
    row: RemoteRow,
    deleted: Set<string>
  ): 'insert' | 'update' | 'delete' | 'skip' {
    const id = row['id'] as string
    if (deleted.has(id)) return 'skip'
    const exists =
      this.db.prepare(`SELECT 1 FROM ${spec.name} WHERE ${keyColumn(spec)} = ?`).get(id) !==
      undefined
    // A delete wins over any change, whenever it was made: the row is gone for every computer.
    if (row['deleted_at'] !== null && row['deleted_at'] !== undefined)
      return exists ? 'delete' : 'skip'
    if (spec.parent && this.parentId(spec, row) === null) return 'skip'
    const local = this.db
      .prepare(`SELECT updated_at FROM ${spec.name} WHERE ${keyColumn(spec)} = ?`)
      .get(id) as { updated_at: number } | undefined
    if (!local) return 'insert'
    // The latest change wins. When both are the same date there is nothing to bring down.
    return (row['updated_at'] as number) > local.updated_at ? 'update' : 'skip'
  }

  private parentId(spec: TableSpec, row: RemoteRow): number | null {
    if (!spec.parent) return null
    const found = this.db
      .prepare(`SELECT id FROM ${spec.parent.table} WHERE remote_id = ?`)
      .get(row[spec.parent.column] as string) as { id: number } | undefined
    return found?.id ?? null
  }

  private erase(spec: TableSpec, row: RemoteRow): void {
    this.db
      .prepare(`DELETE FROM ${spec.name} WHERE ${keyColumn(spec)} = ?`)
      .run(row['id'] as string)
  }

  private values(spec: TableSpec, row: RemoteRow): SqlValue[] {
    const parent = spec.parent ? [this.parentId(spec, row)] : []
    return [...parent, ...spec.columns.map((column) => row[column] ?? null)]
  }

  private insert(spec: TableSpec, row: RemoteRow): void {
    const columns = [
      ...(spec.parent ? [spec.parent.column] : []),
      ...spec.columns,
      keyColumn(spec),
      'updated_at',
      'synced_at'
    ]
    // What comes down is already in step with the cloud: `synced_at` is its own date.
    const stamp = row['updated_at'] ?? null
    const params: SqlValue[] = [...this.values(spec, row), row['id'] ?? null, stamp, stamp]
    this.db
      .prepare(
        `INSERT INTO ${spec.name} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`
      )
      .run(...params)
  }

  private update(spec: TableSpec, row: RemoteRow): void {
    const columns = [...(spec.parent ? [spec.parent.column] : []), ...spec.columns]
    const assignments = [...columns, 'updated_at', 'synced_at'].map((column) => `${column} = ?`)
    this.db
      .prepare(`UPDATE ${spec.name} SET ${assignments.join(', ')} WHERE ${keyColumn(spec)} = ?`)
      .run(
        ...this.values(spec, row),
        row['updated_at'] as number,
        row['updated_at'] as number,
        row['id'] as string
      )
  }
}

export type { SyncTable }
