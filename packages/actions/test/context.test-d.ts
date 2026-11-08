import { createMiddleware } from '@tanstack/react-start'
import { describe, expectTypeOf, it } from 'vitest'
import { defineMutation, defineQuery, type MiddlewareContext } from '../src'

const withSession = createMiddleware({ type: 'function' }).server(({ next }) =>
  next({ context: { session: { user: { id: 'u1' } } } }),
)
const withTenant = createMiddleware({ type: 'function' }).server(({ next }) =>
  next({ context: { tenant: 'acme' as const } }),
)

describe('handler context from middleware', () => {
  it('types what each middleware passes to next()', () => {
    defineQuery('a', {
      middleware: [withSession, withTenant],
      handler: ({ context }) => {
        expectTypeOf(context.session.user.id).toEqualTypeOf<string>()
        expectTypeOf(context.tenant).toEqualTypeOf<'acme'>()
        return 1
      },
    })
    defineMutation('b', {
      middleware: [withSession],
      handler: ({ context }) => {
        expectTypeOf(context.session.user.id).toEqualTypeOf<string>()
        // @ts-expect-error tenant comes from a middleware this mutation does not use
        context.tenant
        return 1
      },
    })
  })

  it('is empty without middleware', () => {
    expectTypeOf<MiddlewareContext<[]>>().toEqualTypeOf<{}>()
    defineQuery('c', {
      handler: ({ context }) => {
        // @ts-expect-error no middleware, no session
        context.session
        return 1
      },
    })
  })

  it('types .run() context from the middleware too', async () => {
    const q = defineQuery('d', { middleware: [withSession], handler: ({ context }) => context })
    await q.run(undefined, { context: { session: { user: { id: 'x' } } } })
    // @ts-expect-error wrong shape
    await q.run(undefined, { context: { session: { user: { id: 1 } } } })
  })
})
