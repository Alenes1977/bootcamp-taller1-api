import type { Request, Response, Router } from 'express'
import { assertAdminKey, hasTallyApi } from '../config.js'
import { countSubmissions, listStoredSubmissions } from '../db.js'
import { syncAllForms } from '../tally/sync.js'

export function registerAdminRoutes(router: Router): void {
  router.post('/admin/sync', async (req: Request, res: Response) => {
    if (!assertAdminKey(req.header('authorization'))) {
      res.status(401).json({ error: 'No autorizado' })
      return
    }
    if (!hasTallyApi()) {
      res.status(503).json({ error: 'Faltan TALLY_API_KEY o IDs de formulario' })
      return
    }
    try {
      const summary = await syncAllForms()
      res.json({ ok: true, totalSubmissions: countSubmissions(), ...summary })
    } catch (error) {
      res.status(502).json({ error: error instanceof Error ? error.message : 'Error de sincronización' })
    }
  })

  router.get('/admin/submissions', (req: Request, res: Response) => {
    if (!assertAdminKey(req.header('authorization'))) {
      res.status(401).json({ error: 'No autorizado' })
      return
    }
    const limit = Math.min(Number(req.query.limit ?? 50), 500)
    res.json({
      total: countSubmissions(),
      recent: listStoredSubmissions(limit).map((s) => ({
        submissionId: s.submissionId,
        variant: s.variant,
        receivedAt: s.receivedAt,
        code: s.answers['Código'] ?? s.answers.codigo ?? '',
        hasEmail: Boolean(s.email),
      })),
    })
  })
}
