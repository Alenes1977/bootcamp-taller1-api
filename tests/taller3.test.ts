import { describe, expect, it } from 'vitest'
import { formulariosConfigurados } from '../src/config.js'
import { fieldsToAnswers } from '../src/tally/parseFields.js'
import type { TallyField } from '../src/tally/types.js'
import {
  clasificar,
  diagnosticarEnvio,
  getRoomResultsT3,
  letraDeRespuesta,
  numeroDeFragmento,
  puntuarEquipo,
} from '../src/taller3/processor.js'
import { DEFECTUOSOS, FRAGMENTOS, type Letra } from '../src/taller3/solucionario.js'

const fecha = '2026-10-16T11:07:00.000Z'

/**
 * El texto de las cuatro opciones tal como está puesto en el formulario y tal
 * como Tally lo devuelve: sin prefijo de letra. La a, la b, la c y la d son el
 * orden en que están, no algo que el alumno escriba.
 */
const OPCION: Record<Letra, string> = {
  a: 'Falso o engañoso — hemos localizado evidencia que lo contradice o que muestra que la conclusión no se sostiene',
  b: 'Sospechoso — hemos encontrado indicios concretos, pero la comprobación es insuficiente',
  c: 'Verdadero o respaldado — hemos localizado evidencia que sostiene lo afirmado',
  d: 'No verificado — no hemos hecho una comprobación suficiente para emitir un juicio',
}

function envio(
  equipo: number,
  letras: (Letra | null)[],
  { code = '2-T3-EQ', receivedAt = fecha } = {},
) {
  const answers: Record<string, string> = {
    codigo: code,
    'Número de vuestro equipo': String(equipo),
  }
  letras.forEach((letra, indice) => {
    if (letra) answers[`A${indice + 1}`] = OPCION[letra]
  })
  return { email: `equipo${equipo}@alumni.unav.es`, answers, receivedAt }
}

const todos = (letra: Letra) => Array.from({ length: FRAGMENTOS }, () => letra)

describe('lectura de lo que manda Tally', () => {
  it('saca la letra del texto de la opción, que es lo único que Tally manda', () => {
    expect(letraDeRespuesta(OPCION.a)).toBe('a')
    expect(letraDeRespuesta(OPCION.b)).toBe('b')
    expect(letraDeRespuesta(OPCION.c)).toBe('c')
    expect(letraDeRespuesta(OPCION.d)).toBe('d')
  })

  it('le basta con el nombre del veredicto, sin la explicación', () => {
    expect(letraDeRespuesta('Verdadero o respaldado')).toBe('c')
    expect(letraDeRespuesta('Sospechoso')).toBe('b')
  })

  it('no depende de acentos, mayúsculas ni del tipo de guion', () => {
    expect(letraDeRespuesta('FALSO O ENGAÑOSO - hemos localizado evidencia')).toBe('a')
    expect(letraDeRespuesta('falso o enganoso, sin acento')).toBe('a')
    expect(letraDeRespuesta('  No   verificado  ')).toBe('d')
  })

  it('acepta el prefijo de letra por si algún día se escribe en el formulario', () => {
    expect(letraDeRespuesta('a · Falso o engañoso — lo que sea')).toBe('a')
  })

  it('deja el fragmento en blanco cuando no reconoce el texto', () => {
    expect(letraDeRespuesta('')).toBeNull()
    expect(letraDeRespuesta('No lo sabemos')).toBeNull()
  })

  it('reconoce el número de fragmento y descarta las demás preguntas', () => {
    expect(numeroDeFragmento('A1')).toBe(1)
    expect(numeroDeFragmento('A20 · pie del gráfico')).toBe(20)
    expect(numeroDeFragmento('A21')).toBeNull()
    expect(numeroDeFragmento('Número de vuestro equipo')).toBeNull()
  })
})

