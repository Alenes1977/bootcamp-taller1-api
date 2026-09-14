import type { Request, Response, Router } from 'express'
import { config, variantForFormId } from '../config.js'
import { countSubmissions } from '../db.js'
import { extractEmail, fieldsToAnswers } from '../tally/parseFields.js'
import type { TallyWebhookPayload } from '../tally/types.js'
import { verifyTallySignature } from '../tally/verifySignature.js'
import { upsertSubmission } from '../db.js'

export function registerWebhookRoutes(router: Router): void {
  router.post('/webhook/tally', (req: Request, res: Response) => {
    const payload = req.body as TallyWebhookPayload
    if (!payload?.data?.submissionId || !payload?.data?.formId) {
      res.status(400).json({ error: 'Payload inválido' })
      return
    }

    if (config.tallyWebhookSecret) {
      const signature = req.header('tally-signature') ?? req.header('Tally-Signature')
      if (!verifyTallySignature(payload, signature, config.tallyWebhookSecret)) {
        res.status(401).json({ error: 'Firma inválida' })
        return
      }
    }

    const variant = variantForFormId(payload.data.formId)
    if (!variant) {
      res.status(202).json({ ignored: true, reason: 'formId no configurado' })
      return
    }

    const answers = fieldsToAnswers(payload.data.fields)
    const email = extractEmail(payload.data.fields, answers)
    if (email) answers.email = email

    const inserted = upsertSubmission({
      submissionId: payload.data.submissionId,
      eventId: payload.eventId,
      formId: payload.data.formId,
      variant,
      email,
      answers,
      receivedAt: payload.data.createdAt ?? new Date().toISOString(),
    })

    res.status(200).json({
      ok: true,
      inserted,
      submissionId: payload.data.submissionId,
      totalSubmissions: countSubmissions(),
    })
  })
}
