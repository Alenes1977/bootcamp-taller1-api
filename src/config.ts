import type { VariantKey } from './items.js'

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
  return Boolean(config.tallyApiKey && Object.values(config.formIds).every(Boolean))
}

export function assertBootConfig(): void {
  if (!config.tallyWebhookSecret && process.env.NODE_ENV === 'production') {
    console.warn('[config] TALLY_WEBHOOK_SECRET no configurado: los webhooks no se verificarán.')
  }
}
