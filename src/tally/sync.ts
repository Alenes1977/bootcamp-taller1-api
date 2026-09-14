import { config, variantForFormId } from '../config.js'
import { upsertSubmission } from '../db.js'
import type { VariantKey } from '../items.js'
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

export async function syncAllForms(): Promise<{ inserted: number; skipped: number; forms: Record<VariantKey, number> }> {
  const forms = { 'A-sin': 0, 'A-con': 0, 'B-sin': 0, 'B-con': 0 } satisfies Record<VariantKey, number>
  let inserted = 0
  let skipped = 0

  for (const [variant, formId] of Object.entries(config.formIds) as [VariantKey, string][]) {
    if (!formId) continue
    let page = 1
    let hasMore = true
    while (hasMore) {
      const batch = await fetchFormSubmissions(formId, page)
      for (const submission of batch.submissions) {
        const saved = storeTallySubmission(submission, variant, batch.questions)
        if (saved) {
          inserted++
          forms[variant]++
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
  variantHint?: VariantKey,
  questions?: TallySubmissionListResponse['questions'],
): boolean {
  const variant = variantHint ?? variantForFormId(submission.formId)
  if (!variant) return false
  const fields = submissionFields(submission, questions)
  const answers = fieldsToAnswers(fields)
  const email = extractEmail(fields, answers)
  if (email) answers.email = email
  return upsertSubmission({
    submissionId: submission.id,
    formId: submission.formId,
    variant,
    email,
    answers,
    receivedAt: submission.submittedAt ?? submission.createdAt,
  })
}
