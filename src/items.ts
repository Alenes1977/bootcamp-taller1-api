/** Transcripción de materiales/taller1/google-forms/items.gs */

export const PREDICTION =
  'De las 6 preguntas que vas a responder a continuación, ¿cuántas crees que vas a acertar?'

export const SECURITY_LEVEL_SURE = 'Seguro/a de haber acertado'
export const SECURITY_LEVEL_DOUBT = 'Con dudas'
export const SECURITY_LEVEL_GUESS = 'Respondí casi al azar'

export const SECURITY_LEVELS = [SECURITY_LEVEL_SURE, SECURITY_LEVEL_DOUBT, SECURITY_LEVEL_GUESS] as const

/** Etiquetas del formulario anterior (seguimos aceptándolas al procesar). */
export const LEGACY_SECURITY_LEVELS: Record<string, (typeof SECURITY_LEVELS)[number]> = {
  Seguro: SECURITY_LEVEL_SURE,
  'Lo dudo': SECURITY_LEVEL_DOUBT,
  'He adivinado': SECURITY_LEVEL_GUESS,
}

export function securityQuestionTitle(n: number): string {
  return `¿Cómo de seguro/a estás con tu respuesta anterior? (${n}/6)`
}

export function normalizeSecurityLevel(value: string): (typeof SECURITY_LEVELS)[number] | null {
  const trimmed = value.trim()
  if ((SECURITY_LEVELS as readonly string[]).includes(trimmed)) return trimmed as (typeof SECURITY_LEVELS)[number]
  return LEGACY_SECURITY_LEVELS[trimmed] ?? null
}

export function resolveSecurityAnswer(answers: Record<string, string>, n: number): string {
  const keys = [securityQuestionTitle(n), `Seguridad en la pregunta ${n}`]
  for (const key of keys) {
    const raw = answers[key]?.trim()
    if (raw) return raw
  }
  return ''
}

export type TextKey = 'A' | 'B'
export type VariantKey = 'A-sin' | 'A-con' | 'B-sin' | 'B-con'

export interface ItemOption {
  t: string
  c?: true
}

export interface Item {
  titulo: string
  opciones: ItemOption[]
}

export const VARIANTS: { clave: VariantKey; texto: TextKey; condicion: 'sinIA' | 'conIA' }[] = [
  { clave: 'A-sin', texto: 'A', condicion: 'sinIA' },
  { clave: 'A-con', texto: 'A', condicion: 'conIA' },
  { clave: 'B-sin', texto: 'B', condicion: 'sinIA' },
  { clave: 'B-con', texto: 'B', condicion: 'conIA' },
]

