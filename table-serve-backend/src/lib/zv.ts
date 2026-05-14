import { zValidator } from '@hono/zod-validator'
import type { ZodType } from 'zod'

function makeValidator(target: 'json' | 'query') {
  return function <T extends ZodType>(schema: T) {
    return zValidator(target, schema, (result, c) => {
      if (!result.success) {
        const first = result.error.issues[0]
        const field = first?.path?.join('.') ?? ''
        const message = first?.message ?? 'Validation failed'
        return c.json({ error: field ? `${field}: ${message}` : message }, 400)
      }
    })
  }
}

/** Validates request JSON body and returns a clean error string on failure. */
export const zv = makeValidator('json')

/** Validates query parameters and returns a clean error string on failure. */
export const zvq = makeValidator('query')
