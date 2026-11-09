import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('starter home page', () => {
  it('teaches: names routes.ts and the next commands, styled with the theme tokens', () => {
    const home = readFileSync(
      new URL('../../../examples/dashboard/app/pages/home.tsx', import.meta.url),
      'utf8',
    )
    expect(home).toContain('app/routes.ts')
    expect(home).toContain('kitr make:page')
    expect(home).toContain('kitr doctor')
    expect(home).toContain('text-muted-foreground')
    expect(home).not.toContain('style={{')
  })
})
