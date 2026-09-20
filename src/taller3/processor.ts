import { isRoomId, ROOM_IDS } from '../rooms.js'
import { esDefectuoso, FRAGMENTOS, puntosDe, type Letra } from './solucionario.js'

/**
 * El procesador del Taller 3: de envíos de Tally a la tabla que proyecta el
 * tutor.
 *
 * La unidad es el equipo, no la persona: un solo envío por equipo, con los
 * veinte veredictos. No hay emparejamiento —eso era del Taller 1— y por eso el
 * correo no se usa para nada más que para saber quién envió.
 */

export const CODE_RE = new RegExp(`^(${ROOM_IDS.join('|')})-T3-EQ$`)

export const EQUIPOS_POR_AULA = 10

export interface SubmissionRowT3 {
  email: string
  answers: Record<string, string>
  receivedAt: string
}

export interface EquipoVeredictos {
  equipo: number
  /** Veinte posiciones; `null` es fragmento sin responder. */
  veredictos: (Letra | null)[]
  enviadoAt: string
}

export interface PuntuacionEquipo {
  equipo: number
  puntos: number
  detectados: number
  acusacionesFalsas: number
  avalesFalsos: number
  sinVerificar: number
  respondidos: number
}

export interface RoomQualityT3 {
  /** Envíos con código de aula bueno y sin número de equipo. */
  sinEquipo: number
  /** Equipos que enviaron más de una vez: se conserva el último. */
  duplicados: number
  /** Equipos a los que les falta algún veredicto de los veinte. */
  incompletos: number
}

export interface RoomResultsT3 {
  schemaVersion: 1
  workshop: 'taller3'
  roomId: string
  generatedAt: string
  equipos: EquipoVeredictos[]
  puntuacion: PuntuacionEquipo[]
  entregados: number
  responses: number
  quality: RoomQualityT3
}

/**
 * De lo que Tally devuelve a la letra del veredicto.
 *
 * El texto de las opciones empieza por su letra —«a · Falso o engañoso — …»—,
 * así que eso es lo primero que se mira. Si alguien reordena o reescribe el
 * formulario y se pierde el prefijo, queda la segunda vía: el nombre del
 * veredicto, que está fijado en el diseño y se imprime en la hoja de
 * verificación.
 */
export function letraDeRespuesta(texto: string | undefined): Letra | null {
  const valor = String(texto ?? '').trim().toLowerCase()
  if (!valor) return null

  const prefijo = /^([abcd])\s*(?:[·.)\-:]|\s)/.exec(valor)
  if (prefijo) return prefijo[1] as Letra

  if (valor.includes('falso o engañoso')) return 'a'
  if (valor.includes('sospechoso')) return 'b'
  if (valor.includes('verdadero o respaldado')) return 'c'
  if (valor.includes('no verificado')) return 'd'
  return null
}

/** «A7», «A7.», «A7 · …» → 7. Cualquier otra etiqueta no es un fragmento. */
export function numeroDeFragmento(etiqueta: string): number | null {
  const encontrado = /^a\s*(\d{1,2})\b/.exec(etiqueta.trim().toLowerCase())
  if (!encontrado) return null
  const numero = Number(encontrado[1])
  return numero >= 1 && numero <= FRAGMENTOS ? numero : null
}

function equipoDeRespuesta(answers: Record<string, string>): number | null {
  for (const [etiqueta, valor] of Object.entries(answers)) {
    if (!/equipo/i.test(etiqueta)) continue
    const numero = Number(String(valor).trim())
    if (Number.isInteger(numero) && numero >= 1 && numero <= EQUIPOS_POR_AULA) return numero
  }
  return null
}

function veredictosDeRespuesta(answers: Record<string, string>): (Letra | null)[] {
  const veredictos: (Letra | null)[] = Array.from({ length: FRAGMENTOS }, () => null)
  for (const [etiqueta, valor] of Object.entries(answers)) {
    const numero = numeroDeFragmento(etiqueta)
    if (numero === null) continue
    veredictos[numero - 1] = letraDeRespuesta(valor)
  }
  return veredictos
}

export function puntuarEquipo(equipo: EquipoVeredictos): PuntuacionEquipo {
  const fila: PuntuacionEquipo = {
    equipo: equipo.equipo,
    puntos: 0,
    detectados: 0,
    acusacionesFalsas: 0,
    avalesFalsos: 0,
    sinVerificar: 0,
    respondidos: 0,
  }

  equipo.veredictos.forEach((letra, indice) => {
    if (!letra) return
    const defectuoso = esDefectuoso(indice + 1)
    fila.respondidos++
    fila.puntos += puntosDe(letra, defectuoso)
    if (letra === 'a' && defectuoso) fila.detectados++
    if (letra === 'a' && !defectuoso) fila.acusacionesFalsas++
    if (letra === 'c' && defectuoso) fila.avalesFalsos++
    if (letra === 'd') fila.sinVerificar++
  })

  return fila
}

/** A igualdad de puntos gana el equipo que haya acusado en falso menos veces. */
export function clasificar(equipos: EquipoVeredictos[]): PuntuacionEquipo[] {
  return equipos
    .map(puntuarEquipo)
    .sort(
      (a, b) =>
        b.puntos - a.puntos || a.acusacionesFalsas - b.acusacionesFalsas || a.equipo - b.equipo,
    )
}

function aulaVacia(roomId: string, generatedAt: string): RoomResultsT3 {
  return {
    schemaVersion: 1,
    workshop: 'taller3',
    roomId,
    generatedAt,
    equipos: [],
    puntuacion: [],
    entregados: 0,
    responses: 0,
    quality: { sinEquipo: 0, duplicados: 0, incompletos: 0 },
  }
}

export function getRoomResultsT3(
  rows: SubmissionRowT3[],
  roomId: string,
  generatedAt: string,
): RoomResultsT3 {
  const salida = aulaVacia(roomId, generatedAt)
  if (!isRoomId(roomId)) return salida

  // Un envío por equipo. Si llegan dos, se conserva el último y se cuenta la
  // incidencia: dejar al equipo fuera abriría un hueco en la matriz, y el
  // debate no arranca sin la tabla completa. El tutor ve el recuento y puede
  // preguntar al equipo cuál vale.
  const porEquipo = new Map<number, EquipoVeredictos>()

  for (const row of rows) {
    const code = String(row.answers['Código'] ?? row.answers.codigo ?? row.answers.Codigo ?? '')
      .trim()
      .toUpperCase()
    if (!CODE_RE.test(code)) continue
    if (code.replace(/-T3-EQ$/, '') !== roomId) continue

    salida.responses++
    const equipo = equipoDeRespuesta(row.answers)
    if (equipo === null) {
      salida.quality.sinEquipo++
      continue
    }

    const anterior = porEquipo.get(equipo)
    if (anterior) {
      salida.quality.duplicados++
      if (anterior.enviadoAt > row.receivedAt) continue
    }
    porEquipo.set(equipo, {
      equipo,
      veredictos: veredictosDeRespuesta(row.answers),
      enviadoAt: row.receivedAt,
    })
  }

  salida.equipos = [...porEquipo.values()].sort((a, b) => a.equipo - b.equipo)
  salida.entregados = salida.equipos.length
  salida.quality.incompletos = salida.equipos.filter((equipo) =>
    equipo.veredictos.some((letra) => letra === null),
  ).length
  salida.puntuacion = clasificar(salida.equipos)
  return salida
}

