import { createHmac, timingSafeEqual } from 'node:crypto'

export function verifyTallySignature(payload: unknown, signature: string | undefined, secret: string): boolean {
  if (!signature || !secret) return false
  const calculated = createHmac('sha256', secret).update(JSON.stringify(payload)).digest('base64')
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(calculated))
  } catch {
    return false
  }
}
