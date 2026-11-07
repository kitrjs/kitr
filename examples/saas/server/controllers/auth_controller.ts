import type { HttpContext } from 'kitr/api'
import { KitrError } from 'kitr/app'
import { z } from 'zod'
import type { User } from '#app/abilities'

const credentials = z.object({ email: z.email(), password: z.string().min(1) })
type Ctx<B = unknown> = HttpContext<Record<string, string>, Record<string, string | string[]>, B>

/**
 * Demo identity: any email signs in with the password "password"; emails starting with
 * "admin" get the admin role. Tokens live in memory. Replace with your identity provider
 * (or `betterAuthAdapter` in config/auth.ts) and delete this file.
 */
const sessions = new Map<string, User>()

export default class AuthController {
  static validation = { signIn: { body: credentials } }

  async signIn({ body, response }: Ctx<z.infer<typeof credentials>>) {
    if (body.password !== 'password') throw KitrError.unauthorized('Wrong email or password')
    const user: User = {
      id: body.email,
      email: body.email,
      role: body.email.startsWith('admin') ? 'admin' : 'member',
    }
    const token = crypto.randomUUID()
    sessions.set(token, user)
    response.status(201)
    return { token, user }
  }

  async me({ request }: Ctx) {
    const token = request.header('authorization')?.replace(/^Bearer /i, '')
    const user = token ? sessions.get(token) : undefined
    if (!user) throw KitrError.unauthorized()
    return user
  }

  async signOut({ request, response }: Ctx) {
    const token = request.header('authorization')?.replace(/^Bearer /i, '')
    if (token) sessions.delete(token)
    return response.noContent()
  }
}
