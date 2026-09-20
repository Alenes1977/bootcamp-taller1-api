import type { VariantKey } from './items.js'

export type WorkshopId = 'taller1' | 'taller3'
export type VariantT3 = 'veredictos'

function required(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Falta la variable de entorno ${name}`)
  return value
}

function optional(name: string, fallback = ''): string {
  return process.env[name]?.trim() ?? fallback
}

export const config = {
  port: Number(process.env.PORT ?? 3000),
  databasePath: optional('DATABASE_PATH', './data/taller1.db'),
  /**
   * Fecha ISO a partir de la cual cuentan los envíos. Lo anterior sigue en la
   * base y no lo ve nadie.
   *
   * Existe porque borrar una respuesta en Tally **no** borra lo que el webhook
   * ya entregó: sin esto, cada prueba de los días previos aparecería el día del
   * taller como un equipo más, con su puntuación, mezclada con las de verdad.
   * Se pone la mañana del taller y se acabó; es reversible, y no destruye los
   * envíos de prueba, que siguen sirviendo para diagnosticar.
   */
  resultadosDesde: optional('RESULTADOS_DESDE'),
  tallyWebhookSecret: optional('TALLY_WEBHOOK_SECRET'),
  tallyApiKey: optional('TALLY_API_KEY'),
  adminApiKey: optional('ADMIN_API_KEY'),
  corsOrigin: optional('CORS_ORIGIN', '*'),
  formIds: {
    'A-sin': optional('TALLY_FORM_A_SIN'),
    'A-con': optional('TALLY_FORM_A_CON'),
    'B-sin': optional('TALLY_FORM_B_SIN'),
    'B-con': optional('TALLY_FORM_B_CON'),
  } satisfies Record<VariantKey, string>,
  /** Taller 3: un solo formulario para las diez aulas, como el resto. */
  formIdsT3: {
    veredictos: optional('TALLY_FORM_T3_VEREDICTOS'),
  } satisfies Record<VariantT3, string>,
}

/**
 * A qué taller pertenece un formulario.
 *
 * El webhook es uno solo para todos los formularios del bootcamp: Tally manda
 * el `formId` en cada envío y aquí se decide quién lo procesa. Añadir un taller
 * es añadir una variable de entorno, no un servicio.
 */
export function sourceForFormId(
  formId: string,
): { workshop: WorkshopId; variant: string } | null {
  const variant = variantForFormId(formId)
  if (variant) return { workshop: 'taller1', variant }
  for (const [nombre, id] of Object.entries(config.formIdsT3) as [VariantT3, string][]) {
    if (id && id === formId) return { workshop: 'taller3', variant: nombre }
  }
  return null
}

export function variantForFormId(formId: string): VariantKey | null {
  for (const [variant, id] of Object.entries(config.formIds) as [VariantKey, string][]) {
    if (id && id === formId) return variant
  }
  return null
}

export function assertAdminKey(header: string | undefined): boolean {
  const key = config.adminApiKey
  if (!key) return false
  return header === `Bearer ${key}`
}

export function hasTallyApi(): boolean {
  return Boolean(config.tallyApiKey) && syncableForms().length > 0
}

/**
 * Cuántos formularios tiene configurado cada taller.
 *
 * Sin identificadores: solo dice si las variables de entorno llegaron al
 * despliegue. Es lo primero que hay que mirar cuando un envío no aparece, y por
 * eso va en `/health`, que es público: un formulario sin configurar hace que el
 * webhook conteste 202 y no guarde nada.
 */
/** La fecha de corte, o null si no hay. Una fecha ilegible se ignora, y se avisa. */
export function resultadosDesde(): string | null {
  const valor = config.resultadosDesde
  if (!valor) return null
  if (!Number.isFinite(Date.parse(valor))) {
    console.warn(`[config] RESULTADOS_DESDE no es una fecha ISO válida: ${valor}. Se ignora.`)
    return null
  }
  return new Date(valor).toISOString()
}

export function formulariosConfigurados(): Record<WorkshopId, number> {
  const cuenta = (ids: Record<string, string>) => Object.values(ids).filter(Boolean).length
  return { taller1: cuenta(config.formIds), taller3: cuenta(config.formIdsT3) }
}

/** Los formularios que `POST /admin/sync` puede recorrer, taller por taller. */
export function syncableForms(): { workshop: WorkshopId; variant: string; formId: string }[] {
  const t1 = Object.entries(config.formIds).map(([variant, formId]) => ({
    workshop: 'taller1' as const,
    variant,
    formId,
  }))
  const t3 = Object.entries(config.formIdsT3).map(([variant, formId]) => ({
    workshop: 'taller3' as const,
    variant,
    formId,
  }))
  return [...t1, ...t3].filter((form) => Boolean(form.formId))
}

export function assertBootConfig(): void {
  if (!config.tallyWebhookSecret && process.env.NODE_ENV === 'production') {
    console.warn('[config] TALLY_WEBHOOK_SECRET no configurado: los webhooks no se verificarán.')
  }
}
