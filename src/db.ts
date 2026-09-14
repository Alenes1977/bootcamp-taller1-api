import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import { config } from './config.js'
import type { VariantKey } from './items.js'
import type { SubmissionRow } from './processor.js'

export interface StoredSubmission {
  submissionId: string
  eventId: string | null
  formId: string
  variant: VariantKey
  email: string
  answers: Record<string, string>
  receivedAt: string
}

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (db) return db
  const dir = path.dirname(config.databasePath)
  fs.mkdirSync(dir, { recursive: true })
  db = new Database(config.databasePath)
  db.pragma('journal_mode = WAL')
  db.exec(`
    CREATE TABLE IF NOT EXISTS submissions (
      submission_id TEXT PRIMARY KEY,
      event_id TEXT,
      form_id TEXT NOT NULL,
      variant TEXT NOT NULL,
      email TEXT NOT NULL DEFAULT '',
      answers TEXT NOT NULL,
      received_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_submissions_variant ON submissions(variant);
  `)
  return db
}

export function upsertSubmission(input: {
  submissionId: string
  eventId?: string | null
  formId: string
  variant: VariantKey
  email: string
  answers: Record<string, string>
  receivedAt: string
}): boolean {
  const stmt = getDb().prepare(`
    INSERT INTO submissions (submission_id, event_id, form_id, variant, email, answers, received_at)
    VALUES (@submissionId, @eventId, @formId, @variant, @email, @answers, @receivedAt)
    ON CONFLICT(submission_id) DO NOTHING
  `)
  const result = stmt.run({
    submissionId: input.submissionId,
    eventId: input.eventId ?? null,
    formId: input.formId,
    variant: input.variant,
    email: input.email,
    answers: JSON.stringify(input.answers),
    receivedAt: input.receivedAt,
  })
  return result.changes > 0
}

export function listSubmissionRows(): SubmissionRow[] {
  const rows = getDb()
    .prepare('SELECT variant, email, answers FROM submissions ORDER BY received_at ASC')
    .all() as { variant: VariantKey; email: string; answers: string }[]
  return rows.map((row) => ({
    email: row.email,
    variant: row.variant,
    answers: JSON.parse(row.answers) as Record<string, string>,
  }))
}

export function countSubmissions(): number {
  return (getDb().prepare('SELECT COUNT(*) AS n FROM submissions').get() as { n: number }).n
}

export function listStoredSubmissions(limit = 100): StoredSubmission[] {
  const rows = getDb()
    .prepare(
      `SELECT submission_id, event_id, form_id, variant, email, answers, received_at
       FROM submissions ORDER BY received_at DESC LIMIT ?`,
    )
    .all(limit) as {
    submission_id: string
    event_id: string | null
    form_id: string
    variant: VariantKey
    email: string
    answers: string
    received_at: string
  }[]
  return rows.map((row) => ({
    submissionId: row.submission_id,
    eventId: row.event_id,
    formId: row.form_id,
    variant: row.variant,
    email: row.email,
    answers: JSON.parse(row.answers) as Record<string, string>,
    receivedAt: row.received_at,
  }))
}
