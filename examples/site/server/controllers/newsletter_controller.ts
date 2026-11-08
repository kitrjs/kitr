import type { HttpContext } from '@kitr/api'
import { type Subscribe, subscribeSchema } from '#app/features/newsletter/schema'

/** In-memory for the demo; a real app would write to a database or an email provider. */
const subscribers = new Set<string>()

export default class NewsletterController {
  static validation = { subscribe: { body: subscribeSchema } }

  async subscribe({ body, logger }: HttpContext<Record<string, string>, Record<string, string | string[]>, Subscribe>) {
    subscribers.add(body.email)
    logger.info('newsletter: subscribed', { email: body.email })
    return { ok: true, count: subscribers.size }
  }
}
