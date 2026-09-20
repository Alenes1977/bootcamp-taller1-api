import { rmSync } from 'node:fs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

/**
 * La frontera entre las pruebas de los días previos y las respuestas del día.
 *
 * Borrar un envío en Tally no borra lo que el webhook ya entregó, así que lo
 * único que separa una cosa de la otra es `RESULTADOS_DESDE`. Esto se prueba
 * contra una base de datos de verdad, en un archivo temporal, porque el filtro
 * vive en la consulta.
 */

const ARCHIVO = './data/test-corte.db'

type Db = typeof import('../src/db.js')
let db: Db

beforeAll(async () => {
  rmSync(ARCHIVO, { force: true })
  process.env.DATABASE_PATH = ARCHIVO
  process.env.RESULTADOS_DESDE = '2026-10-15T06:00:00.000Z'
  db = await import('../src/db.js')

  // El corte va antes de la primera mañana del bootcamp, no entre las dos.
  const envio = (id: string, workshop: 'taller1' | 'taller3', receivedAt: string) =>
    db.upsertSubmission({
      submissionId: id,
      formId: 'form',
      workshop,
      variant: workshop === 'taller1' ? 'A-sin' : 'veredictos',
      email: 'alguien@alumni.unav.es',
      answers: { codigo: workshop === 'taller1' ? '2-T1-S1' : '2-T3-EQ' },
      receivedAt,
    })

  envio('prueba-t3', 'taller3', '2026-09-20T12:06:05.000Z') // prueba de septiembre
  envio('real-t3', 'taller3', '2026-10-16T10:47:00.000Z') // mañana 2
  envio('prueba-t1', 'taller1', '2026-09-13T09:00:00.000Z')
  envio('real-t1', 'taller1', '2026-10-15T10:00:00.000Z') // mañana 1

})

afterAll(() => {
  db.closeDb()
  rmSync(ARCHIVO, { force: true })
  rmSync(`${ARCHIVO}-wal`, { force: true })
  rmSync(`${ARCHIVO}-shm`, { force: true })
})

describe('la fecha de corte', () => {
  it('deja fuera las pruebas anteriores, en los dos talleres', () => {
    expect(db.listSubmissionRowsT3()).toHaveLength(1)
    expect(db.listSubmissionRowsT3()[0].receivedAt).toBe('2026-10-16T10:47:00.000Z')
    expect(db.listSubmissionRows()).toHaveLength(1)
  })

  it('no las borra: siguen en la base para diagnosticar', () => {
    expect(db.countSubmissions()).toBe(4)
    expect(db.listStoredSubmissions().map((envio) => envio.submissionId)).toContain('prueba-t3')
  })

  it('no mezcla los talleres', () => {
    const talleres = new Set(db.listStoredSubmissions().map((envio) => envio.workshop))
    expect([...talleres].sort()).toEqual(['taller1', 'taller3'])
  })
})

describe('el borrado de un envío suelto', () => {
  it('lo quita de la base y dice si existía', () => {
    expect(db.deleteSubmission('prueba-t3')).toBe(true)
    expect(db.deleteSubmission('prueba-t3')).toBe(false)
    expect(db.countSubmissions()).toBe(3)
  })
})
