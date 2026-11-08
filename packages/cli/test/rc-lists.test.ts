import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Codemods } from '../src/codemods'
import { createContext } from '../src/context'

const dirs: string[] = []
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
  vi.restoreAllMocks()
})

/** A project directory (no node_modules, so no formatter runs: every byte below is the codemod's). */
function project(files: Record<string, string>) {
  const dir = mkdtempSync(join(tmpdir(), 'kitr-rc-lists-'))
  dirs.push(dir)
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true })
    writeFileSync(join(dir, path), content)
  }
  const codemods = new Codemods(createContext({ root: dir }))
  return { dir, codemods, read: (file: string) => readFileSync(join(dir, file), 'utf8') }
}

describe('kitrrc.ts lists are edited as text', () => {
  it('appends to a list written with tabs, double quotes and comments, in that style', () => {
    const rc = `import { defineKitrConfig } from "@kitr/kitr/app";

export default defineKitrConfig({
\tpackages: [
\t\t// first, on purpose
\t\t"@kitr/react",
\t\t"@kitr/web", // last
\t],
\tproviders: [
\t\t// ordering matters
\t\t() => import("@kitr/web/provider"),
\t\t() => import("@kitr/query/provider"), // after web
\t],
});
`
    const { codemods, read } = project({ 'kitrrc.ts': rc })
    codemods.addPackage('@kitr/forms')
    codemods.addProvider('@kitr/forms/provider')
    expect(read('kitrrc.ts')).toBe(
      rc
        .replace('"@kitr/web", // last\n', '"@kitr/web", // last\n\t\t"@kitr/forms",\n')
        .replace(
          '() => import("@kitr/query/provider"), // after web\n',
          '() => import("@kitr/query/provider"), // after web\n\t\t() => import("@kitr/forms/provider"),\n',
        ),
    )
  })

  it('is idempotent and removes exactly what it added', () => {
    const rc = `export default defineKitrConfig({
  packages: [
    '@kitr/react', // the base
    '@kitr/web'
  ],
  providers: [
    () => import('@kitr/web/provider')
  ]
})
`
    const { codemods, read } = project({ 'kitrrc.ts': rc })
    codemods.addPackage('@kitr/forms')
    codemods.addProvider('@kitr/forms/provider')
    const added = read('kitrrc.ts')
    // The last entry had no trailing comma: it gets one, and the new entry has none.
    expect(added).toContain("    '@kitr/web',\n    '@kitr/forms'\n  ],")
    expect(added).toContain(
      "() => import('@kitr/web/provider'),\n    () => import('@kitr/forms/provider')\n",
    )
    codemods.addPackage('@kitr/forms')
    codemods.addProvider('@kitr/forms/provider')
    expect(read('kitrrc.ts')).toBe(added)
    codemods.removePackage('@kitr/forms')
    codemods.removeProvider('@kitr/forms/provider')
    // The original had no trailing comma on its last entry; the add gave it one and a removal keeps it.
    expect(read('kitrrc.ts')).toBe(
      rc.replace("'@kitr/web'\n", "'@kitr/web',\n").replace("provider')\n", "provider'),\n"),
    )
  })

  it('handles inline lists', () => {
    const rc = `export default defineKitrConfig({ packages: ['@kitr/react', '@kitr/web'], providers: [() => import('@kitr/web/provider')] })\n`
    const { codemods, read } = project({ 'kitrrc.ts': rc })
    codemods.addPackage('@kitr/forms')
    codemods.addProvider('@kitr/forms/provider')
    expect(read('kitrrc.ts')).toBe(
      "export default defineKitrConfig({ packages: ['@kitr/react', '@kitr/web', '@kitr/forms'], providers: [() => import('@kitr/web/provider'), () => import('@kitr/forms/provider')] })\n",
    )
    codemods.removePackage('@kitr/react')
    codemods.removePackage('@kitr/forms')
    codemods.removeProvider('@kitr/forms/provider')
    expect(read('kitrrc.ts')).toBe(
      "export default defineKitrConfig({ packages: ['@kitr/web'], providers: [() => import('@kitr/web/provider')] })\n",
    )
  })

  it('fills an empty list in the file indentation', () => {
    const { codemods, read } = project({
      'kitrrc.ts': `export default defineKitrConfig({\n\tpackages: [],\n\tproviders: [ // none yet\n\t],\n})\n`,
    })
    codemods.addPackage('@kitr/web')
    codemods.addProvider('@kitr/web/provider')
    expect(read('kitrrc.ts')).toBe(
      `export default defineKitrConfig({\n\tpackages: [\n\t\t'@kitr/web',\n\t],\n\tproviders: [ // none yet\n\t\t() => import('@kitr/web/provider'),\n\t],\n})\n`,
    )
  })

  it('removes an entry on its own line with the comment trailing it, and keeps neighbours', () => {
    const rc = `export default defineKitrConfig({
  packages: [
    '@kitr/react',
    // about the router
    '@kitr/router', // pinned
    '@kitr/web',
  ],
  providers: [
    // first
    () => import('@kitr/a/provider'),
    () => import('@kitr/b/provider'), // b
    () => import('@kitr/c/provider'),
  ],
})
`
    const { codemods, read } = project({ 'kitrrc.ts': rc })
    codemods.removePackage('@kitr/router')
    codemods.removeProvider('@kitr/b/provider')
    expect(read('kitrrc.ts')).toBe(
      rc
        .replace("    '@kitr/router', // pinned\n", '')
        .replace("    () => import('@kitr/b/provider'), // b\n", ''),
    )
  })

  it('does not mistake a longer name for the one it removes', () => {
    const rc = `export default defineKitrConfig({
  packages: ['@kitr/query', '@kitr/query-extras'],
  providers: [
    () => import('@kitr/query/provider'),
    () => import('@kitr/query/provider-extras'),
  ],
})
`
    const { codemods, read } = project({ 'kitrrc.ts': rc })
    codemods.removePackage('@kitr/query')
    codemods.removeProvider('@kitr/query/provider')
    expect(read('kitrrc.ts')).toContain("packages: ['@kitr/query-extras']")
    expect(read('kitrrc.ts')).toContain('provider-extras')
    expect(read('kitrrc.ts')).not.toContain("'@kitr/query/provider'")
  })

  it('keeps a satisfies clause and other keys', () => {
    const rc = `export default defineKitrConfig({
  packages: [
    '@kitr/react',
  ],
  platforms: { site: web({ mode: 'ssr' }) },
} satisfies Config)
`
    const { codemods, read } = project({ 'kitrrc.ts': rc })
    codemods.addPackage('@kitr/web')
    expect(read('kitrrc.ts')).toBe(
      rc.replace("    '@kitr/react',\n", "    '@kitr/react',\n    '@kitr/web',\n"),
    )
  })

  it('creates a list that is missing, and the file when there is none', () => {
    const { codemods, read } = project({
      'kitrrc.ts': `export default defineKitrConfig({\n  packages: [],\n})\n`,
    })
    codemods.addProvider('@kitr/web/provider')
    expect(read('kitrrc.ts')).toMatch(
      /providers: \[\s*\(\) => import\('@kitr\/web\/provider'\),?\s*\]/,
    )
    const bare = project({})
    bare.codemods.addPackage('@kitr/web')
    bare.codemods.addCommand('@kitr/jobs/commands')
    expect(bare.read('kitrrc.ts')).toContain("'@kitr/web'")
    expect(bare.read('kitrrc.ts')).toContain("import('@kitr/jobs/commands')")
  })

  it('leaves the file alone on --dry-run and when nothing matches', () => {
    const rc = `export default defineKitrConfig({\n  packages: ['@kitr/react'],\n  providers: [],\n})\n`
    const { dir, read } = project({ 'kitrrc.ts': rc })
    const dry = new Codemods(createContext({ root: dir, dryRun: true }))
    dry.addPackage('@kitr/web')
    dry.removePackage('@kitr/react')
    expect(read('kitrrc.ts')).toBe(rc)
    const real = new Codemods(createContext({ root: dir }))
    real.removePackage('@kitr/not-there')
    real.removeProvider('@kitr/not-there/provider')
    expect(read('kitrrc.ts')).toBe(rc)
  })

  it('names the problem when the default export is not a config object', () => {
    const { codemods } = project({ 'kitrrc.ts': `export default makeConfig()\n` })
    expect(() => codemods.addPackage('@kitr/web')).toThrow()
  })
})

