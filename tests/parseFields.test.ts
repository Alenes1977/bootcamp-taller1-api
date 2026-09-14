import { describe, expect, it } from 'vitest'
import { extractEmail, fieldsToAnswers } from '../src/tally/parseFields.js'
import type { TallyField } from '../src/tally/types.js'

describe('parseFields', () => {
  it('resuelve opciones múltiples por id', () => {
    const fields: TallyField[] = [
      {
        key: 'q1',
        label: 'Sexo',
        type: 'MULTIPLE_CHOICE',
        value: ['opt-b'],
        options: [
          { id: 'opt-a', text: 'Hombre' },
          { id: 'opt-b', text: 'Mujer' },
        ],
      },
      {
        key: 'hidden',
        label: 'codigo',
        type: 'HIDDEN_FIELDS',
        value: 'A07-T1-S2',
      },
      {
        key: 'email',
        label: 'Email',
        type: 'INPUT_EMAIL',
        value: 'alumno@uni.es',
      },
    ]
    const answers = fieldsToAnswers(fields)
    expect(answers.Sexo).toBe('Mujer')
    expect(answers.codigo).toBe('A07-T1-S2')
    expect(extractEmail(fields, answers)).toBe('alumno@uni.es')
  })
})
