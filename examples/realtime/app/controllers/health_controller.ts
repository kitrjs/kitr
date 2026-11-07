import type { HttpContext } from 'kitr/api'

export default class HealthController {
  async show({ requestId }: HttpContext) {
    return { ok: true, requestId }
  }
}