describe('vite.config.ts edits', () => {
  const vite = `import { kitr } from "@kitr/vite";
import { defineConfig } from "vite";

// my own plugin
const mine = { name: "mine" };

export default defineConfig({
\tplugins: [mine, kitr()],
});
`

  it('adds a plugin and its import without touching the rest, once', () => {
    const { codemods, read } = project({ 'vite.config.ts': vite })
    codemods.addVitePlugin('pwa', 'vite-plugin-pwa', 'pwa()')
    const out = read('vite.config.ts')
    expect(out).toContain('import pwa from')
    expect(out).toContain('vite-plugin-pwa')
    expect(out).toContain('// my own plugin')
    expect(out).toMatch(/plugins: \[mine, kitr\(\),\s*pwa\(\)\]/)
    codemods.addVitePlugin('pwa', 'vite-plugin-pwa', 'pwa()')
    expect(read('vite.config.ts')).toBe(out)
  })

  it('warns instead of failing when there is no vite config', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const { codemods } = project({ 'package.json': '{}' })
    expect(() => codemods.addVitePlugin('pwa', 'vite-plugin-pwa')).not.toThrow()
  })

  it('addImport adds a default import once', () => {
    const { codemods, read } = project({ 'vite.config.ts': vite })
    codemods.addImport('vite.config.ts', 'x', 'some-pkg')
    expect(read('vite.config.ts')).toContain('some-pkg')
    const once = read('vite.config.ts')
    codemods.addImport('vite.config.ts', 'x', 'some-pkg')
    expect(read('vite.config.ts')).toBe(once)
  })
})
