import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import { config, resultadosDesde, type WorkshopId } from './config.js'
import type { VariantKey } from './items.js'
import type { SubmissionRow } from './processor.js'
import type { SubmissionRowT3 } from './taller3/processor.js'

export interface StoredSubmission {
  submissionId: string
  eventId: string | null
  formId: string
  workshop: WorkshopId
  variant: string
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
  migrateWorkshopColumn(db)
  return db
}

/**
 * La tabla nació cuando el servicio solo conocía el Taller 1, así que todo lo
 * que ya hay dentro es de ese taller: por eso el valor por defecto. La columna
 * se añade en su sitio y no se toca ninguna fila existente.
 */
function migrateWorkshopColumn(database: Database.Database): void {
  const columns = database.prepare('PRAGMA table_info(submissions)').all() as { name: string }[]
  if (columns.some((column) => column.name === 'workshop')) return
  database.exec(`
    ALTER TABLE submissions ADD COLUMN workshop TEXT NOT NULL DEFAULT 'taller1';
    CREATE INDEX IF NOT EXISTS idx_submissions_workshop ON submissions(workshop);
  `)
}

export function upsertSubmission(input: {
  submissionId: string
  eventId?: string | null
  formId: string
  workshop?: WorkshopId
  variant: string
  email: string
  answers: Record<string, string>
  receivedAt: string
}): boolean {
  const stmt = getDb().prepare(`
    INSERT INTO submissions (submission_id, event_id, form_id, workshop, variant, email, answers, received_at)
    VALUES (@submissionId, @eventId, @formId, @workshop, @variant, @email, @answers, @receivedAt)
    ON CONFLICT(submission_id) DO NOTHING
  `)
  const result = stmt.run({
    submissionId: input.submissionId,
    eventId: input.eventId ?? null,
    formId: input.formId,
    workshop: input.workshop ?? 'taller1',
    variant: input.variant,
    email: input.email,
    answers: JSON.stringify(input.answers),
    receivedAt: input.receivedAt,
  })
  return result.changes > 0
}

/**
 * Los envíos que cuentan: los de este taller y posteriores a la fecha de corte.
 *
 * El corte es lo único que separa las pruebas de los días previos de las
 * respuestas del día, porque borrar en Tally no borra lo ya entregado. Sin
 * `RESULTADOS_DESDE` configurado, cuentan todos, que es como estaba antes.
 */
const DESDE = "AND received_at >= @desde"

/** Sin corte configurado, una fecha anterior a cualquier envío: no filtra nada. */
const PRINCIPIO_DE_LOS_TIEMPOS = '0000-01-01T00:00:00.000Z'

function desde(): { desde: string } {
  return { desde: resultadosDesde() ?? PRINCIPIO_DE_LOS_TIEMPOS }
}

export function listSubmissionRows(): SubmissionRow[] {
  const rows = getDb()
    .prepare(
      `SELECT variant, email, answers FROM submissions
       WHERE workshop = 'taller1' ${DESDE} ORDER BY received_at ASC`,
    )
    .all(desde()) as { variant: VariantKey; email: string; answers: string }[]
  return rows.map((row) => ({
    email: row.email,
    variant: row.variant,
    answers: JSON.parse(row.answers) as Record<string, string>,
  }))
}

export function listSubmissionRowsT3(): SubmissionRowT3[] {
  const rows = getDb()
    .prepare(
      `SELECT email, answers, received_at FROM submissions
       WHERE workshop = 'taller3' ${DESDE} ORDER BY received_at ASC`,
    )
    .all(desde()) as { email: string; answers: string; received_at: string }[]
  return rows.map((row) => ({
    email: row.email,
    answers: JSON.parse(row.answers) as Record<string, string>,
    receivedAt: row.received_at,
  }))
}

/** Cierra la conexión. La usan las pruebas para poder borrar su archivo. */
export function closeDb(): void {
  db?.close()
  db = null
}

export function countSubmissions(): number {
  return (getDb().prepare('SELECT COUNT(*) AS n FROM submissions').get() as { n: number }).n
}

/** Borra un envío por su identificador de Tally. Devuelve si existía. */
export function deleteSubmission(submissionId: string): boolean {
  const result = getDb()
    .prepare('DELETE FROM submissions WHERE submission_id = ?')
    .run(submissionId)
  return result.changes > 0
}

export function listStoredSubmissions(limit = 100): StoredSubmission[] {
  const rows = getDb()
    .prepare(
      `SELECT submission_id, event_id, form_id, workshop, variant, email, answers, received_at
       FROM submissions ORDER BY received_at DESC LIMIT ?`,
    )
    .all(limit) as {
    submission_id: string
    event_id: string | null
    form_id: string
    workshop: WorkshopId
    variant: string
    email: string
    answers: string
    received_at: string
  }[]
  return rows.map((row) => ({
    submissionId: row.submission_id,
    eventId: row.event_id,
    formId: row.form_id,
    workshop: row.workshop,
    variant: row.variant,
    email: row.email,
    answers: JSON.parse(row.answers) as Record<string, string>,
    receivedAt: row.received_at,
  }))
}
