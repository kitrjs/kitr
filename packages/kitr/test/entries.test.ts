import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = join(import.meta.dirname, '../..')
const src = join(root, 'kitr/src')

/** The source file a package specifier like `@kitr/auth/provider` points at. */
function sourceOf(spec: string): string | undefined {
  const [, pkg, ...rest] = spec.split('/')
  const sub = rest.join('/') || 'index'
  return [`${sub}.ts`, `${sub}.tsx`, `${sub}/index.ts`]
    .map((f) => join(root, pkg!, 'src', f))
    .find(existsSync)
}

// Regression: `export *` never carries a default export, so `import authProvider from
// 'kitr/auth/provider'` failed for every entry that forgot `export { default }`.
describe('kitr entry points', () => {
  const entries = readdirSync(src).filter((f) => f.endsWith('.ts'))

  it.each(entries)('%s re-exports the default export when its source has one', (file) => {
    const body = readFileSync(join(src, file), 'utf8')
    for (const [, spec] of body.matchAll(/export \* from '(@kitr\/[^']+)'/g)) {
      const source = sourceOf(spec!)
      if (!source || !/^export default /m.test(readFileSync(source, 'utf8'))) continue
      expect(body, `${file} should re-export the default of ${spec}`).toContain(
        `export { default } from '${spec}'`,
      )
    }
  })
})
