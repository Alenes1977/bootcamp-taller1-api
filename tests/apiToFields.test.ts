import { describe, expect, it } from 'vitest'
import { apiResponsesToFields } from '../src/tally/apiToFields.js'
import { extractEmail, fieldsToAnswers } from '../src/tally/parseFields.js'
import type { TallyApiQuestion } from '../src/tally/types.js'

const questions: TallyApiQuestion[] = [
  {
    id: 'arNO22',
    type: 'HIDDEN_FIELDS',
    fields: [{ title: 'codigo' }],
  },
  {
    id: '6QJDZN',
    type: 'INPUT_EMAIL',
    title: 'Correo institucional',
  },
  {
    id: '79lXN2',
    type: 'MULTIPLE_CHOICE',
    title: 'Sexo',
  },
]

describe('apiResponsesToFields', () => {
  it('convierte responses REST de Tally al formato fields del webhook', () => {
    const fields = apiResponsesToFields(
      [
        { questionId: 'arNO22', answer: { codigo: '2-T1-S1' } },
        { questionId: '6QJDZN', answer: 'angarcia@alumni.unav.es' },
        { questionId: '79lXN2', answer: ['Hombre'] },
      ],
      questions,
    )

    const answers = fieldsToAnswers(fields)
    expect(answers.codigo).toBe('2-T1-S1')
    expect(answers.Sexo).toBe('Hombre')
    expect(extractEmail(fields, answers)).toBe('angarcia@alumni.unav.es')
  })
})
