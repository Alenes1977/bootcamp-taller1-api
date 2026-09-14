import type { Request, Response, Router } from 'express'
import { listSubmissionRows } from '../db.js'
import { getRoomResults } from '../processor.js'

const ROOM_RE = /^A(0[1-9]|1[0-2])$/

export function registerResultsRoutes(router: Router): void {
  router.get('/aulas/:roomId/resultados', (req: Request, res: Response) => {
    const roomId = String(req.params.roomId).toUpperCase()
    if (!ROOM_RE.test(roomId)) {
      res.status(400).json({ error: 'Código de aula inválido. Use A01–A12.' })
      return
    }
    const rows = listSubmissionRows()
    const result = getRoomResults(rows, roomId, new Date().toISOString())
    res.json(result)
  })

  router.get('/aulas', (_req: Request, res: Response) => {
    const rows = listSubmissionRows()
    const rooms = new Set<string>()
    for (const row of rows) {
      const code = String(row.answers['Código'] ?? row.answers.codigo ?? '').trim().toUpperCase()
      if (/^A(0[1-9]|1[0-2])-T1-S[12]$/.test(code)) rooms.add(code.slice(0, 3))
    }
    res.json({ rooms: [...rooms].sort() })
  })
}
