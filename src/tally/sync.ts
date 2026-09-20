import { config, sourceForFormId, syncableForms, type WorkshopId } from '../config.js'
import { upsertSubmission } from '../db.js'
import { apiResponsesToFields } from './apiToFields.js'
import { extractEmail, fieldsToAnswers } from './parseFields.js'
import type { TallyField, TallySubmissionListResponse, TallySubmissionRecord } from './types.js'

export async function fetchFormSubmissions(formId: string, page = 1, limit = 100): Promise<TallySubmissionListResponse> {
  const url = new URL(`https://api.tally.so/forms/${formId}/submissions`)
  url.searchParams.set('page', String(page))
  url.searchParams.set('limit', String(limit))
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${config.tallyApiKey}`,
      'tally-version': '2025-02-01',
    },
  })
  if (!response.ok) {
    throw new Error(`Tally API ${response.status}: ${await response.text()}`)
  }
  return response.json() as Promise<TallySubmissionListResponse>
}

/**
 * Recorre todos los formularios configurados, de los dos talleres.
 *
 * Es la red de seguridad de los webhooks: si uno se perdió, esto lo recupera.
 * Como `upsertSubmission` es idempotente por `submissionId`, se puede lanzar
 * las veces que haga falta.
 */
export async function syncAllForms(): Promise<{
  inserted: number
  skipped: number
  forms: Record<string, number>
}> {
  const forms: Record<string, number> = {}
  let inserted = 0
  let skipped = 0

  for (const form of syncableForms()) {
    const clave = `${form.workshop}:${form.variant}`
    forms[clave] = 0
    let page = 1
    let hasMore = true
    while (hasMore) {
      const batch = await fetchFormSubmissions(form.formId, page)
      for (const submission of batch.submissions) {
        const saved = storeTallySubmission(submission, form, batch.questions)
        if (saved) {
          inserted++
          forms[clave]++
        } else skipped++
      }
      hasMore = batch.hasMore
      page++
    }
  }

  return { inserted, skipped, forms }
}

function submissionFields(
  submission: Pick<TallySubmissionRecord, 'fields' | 'responses'>,
  questions?: TallySubmissionListResponse['questions'],
): TallyField[] {
  if (submission.fields?.length) return submission.fields
  return apiResponsesToFields(submission.responses, questions)
}

export function storeTallySubmission(
  submission: Pick<TallySubmissionRecord, 'id' | 'formId' | 'createdAt' | 'submittedAt' | 'fields' | 'responses'>,
  sourceHint?: { workshop: WorkshopId; variant: string },
  questions?: TallySubmissionListResponse['questions'],
): boolean {
  const source = sourceHint ?? sourceForFormId(submission.formId)
  if (!source) return false
  const fields = submissionFields(submission, questions)
  const answers = fieldsToAnswers(fields)
  const email = extractEmail(fields, answers)
  if (email) answers.email = email
  return upsertSubmission({
    submissionId: submission.id,
    formId: submission.formId,
    workshop: source.workshop,
    variant: source.variant,
    email,
    answers,
    receivedAt: submission.submittedAt ?? submission.createdAt,
  })
}
