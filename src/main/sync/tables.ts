import { z } from 'zod'

// Everything that is synced, and nothing else (D21). The columns listed here are the ONLY ones that
// leave this computer; a new column of a table does not travel until it is added here. The chat,
// the AI key, the settings and the count of AI tokens are not in any of these tables.
export const SYNC_TABLES = [
  'sessions',
  'reps',
  'rep_errors',
  'learning_paths',
  'path_steps',
  'custom_skills'
] as const

export type SyncTable = (typeof SYNC_TABLES)[number]

export interface TableSpec {
  name: SyncTable
  // The local column that holds the id of the row in the cloud. A created skill has no such column:
  // its own text id is the key.
  key: 'remote_id' | 'id'
  // The columns copied as they are, in both directions.
  columns: readonly string[]
  // The local column that points at the parent row, and the table it points at. In the cloud the
  // same column holds the id of the parent in the cloud.
  parent?: { column: string; table: SyncTable }
  // An extra condition for the rows that may go up.
  uploadWhere?: string
}

// Parents come before their children, so that a child is never uploaded before its parent.
export const TABLE_SPECS: readonly TableSpec[] = [
  {
    name: 'sessions',
    key: 'remote_id',
    columns: ['skill_id', 'started_at', 'duration_ms', 'score']
  },
  {
    name: 'reps',
    key: 'remote_id',
    columns: ['rep_index', 'quality', 'duration_ms'],
    parent: { column: 'session_id', table: 'sessions' }
  },
  {
    name: 'rep_errors',
    key: 'remote_id',
    columns: ['rule_id'],
    parent: { column: 'rep_id', table: 'reps' }
  },
  { name: 'learning_paths', key: 'remote_id', columns: ['goal', 'created_at', 'status'] },
  {
    name: 'path_steps',
    key: 'remote_id',
    columns: [
      'position',
      'title',
      'description',
      'kind',
      'skill_id',
      'criterion_sessions',
      'criterion_score',
      'done_at',
      'guide_json'
    ],
    parent: { column: 'path_id', table: 'learning_paths' }
  },
  {
    name: 'custom_skills',
    key: 'id',
    columns: ['config_json', 'status', 'created_at'],
    // A draft waits for the person to approve it on this computer: only what was approved travels.
    uploadWhere: "status = 'approved'"
  }
]

export const specOf = (table: SyncTable): TableSpec => {
  const spec = TABLE_SPECS.find((candidate) => candidate.name === table)
  if (!spec) throw new Error(`Unknown table ${table}`)
  return spec
}

// A row as the cloud holds it: the id of the row, the id of the parent, the columns and the date.
export type RemoteRow = Record<string, string | number | null>

// What comes down is not trusted: it is checked before it touches the local database. The sizes are
// generous but finite, so a damaged or tampered row cannot fill the disk.
const text = (max: number): z.ZodString => z.string().max(max)
const int = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
const optionalInt = int.nullable()
const id = z.string().min(1).max(64)
const updatedAt = z.number().int().positive().max(Number.MAX_SAFE_INTEGER)
// When the row was deleted by some computer, or null.
const deletedAt = optionalInt.default(null)

export const REMOTE_ROW_SCHEMAS: Record<SyncTable, z.ZodType<RemoteRow>> = {
  sessions: z.object({
    id,
    skill_id: text(200),
    started_at: int,
    duration_ms: int,
    score: optionalInt,
    updated_at: updatedAt,
    deleted_at: deletedAt
  }),
  reps: z.object({
    id,
    session_id: id,
    rep_index: int,
    quality: text(50),
    duration_ms: int,
    updated_at: updatedAt,
    deleted_at: deletedAt
  }),
  rep_errors: z.object({
    id,
    rep_id: id,
    rule_id: text(200),
    updated_at: updatedAt,
    deleted_at: deletedAt
  }),
  learning_paths: z.object({
    id,
    goal: text(5_000),
    created_at: int,
    status: z.enum(['active', 'completed', 'archived']),
    updated_at: updatedAt,
    deleted_at: deletedAt
  }),
  path_steps: z.object({
    id,
    path_id: id,
    position: int,
    title: text(1_000),
    description: text(10_000),
    kind: z.enum(['skill', 'auxiliary']),
    skill_id: text(200).nullable(),
    criterion_sessions: optionalInt,
    criterion_score: optionalInt,
    done_at: optionalInt,
    guide_json: text(100_000).nullable(),
    updated_at: updatedAt,
    deleted_at: deletedAt
  }),
  custom_skills: z.object({
    id,
    config_json: text(200_000),
    status: z.enum(['draft', 'approved']),
    created_at: int,
    updated_at: updatedAt,
    deleted_at: deletedAt
  })
}