export const ITEMS: Record<TextKey, Item[]> = {
  A: [
    {
      titulo: 'Según el texto, ¿en cuántos fragmentos se conserva el mecanismo?',
      opciones: [{ t: '82', c: true }, { t: '30' }, { t: '223' }, { t: '254' }],
    },
    {
      titulo:
        'Según el texto, la espiral de la parte posterior que servía para llevar la cuenta del ciclo metónico tenía…',
      opciones: [
        { t: 'cinco vueltas y 235 casillas', c: true },
        { t: 'cuatro vueltas y 223 casillas' },
        { t: 'cinco vueltas y 223 casillas' },
        { t: 'cuatro vueltas y 235 casillas' },
      ],
    },
    {
      titulo: 'Según el texto, el recurso llamado «pasador y ranura» consiste en…',
      opciones: [
        {
          t: 'dos ruedas cuyos ejes no coinciden del todo: una lleva un pasador que se desliza por una ranura abierta en la otra y así la arrastra',
          c: true,
        },
        { t: 'una rueda con los dientes de longitud variable, que engranan más o menos según la posición' },
        { t: 'un pasador que bloquea la manivela cuando la aguja llega al final de la espiral' },
        { t: 'una ranura tallada en la esfera posterior por la que se desplaza la aguja del saros' },
      ],
    },
    {
      titulo: 'Según el texto, ¿por qué llama tanto la atención el recurso llamado «pasador y ranura»?',
      opciones: [
        {
          t: 'Porque produce un movimiento que cambia de velocidad sin que ninguna de sus piezas se doble ni se deforme',
          c: true,
        },
        { t: 'Porque permite invertir el giro de la manivela sin dañar los engranajes' },
        { t: 'Porque sustituye los dientes tallados a mano por un sistema sin dientes' },
        { t: 'Porque es la única parte de la máquina que se conserva completa' },
      ],
    },
    {
      titulo: 'Según el texto, ¿por qué la máquina no es un reloj?',
      opciones: [
        {
          t: 'Porque servía para saber en qué punto del cielo estaba cada astro en la fecha que se quisiera, y no para medir el paso del tiempo',
          c: true,
        },
        { t: 'Porque solo servía para el momento presente y no permitía cambiar de fecha' },
        { t: 'Porque las agujas de sus esferas se movían todas al mismo ritmo' },
        { t: 'Porque nunca llegó a funcionar: era una maqueta de demostración' },
      ],
    },
    {
      titulo:
        'Según el texto, ¿qué relación hay entre esta máquina y los relojes astronómicos europeos del siglo XIV?',
      opciones: [
        {
          t: 'Ninguna: los relojes se construyeron sin heredar nada de ella, porque ese conocimiento ya había desaparecido',
          c: true,
        },
        { t: 'Los relojes son el resultado de una mejora continua a partir de mecanismos como este' },
        { t: 'Los relojes se construyeron a partir de las inscripciones recuperadas de la máquina' },
        { t: 'Los relojes son anteriores, y la máquina es una versión simplificada de ellos' },
      ],
    },
  ],
  B: [
    {
      titulo: 'Según el texto, ¿cuántos kilómetros tenía la red de caminos del imperio inca?',
      opciones: [{ t: 'Unos 30.000', c: true }, { t: 'Unos 4.000' }, { t: 'Unos 10.000' }, { t: 'Unos 1.600' }],
    },
    {
      titulo: 'Según el texto, ¿cómo se representa el número 4 en un quipu?',
      opciones: [
        { t: 'Con un nudo largo de cuatro vueltas', c: true },
        { t: 'Con cuatro nudos en ocho' },
        { t: 'Con cuatro nudos simples seguidos' },
        { t: 'Con un nudo simple en la cuarta posición' },
      ],
    },
    {
      titulo: 'Según el texto, en una cuerda colgante las unidades…',
      opciones: [
        {
          t: 'están en la punta de la cuerda, la parte más alejada de la cuerda principal, y las decenas, centenas y millares quedan por encima, cada vez más cerca de ella',
          c: true,
        },
        {
          t: 'ocupan la posición más cercana a la cuerda principal, y las potencias mayores bajan hacia el extremo',
        },
        { t: 'se leen de izquierda a derecha a lo largo de la cuerda principal' },
        { t: 'se distinguen por el color de la cuerda y no por la posición del nudo' },
      ],
    },
    {
      titulo:
        'Según el texto, ¿por qué un dato podía pasar de un nivel administrativo al siguiente sin necesidad de traducirlo?',
      opciones: [
        {
          t: 'Porque la jerarquía administrativa estaba organizada en potencias de diez, igual que las posiciones de una cuerda',
          c: true,
        },
        { t: 'Porque cada khipukamayuq usaba un color de cuerda distinto según su nivel' },
        { t: 'Porque los quipus de los niveles superiores se hacían con cuerdas más gruesas' },
        { t: 'Porque los responsables memorizaban los totales antes de anudarlos' },
      ],
    },
    {
      titulo: 'Según el texto, ¿en qué punto está hoy el desciframiento de los quipus?',
      opciones: [
        { t: 'Sabemos leer los que registran cantidades, pero no los narrativos', c: true },
        { t: 'Sabemos leer los narrativos gracias a las crónicas españolas, pero no los de contabilidad' },
        { t: 'No se ha conseguido descifrar ninguno de los dos tipos' },
        { t: 'Los dos tipos están descifrados desde el estudio de Locke en 1923' },
      ],
    },
    {
      titulo:
        'Según el texto, ¿qué relación hay entre la destrucción ordenada en 1583 y el hecho de que hoy no sepamos leer los quipus narrativos?',
      opciones: [
        {
          t: 'Se conservan más de mil quipus: lo que no llegó hasta nosotros fue la capacidad de interpretarlos',
          c: true,
        },
        { t: 'Se destruyeron casi todos, y por eso no queda material suficiente para descifrarlos' },
        {
          t: 'La Corona española dejó de admitirlos como prueba, y con ello se perdió todo registro de cómo se leían',
        },
        { t: 'Se destruyeron los de contabilidad y solo sobrevivieron los narrativos' },
      ],
    },
  ],
}

export const FLOW = {
  conIA: [
    {
      titulo: '¿Cuál de estos se parece más a lo que hiciste de verdad?',
      opciones: [
        'Leí el texto entero por mi cuenta y después usé la IA para repasar, resolver dudas o pedirle un resumen.',
        'Leí el texto en diagonal y en seguida le pedí a la IA un resumen o un esquema; estudié sobre lo que me dio.',
        'No leí el texto: le pedí directamente a la IA el resumen o el esquema y estudié sobre eso.',
        'Fui alternando: leía una parte, se la comentaba o le preguntaba a la IA, pasaba a la siguiente.',
        'Le pedí a la IA que me hiciera preguntas sobre el texto y me fui autoevaluando con ellas.',
        'Casi no usé la IA: estudié prácticamente como lo habría hecho sin ella.',
      ],
    },
    {
      titulo: '¿Llegaste a leer el texto completo en algún momento?',
      opciones: ['Sí', 'Solo algunas partes', 'No'],
    },
    {
      titulo: '¿Comprobaste en el texto algo que te hubiera dicho la IA?',
      opciones: ['Sí, varias veces', 'Sí, alguna vez', 'No'],
    },
  ],
  sinIA: [
    {
      titulo: '¿Cuál de estos se parece más a lo que hiciste de verdad?',
      opciones: [
        'Leí el texto varias veces seguidas.',
        'Leí y subrayé o marqué lo importante.',
        'Hice un esquema, un resumen o unas notas aparte.',
        'Me tapé el texto y traté de recordar lo que ponía, comprobando después.',
        'Me lo repetí mentalmente o en voz baja hasta retenerlo.',
      ],
    },
  ],
} as const

export const AI_USES = FLOW.conIA[0].opciones
export const READ_FULL_OPTIONS = FLOW.conIA[1].opciones
export const VERIFY_AI_OPTIONS = FLOW.conIA[2].opciones
export const STUDY_NO_AI = FLOW.sinIA[0].opciones
export type ReadFullAnswer = (typeof READ_FULL_OPTIONS)[number]
export type VerifyAiAnswer = (typeof VERIFY_AI_OPTIONS)[number]
