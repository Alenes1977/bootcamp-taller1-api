import type { Request, Response, Router } from 'express'
import { listSubmissionRows } from '../db.js'
import { getRoomResults } from '../processor.js'

const ROOM_RE = /^(2|4|5|6|8|9|101|102|108|109)$/

export function registerResultsRoutes(router: Router): void {
  router.get('/aulas/:roomId/resultados', (req: Request, res: Response) => {
    const roomId = String(req.params.roomId).toUpperCase()
    if (!ROOM_RE.test(roomId)) {
      res.status(400).json({ error: 'Código de aula inválido. Use 2, 4, 5, 6, 8, 9, 101, 102, 108 o 109.' })
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
      if (/^(2|4|5|6|8|9|101|102|108|109)-T1-S[12]$/.test(code)) rooms.add(code.replace(/-T1-S[12]$/, ''))
    }
    res.json({ rooms: [...rooms].sort() })
  })
}
