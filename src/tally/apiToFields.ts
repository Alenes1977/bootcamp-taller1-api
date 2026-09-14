import type { TallyApiQuestion, TallyApiResponse, TallyField } from './types.js'

function hiddenFieldLabel(question: TallyApiQuestion): string {
  return question.fields?.[0]?.title?.trim() || 'codigo'
}

function hiddenFieldValue(answer: unknown): string {
  if (typeof answer === 'string') return answer
  if (answer && typeof answer === 'object' && !Array.isArray(answer)) {
    const record = answer as Record<string, unknown>
    const codigo = record.codigo ?? record.Código ?? record.Codigo
    if (codigo != null) return String(codigo)
    const first = Object.values(record).find((v) => v != null && v !== '')
    return first != null ? String(first) : ''
  }
  return ''
}

function scalarValue(answer: unknown): string | number | '' {
  if (answer == null || answer === '') return ''
  if (typeof answer === 'number') return answer
  if (typeof answer === 'string') return answer
  if (Array.isArray(answer)) {
    const first = answer[0]
    if (first == null || first === '') return ''
    return typeof first === 'number' ? first : String(first)
  }
  return ''
}

/** Convierte el listado REST de Tally (responses + questions) al formato fields del webhook. */
export function apiResponsesToFields(
  responses: TallyApiResponse[] | undefined,
  questions: TallyApiQuestion[] | undefined,
): TallyField[] {
  if (!responses?.length) return []

  const questionById = new Map((questions ?? []).map((question) => [question.id, question]))
  const fields: TallyField[] = []

  for (const response of responses) {
    const question = questionById.get(response.questionId)
    const type = question?.type ?? 'UNKNOWN'
    const label =
      type === 'HIDDEN_FIELDS'
        ? hiddenFieldLabel(question ?? { id: response.questionId, type })
        : String(question?.title ?? question?.fields?.[0]?.title ?? '').trim()

    if (!label && type !== 'HIDDEN_FIELDS') continue

    let value: unknown = response.answer
    if (type === 'HIDDEN_FIELDS') {
      value = hiddenFieldValue(response.answer)
    } else if (type === 'MULTIPLE_CHOICE' || type === 'DROPDOWN' || type === 'CHECKBOXES') {
      value = scalarValue(response.answer)
    } else if (type === 'LINEAR_SCALE' || type === 'RATING') {
      value = scalarValue(response.answer)
    } else if (typeof response.answer === 'string' || typeof response.answer === 'number') {
      value = response.answer
    }

    fields.push({
      key: response.questionId,
      label: label || 'codigo',
      type,
      value,
    })
  }

  return fields
}
