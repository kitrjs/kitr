import { describe, expectTypeOf, it } from 'vitest'
import type { TranslationKeys } from '../src'

describe('translation keys', () => {
  it('flattens nested resources to dotted keys', () => {
    const en = { nav: { home: 'Home', settings: { title: 'Settings' } }, ok: 'OK' } as const
    expectTypeOf<TranslationKeys<typeof en>>().toEqualTypeOf<
      'nav.home' | 'nav.settings.title' | 'ok'
    >()
  })
})
