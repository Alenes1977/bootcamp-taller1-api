import { describe, expect, it } from 'vitest'
import { AI_USES, FLOW, ITEMS, PREDICTION, type VariantKey } from '../src/items.js'
import { processRows } from '../src/processor.js'

const date = '2026-09-13T12:00:00.000Z'

function row(email: string, variant: VariantKey, code = '2-T1-S1') {
  const v = { 'A-sin': { texto: 'A' as const, condicion: 'sinIA' as const }, 'A-con': { texto: 'A' as const, condicion: 'conIA' as const }, 'B-sin': { texto: 'B' as const, condicion: 'sinIA' as const }, 'B-con': { texto: 'B' as const, condicion: 'conIA' as const } }[variant]
  const flowKey = v.condicion === 'conIA' ? 'conIA' : 'sinIA'
  const answers: Record<string, string> = {
    Código: code,
    Sexo: 'Mujer',
    [PREDICTION]: '5',
    [FLOW[flowKey][0].titulo]: FLOW[flowKey][0].opciones[0],
  }
  ITEMS[v.texto].forEach((item, i) => {
    answers[item.titulo] = item.opciones[i < 4 ? 0 : 1].t
    answers[`Seguridad en la pregunta ${i + 1}`] = 'Seguro'
  })
  return { email, variant, answers }
}

describe('procesador Taller 1', () => {
  it('corrige por texto, empareja y excluye identidad del JSON', () => {
    const result = processRows([row(' Test@example.org ', 'A-sin'), row('test@example.org', 'B-con')], date).rooms['2']
    expect(result.pairs[0].with).toEqual({ score: 4, predicted: 5, sureCorrect: 4, sureWrong: 2 })
    expect(result.participants).toBe(1)
    expect(JSON.stringify(result)).not.toContain('example.org')
  })

  it('cuenta duplicados, incompletos, incoherencias e identidades ausentes', () => {
    const result = processRows(
      [
        row('dup@x.org', 'A-sin'),
        row('dup@x.org', 'A-sin'),
        row('one@x.org', 'A-con'),
        row('bad@x.org', 'A-sin'),
        row('bad@x.org', 'A-con'),
        row('', 'A-sin'),
        row('invalid@x.org', 'A-sin', 'NO'),
      ],
      date,
    )
    expect(result.unassigned).toBe(1)
    expect(result.rooms['2'].quality).toEqual({ duplicates: 1, incomplete: 1, inconsistent: 1, missingIdentity: 1 })
    expect(result.rooms['2'].pairs).toHaveLength(0)
  })

  it('rechaza sexo y códigos distintos, y respuestas vacías', () => {
    for (const mutation of ['sex', 'code', 'answer'] as const) {
      const a = row('x@x.org', 'A-sin')
      const b = row('x@x.org', 'B-con')
      if (mutation === 'sex') b.answers.Sexo = 'Hombre'
      if (mutation === 'code') b.answers['Código'] = '2-T1-S2'
      if (mutation === 'answer') b.answers['Seguridad en la pregunta 1'] = ''
      expect(processRows([a, b], date).rooms['2'].quality.inconsistent).toBe(1)
    }
  })

  it('redacta Otro flujo y campos extra', () => {
    const a = row('x@x.org', 'A-sin')
    const b = row('x@x.org', 'B-con')
    b.answers[FLOW.conIA[0].titulo] = 'Texto privado'
    const result = processRows([a, b], date).rooms['2']
    expect(result.pairs[0].strategy).toBe('Otro flujo')
    expect(JSON.stringify(result)).not.toContain('Texto privado')
  })
})

describe('estrategia IA', () => {
  it('reconoce las opciones literales del formulario', () => {
    expect(AI_USES.length).toBe(6)
  })
})
