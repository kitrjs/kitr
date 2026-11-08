import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createContext } from '../src/context'
import { base, writeReadme } from '../src/kits-base'

let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'kitr-readme-'))
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

describe('generated README.md', () => {
  it('names the project, kit and package manager, and lists only what exists', () => {
    const ctx = createContext({ root: dir, pm: 'npm' })
    base(ctx, 'demo')
    ctx.pkg = JSON.parse(ctx.read('package.json'))
    ctx.pkg.scripts = { ...ctx.pkg.scripts, dev: 'kitr dev', test: 'vitest run' }
    writeReadme(ctx, 'demo', 'app')
    const readme = readFileSync(join(dir, 'README.md'), 'utf8')
    expect(readme).toContain('# demo')
    expect(readme).toContain('`app` kit')
    expect(readme).toContain('npm run dev')
    expect(readme).toContain('npm run test')
    expect(readme).not.toContain('npm run build')
    expect(readme).toContain('`kitrrc.ts`')
    expect(readme).not.toContain('app/pages/')
    expect(readme).toContain('https://kitr.dev/docs/getting-started')
    expect(readme.split('\n').length).toBeLessThan(40)
  })
})
