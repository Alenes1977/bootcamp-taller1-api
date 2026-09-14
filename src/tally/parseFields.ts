import type { TallyField } from './types.js'

function resolveChoiceText(field: TallyField): string {
  const { value, options } = field
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (!Array.isArray(value) || !options?.length) return ''
  const selected = value[0]
  if (typeof selected === 'string') {
    const match = options.find((o) => o.id === selected)
    return match?.text ?? ''
  }
  return ''
}

function resolveCheckboxText(field: TallyField): string {
  if (typeof field.value === 'string') return field.value
  if (Array.isArray(field.value) && field.options) {
    const ids = field.value.filter((v): v is string => typeof v === 'string')
    return ids
      .map((id) => field.options!.find((o) => o.id === id)?.text ?? '')
      .filter(Boolean)
      .join(', ')
  }
  return ''
}

export function fieldsToAnswers(fields: TallyField[]): Record<string, string> {
  const answers: Record<string, string> = {}
  for (const field of fields) {
    const label = field.label.trim()
    if (!label) continue
    switch (field.type) {
      case 'HIDDEN_FIELDS':
      case 'INPUT_TEXT':
      case 'INPUT_EMAIL':
      case 'TEXTAREA':
      case 'INPUT_NUMBER':
      case 'INPUT_PHONE_NUMBER':
      case 'INPUT_LINK':
        if (field.value != null && field.value !== '') answers[label] = String(field.value)
        break
      case 'LINEAR_SCALE':
      case 'RATING':
        if (field.value != null && field.value !== '') answers[label] = String(field.value)
        break
      case 'MULTIPLE_CHOICE':
      case 'DROPDOWN': {
        const text = resolveChoiceText(field)
        if (text) answers[label] = text
        break
      }
      case 'CHECKBOXES': {
        const text = resolveCheckboxText(field)
        if (text) answers[label] = text
        break
      }
      default:
        break
    }
  }
  return answers
}

export function extractEmail(fields: TallyField[], answers: Record<string, string>): string {
  const emailField = fields.find((f) => f.type === 'INPUT_EMAIL')
  if (emailField?.value) return String(emailField.value).trim().toLowerCase()
  return String(answers.email ?? answers.Email ?? answers.Correo ?? '').trim().toLowerCase()
}

/** Normaliza el campo de código desde hidden field o respuesta visible. */
export function extractCode(answers: Record<string, string>): string {
  return String(answers['Código'] ?? answers.codigo ?? answers.Codigo ?? '').trim().toUpperCase()
}
