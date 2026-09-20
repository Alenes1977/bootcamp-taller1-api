import { describe, expect, it } from 'vitest'
import {
  clasificar,
  getRoomResultsT3,
  letraDeRespuesta,
  numeroDeFragmento,
  puntuarEquipo,
} from '../src/taller3/processor.js'
import { DEFECTUOSOS, FRAGMENTOS, type Letra } from '../src/taller3/solucionario.js'

const fecha = '2026-10-16T11:07:00.000Z'

/** El texto exacto de las cuatro opciones, tal como lo devuelve Tally. */
const OPCION: Record<Letra, string> = {
  a: 'a · Falso o engañoso — hemos localizado evidencia que lo contradice o que muestra que la conclusión no se sostiene',
  b: 'b · Sospechoso — hemos encontrado indicios concretos, pero la comprobación es insuficiente',
  c: 'c · Verdadero o respaldado — hemos localizado evidencia que sostiene lo afirmado',
  d: 'd · No verificado — no hemos hecho una comprobación suficiente para emitir un juicio',
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
  it('saca la letra del texto completo de la opción', () => {
    expect(letraDeRespuesta(OPCION.a)).toBe('a')
    expect(letraDeRespuesta(OPCION.d)).toBe('d')
  })

  it('aguanta que alguien reescriba el prefijo, mientras quede el nombre del veredicto', () => {
    expect(letraDeRespuesta('Verdadero o respaldado')).toBe('c')
    expect(letraDeRespuesta('Sospechoso')).toBe('b')
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
