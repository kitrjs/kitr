import { parseAst } from 'vite'
import { describe, expect, it } from 'vitest'
import { kitrActions, stripHandlers } from '../src/vite'

const strip = (code: string) => stripHandlers(code, parseAst)

describe('stripHandlers', () => {
  it('empties the handler and drops the imports only it used', () => {
    const out = strip(`import { defineMutation } from '@kitr/actions'
import { eq } from 'drizzle-orm'
import { db } from '#server/db'
import { schema } from '#app/validators'

export const rename = defineMutation('projects.rename', {
  input: schema,
  effects: { invalidate: [['projects']] },
  handler: async ({ input }) => db.update().where(eq(input.id)),
})
`)
    expect(out).toContain('input: schema,')
    expect(out).toContain("effects: { invalidate: [['projects']] }")
    expect(out).toContain('handler: undefined')
    expect(out).toContain("from '@kitr/actions'")
    expect(out).toContain("from '#app/validators'")
    expect(out).not.toContain('drizzle-orm')
    expect(out).not.toContain('#server/db')
    expect(out).not.toContain('db.update')
  })

  it('handles method shorthand, an aliased import and both factories', () => {
    const out = strip(`import { defineQuery as query, defineMutation } from '@kitr/actions'
import { secret } from 'node:crypto'
export const a = query('a.list', { handler() { return secret() } })
export const b = defineMutation('b.save', { 'handler': () => secret() })
`)
    expect(out).not.toContain('secret')
    expect(out?.match(/handler: undefined/g)).toHaveLength(2)
  })

  it('keeps an import the rest of the module still uses', () => {
    const out = strip(`import { defineQuery } from '@kitr/actions'
import { z } from 'zod'
export const input = z.object({})
export const a = defineQuery('a', { input, handler: () => z.string().parse('x') })
`)
    expect(out).toContain("from 'zod'")
  })

  it('leaves modules without an action alone', () => {
    expect(strip(`export const x = 1`)).toBeUndefined()
    expect(
      strip(`import { defineQuery } from 'other'\ndefineQuery('a', { handler() {} })`),
    ).toBeUndefined()
    expect(
      strip(`import { defineQuery } from '@kitr/actions'\nexport const a = defineQuery('a', {})`),
    ).toBeUndefined()
  })
})

describe('kitrActions', () => {
  const code = `import { defineQuery } from '@kitr/actions'
import { db } from './db'
export const a = defineQuery('a', { handler: () => db.read() })
`
  const run = (environment: string, id = '/app/actions/a.ts') =>
    (kitrActions().transform as (this: unknown, code: string, id: string) => unknown).call(
      { environment: { name: environment }, parse: parseAst },
      code,
      id,
    ) as { code: string } | undefined

  it('strips only in the client environment', () => {
    expect(run('client')?.code).toContain('handler: undefined')
    expect(run('ssr')).toBeUndefined()
  })

  it('skips dependencies', () => {
    expect(run('client', '/app/node_modules/pkg/index.js')).toBeUndefined()
  })
})
