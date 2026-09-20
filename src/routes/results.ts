import type { Request, Response, Router } from 'express'
import { listSubmissionRows, listSubmissionRowsT3 } from '../db.js'
import { getRoomResults } from '../processor.js'
import { isRoomId, ROOM_IDS, ROOMS_LABEL } from '../rooms.js'
import { getRoomResultsT3 } from '../taller3/processor.js'

export function registerResultsRoutes(router: Router): void {
  // La ruta del Taller 1 se queda donde estaba: la app publicada la consume tal
  // cual, y un taller nuevo no es motivo para moverla.
  router.get('/aulas/:roomId/resultados', (req: Request, res: Response) => {
    const roomId = String(req.params.roomId).toUpperCase()
    if (!isRoomId(roomId)) {
      res.status(400).json({ error: `Código de aula inválido. Use ${ROOMS_LABEL}.` })
      return
    }
    const rows = listSubmissionRows()
    const result = getRoomResults(rows, roomId, new Date().toISOString())
    res.json(result)
  })

  router.get('/aulas/:roomId/taller3/resultados', (req: Request, res: Response) => {
    const roomId = String(req.params.roomId).toUpperCase()
    if (!isRoomId(roomId)) {
      res.status(400).json({ error: `Código de aula inválido. Use ${ROOMS_LABEL}.` })
      return
    }
    const rows = listSubmissionRowsT3()
    res.json(getRoomResultsT3(rows, roomId, new Date().toISOString()))
  })

  router.get('/aulas', (_req: Request, res: Response) => {
    const aulas = `(${ROOM_IDS.join('|')})`
    const taller1 = new RegExp(`^${aulas}-T1-S[12]$`)
    const taller3 = new RegExp(`^${aulas}-T3-EQ$`)
    const codigo = (answers: Record<string, string>) =>
      String(answers['Código'] ?? answers.codigo ?? '').trim().toUpperCase()

    const rooms = { taller1: new Set<string>(), taller3: new Set<string>() }
    for (const row of listSubmissionRows()) {
      const code = codigo(row.answers)
      if (taller1.test(code)) rooms.taller1.add(code.replace(/-T1-S[12]$/, ''))
    }
    for (const row of listSubmissionRowsT3()) {
      const code = codigo(row.answers)
      if (taller3.test(code)) rooms.taller3.add(code.replace(/-T3-EQ$/, ''))
    }

    res.json({
      // `rooms` se mantiene para quien ya lo consume: son las del Taller 1.
      rooms: [...rooms.taller1].sort(),
      taller1: [...rooms.taller1].sort(),
      taller3: [...rooms.taller3].sort(),
    })
  })
}