describe('procesador Taller 3', () => {
  it('coloca a cada equipo en su aula y no en las demás', () => {
    const rows = [envio(1, todos('c')), envio(2, todos('a'), { code: '101-T3-EQ' })]
    expect(getRoomResultsT3(rows, '2', fecha).entregados).toBe(1)
    expect(getRoomResultsT3(rows, '101', fecha).equipos[0].equipo).toBe(2)
    expect(getRoomResultsT3(rows, '4', fecha).entregados).toBe(0)
  })

  it('devuelve los veredictos en crudo, en el orden del informe', () => {
    const letras = todos('d')
    letras[6] = 'a'
    letras[1] = 'c'
    const aula = getRoomResultsT3([envio(3, letras)], '2', fecha)
    expect(aula.equipos[0].veredictos).toHaveLength(FRAGMENTOS)
    expect(aula.equipos[0].veredictos[6]).toBe('a')
    expect(aula.equipos[0].veredictos[1]).toBe('c')
  })

  it('puntúa contra el solucionario y deja en rojo a las dos estrategias perezosas', () => {
    const acusaTodo = puntuarEquipo({ equipo: 1, veredictos: todos('a'), enviadoAt: fecha })
    const avalaTodo = puntuarEquipo({ equipo: 2, veredictos: todos('c'), enviadoAt: fecha })
    expect(acusaTodo.puntos).toBe(-12)
    expect(avalaTodo.puntos).toBe(-12)
    expect(acusaTodo.detectados).toBe(DEFECTUOSOS.length)
    expect(acusaTodo.acusacionesFalsas).toBe(FRAGMENTOS - DEFECTUOSOS.length)
    expect(avalaTodo.avalesFalsos).toBe(DEFECTUOSOS.length)
  })

  it('no resta por marcar «no verificado»', () => {
    expect(puntuarEquipo({ equipo: 1, veredictos: todos('d'), enviadoAt: fecha }).puntos).toBe(0)
  })

  it('desempata por quien acusó en falso menos veces', () => {
    const cazaDos = todos('d')
    cazaDos[6] = 'a'
    cazaDos[9] = 'a'
    const cazaTresYFalla = todos('d')
    cazaTresYFalla[6] = 'a'
    cazaTresYFalla[9] = 'a'
    cazaTresYFalla[10] = 'a'
    cazaTresYFalla[0] = 'a'
    const tabla = clasificar([
      { equipo: 5, veredictos: cazaTresYFalla, enviadoAt: fecha },
      { equipo: 3, veredictos: cazaDos, enviadoAt: fecha },
    ])
    expect(tabla.map((fila) => fila.puntos)).toEqual([6, 6])
    expect(tabla[0].equipo).toBe(3)
  })

  it('conserva el último envío de un equipo que manda dos y cuenta la incidencia', () => {
    const aula = getRoomResultsT3(
      [
        envio(4, todos('c'), { receivedAt: '2026-10-16T10:40:00.000Z' }),
        envio(4, todos('a'), { receivedAt: '2026-10-16T10:46:00.000Z' }),
      ],
      '2',
      fecha,
    )
    expect(aula.entregados).toBe(1)
    expect(aula.quality.duplicados).toBe(1)
    expect(aula.equipos[0].veredictos[0]).toBe('a')
    expect(aula.responses).toBe(2)
  })

  it('acepta una entrega incompleta y la señala, en vez de dejar un hueco en la matriz', () => {
    const letras: (Letra | null)[] = todos('c')
    letras[4] = null
    const aula = getRoomResultsT3([envio(6, letras)], '2', fecha)
    expect(aula.entregados).toBe(1)
    expect(aula.quality.incompletos).toBe(1)
    expect(aula.equipos[0].veredictos[4]).toBeNull()
  })

  it('descarta el envío sin número de equipo y lo cuenta', () => {
    const sinEquipo = envio(1, todos('c'))
    delete sinEquipo.answers['Número de vuestro equipo']
    const aula = getRoomResultsT3([sinEquipo], '2', fecha)
    expect(aula.entregados).toBe(0)
    expect(aula.quality.sinEquipo).toBe(1)
  })

  it('no incluye correos ni texto libre en lo que se publica', () => {
    const json = JSON.stringify(getRoomResultsT3([envio(1, todos('c'))], '2', fecha))
    expect(json).not.toContain('@')
  })
})

describe('de lo que manda Tally a la matriz, sin atajos', () => {
  /** Un envío como el que llega por webhook: la opción viaja por id. */
  function campos(equipo: number, letras: Letra[]): TallyField[] {
    const opciones = (['a', 'b', 'c', 'd'] as Letra[]).map((letra) => ({
      id: `opt-${letra}`,
      text: OPCION[letra],
    }))
    return [
      { key: 'hidden', label: 'codigo', type: 'HIDDEN_FIELDS', value: '2-T3-EQ' },
      {
        key: 'equipo',
        label: 'Número de vuestro equipo',
        type: 'DROPDOWN',
        value: [`opt-e${equipo}`],
        options: [{ id: `opt-e${equipo}`, text: String(equipo) }],
      },
      { key: 'email', label: 'Email', type: 'INPUT_EMAIL', value: 'equipo@alumni.unav.es' },
      ...letras.map((letra, indice) => ({
        key: `q${indice}`,
        label: `A${indice + 1}`,
        type: 'MULTIPLE_CHOICE',
        value: [`opt-${letra}`],
        options: opciones,
      })),
    ]
  }

  it('traduce un envío real a sus veinte veredictos', () => {
    const letras = todos('c')
    letras[6] = 'a'
    letras[10] = 'b'
    letras[19] = 'd'
    const answers = fieldsToAnswers(campos(4, letras))
    const aula = getRoomResultsT3([{ email: '', answers, receivedAt: fecha }], '2', fecha)

    expect(aula.entregados).toBe(1)
    expect(aula.equipos[0].equipo).toBe(4)
    expect(aula.equipos[0].veredictos).toEqual(letras)
    expect(aula.quality.incompletos).toBe(0)
  })

  it('el diagnóstico enseña lo que el servicio entendió y lo que no', () => {
    const answers = fieldsToAnswers(campos(7, todos('c')))
    answers.A3 = 'Ni idea, esto no es una de las cuatro'
    const visto = diagnosticarEnvio({ email: '', answers, receivedAt: fecha })

    expect(visto.codigo).toBe('2-T3-EQ')
    expect(visto.equipo).toBe(7)
    expect(visto.veredictos[2]).toBeNull()
    expect(visto.sinMapear).toEqual(['A3: Ni idea, esto no es una de las cuatro'])
  })
})

describe('configuración del despliegue', () => {
  it('cuenta los formularios de cada taller sin enseñar sus identificadores', () => {
    const antes = process.env.TALLY_FORM_T3_VEREDICTOS
    try {
      const cuenta = formulariosConfigurados()
      expect(Object.keys(cuenta).sort()).toEqual(['taller1', 'taller3'])
      expect(JSON.stringify(cuenta)).not.toContain('yPO7qx')
      expect(cuenta.taller3).toBeLessThanOrEqual(1)
    } finally {
      process.env.TALLY_FORM_T3_VEREDICTOS = antes
    }
  })
})
