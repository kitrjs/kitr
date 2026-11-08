import { describe, expectTypeOf, it } from 'vitest'
import { defineTokens, type TokenPath } from '../src'

describe('token types', () => {
  it('derives dotted paths from the token tree', () => {
    const t = defineTokens({ color: { primary: '#000', text: { muted: '#666' } }, radius: 4 })
    expectTypeOf<TokenPath<typeof t.tokens>>().toEqualTypeOf<
      'color.primary' | 'color.text.muted' | 'radius'
    >()
    t.var('color.text.muted')
    // @ts-expect-error not a leaf
    t.var('color.text')
    // @ts-expect-error typo
    t.name('colour.primary')
  })
})
