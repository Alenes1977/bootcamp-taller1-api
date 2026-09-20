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
 * Tally no manda letras: manda el **texto** de la opción elegida, y en el
 * formulario las cuatro van sin prefijo —la a, la b, la c y la d son el orden en
 * que están puestas, no algo que el alumno escriba—. Así que lo que identifica
 * al veredicto es su nombre, que está fijado en el diseño y se imprime en la
 * hoja de verificación: «falso o engañoso», «sospechoso», «verdadero o
 * respaldado», «no verificado».
 *
 * No se usa la posición de la opción, aunque el orden sea el significado, por
 * dos razones. Una, que la vía de recuperación por API de Tally devuelve el
 * texto sin la lista de opciones, así que la posición no siempre está; y dos,
 * que si alguien reordenase las opciones creyendo que es cosmético, todos los
 * veredictos se invertirían en silencio. Con el nombre, un cambio de orden es
 * inofensivo y un cambio de texto se ve: el fragmento queda en blanco en la
 * matriz.
 *
 * Se acepta además el prefijo «a · …» por si algún día se escribe en el
 * formulario.
 */
export function letraDeRespuesta(texto: string | undefined): Letra | null {
  const valor = normalizar(texto)
  if (!valor) return null

  const prefijo = /^([abcd])\s*(?:[·.)\-:]|\s)/.exec(valor)
  if (prefijo) return prefijo[1] as Letra

  if (valor.includes('falso o enganoso')) return 'a'
  if (valor.includes('sospechoso')) return 'b'
  if (valor.includes('verdadero o respaldado')) return 'c'
  if (valor.includes('no verificado')) return 'd'
  return null
}

/** Minúsculas, sin acentos y con los espacios colapsados. */
function normalizar(texto: string | undefined): string {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
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

/**
 * Qué ha entendido el servicio de un envío concreto.
 *
 * Existe para la respuesta de prueba: se manda una desde el enlace de un aula y
 * se mira aquí si el código llegó relleno, si el equipo se reconoció y si las
 * veinte opciones se tradujeron a su letra. `sinMapear` es la lista de los
 * textos que el servicio no supo interpretar, con su pregunta, que es
 * exactamente lo que habría que corregir en el formulario.
 */
export function diagnosticarEnvio(row: SubmissionRowT3): {
  codigo: string
  equipo: number | null
  veredictos: (Letra | null)[]
  sinMapear: string[]
} {
  const sinMapear: string[] = []
  for (const [etiqueta, valor] of Object.entries(row.answers)) {
    if (numeroDeFragmento(etiqueta) === null) continue
    if (String(valor).trim() && letraDeRespuesta(valor) === null) {
      sinMapear.push(`${etiqueta}: ${valor}`)
    }
  }
  return {
    codigo: String(row.answers['Código'] ?? row.answers.codigo ?? '').trim().toUpperCase(),
    equipo: equipoDeRespuesta(row.answers),
    veredictos: veredictosDeRespuesta(row.answers),
    sinMapear,
  }
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

