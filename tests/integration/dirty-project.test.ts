import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { bin, copyExample, kitr, linkPackages, remove, run, snapshot } from './helpers'

/**
 * `kitr add` and `kitr remove` on a project somebody has been working in: kitrrc.ts reordered,
 * hand-formatted with another quote style, commented, a platform import renamed, and a plugin of
 * the user's own in vite.config.ts. The codemods must change only what they own.
 */

/** A kitrrc.ts as a person leaves it after a few months: tabs, double quotes, semicolons. */
const dirtyRc = `import { defineKitrConfig } from "kitr/app";
import { server as apiServer } from "@kitr/server";
import { web as webPlatform } from "@kitr/web";

// Wiring of the shop. Edited by hand; keep the comments.
export default defineKitrConfig({
\tpackages: [
\t\t"@kitr/react",
\t\t"@kitr/router",
\t\t// the server comes before the rest: it is what the team knows best
\t\t"@kitr/server",
\t\t"@kitr/logger",
\t\t"@kitr/query",
\t\t"@kitr/http",
\t\t"@kitr/forms",
\t\t"@kitr/table",
\t\t"@kitr/state",
\t\t"@kitr/tailwind",
\t\t"@kitr/theme",
\t\t"@kitr/auth",
\t\t"@kitr/storage",
\t\t"@kitr/testing",
\t\t"@kitr/seo",
\t\t"@kitr/actions",
\t\t"@kitr/api",
\t\t"@kitr/realtime",
\t\t"@kitr/vite",
\t\t"@kitr/web", // last, on purpose
\t],
\tproviders: [
\t\t// web first, then storage: order matters for hydration in this app
\t\t() => import("@kitr/web/provider"),
\t\t() => import("@kitr/storage/provider"),
\t\t// logging is wired by hand further down
\t\t() => import("@kitr/logger"),
\t\t() => import("@kitr/query/provider"),
\t\t() => import("@kitr/http/provider"),
\t\t() => import("@kitr/theme/provider"),
\t\t() => import("@kitr/auth/provider"),
\t],
\tplatforms: {
\t\tsite: webPlatform({ mode: "ssr" }),
\t\tapi: apiServer(),
\t},
\tdirectories: {
\t\tapp: "app",
\t\troutes: "app/routes",
\t\tconfig: "config",
\t\tcomponents: "app/components",
\t\tserver: "server",
\t\tplatforms: "platforms",
\t},
});
`

/** A vite.config.ts with a plugin of the user's own, in a style kitr does not write. */
const dirtyVite = `import { kitr } from "@kitr/vite";
import { defineConfig, type Plugin } from "vite";

// Stamps the build time into the bundle. Not kitr's; do not touch.
function buildStamp(): Plugin {
\treturn {
\t\tname: "build-stamp",
\t\ttransformIndexHtml: (html) => html.replace("</head>", "<!-- built --></head>"),
\t};
}

export default defineConfig({
\tplugins: [
\t\tbuildStamp(),
\t\tkitr(), // must stay after the stamp
\t],
\tserver: { open: false },
});
`

describe('kitr add / remove on a project the user has edited', () => {
  let dir: string
  const read = (file: string) => readFileSync(join(dir, file), 'utf8')
  const typecheck = () => {
    kitr(dir, 'types')
    run(dir, bin('tsc'), ['--noEmit', '-p', '.'])
  }

  beforeAll(() => {
    dir = copyExample('fullstack')
    // The tests add analytics with --no-install, so its workspace package is linked in for tsc.
    linkPackages(dir, ['analytics'])
    // The project's formatter is the user's style: tabs, double quotes, semicolons.
    const biomePath = join(dir, 'biome.json')
    const biome = JSON.parse(readFileSync(biomePath, 'utf8'))
    biome.formatter = { ...biome.formatter, indentStyle: 'tab' }
    biome.javascript = {
      ...biome.javascript,
      formatter: { ...biome.javascript?.formatter, quoteStyle: 'double', semicolons: 'always' },
    }
    writeFileSync(biomePath, JSON.stringify(biome, null, 2))
    writeFileSync(join(dir, 'kitrrc.ts'), dirtyRc)
    writeFileSync(join(dir, 'vite.config.ts'), dirtyVite)
  })
  afterAll(() => remove(dir))

  it('starts from a project that is valid as the user left it', () => {
    // The fixture is already what the project formatter writes, so formatting changes nothing.
    run(dir, bin('biome'), ['format', '--write', 'kitrrc.ts', 'vite.config.ts'])
    expect(read('kitrrc.ts')).toBe(dirtyRc)
    expect(read('vite.config.ts')).toBe(dirtyVite)
    expect(kitr(dir, 'platforms')).toMatch(/site\s+web\s+mode=ssr[\s\S]*api\s+server/)
    typecheck()
  })

  it('add puts the entries at the end and keeps everything else byte for byte', () => {
    const before = snapshot(dir)
    kitr(dir, 'add', 'analytics', '--no-install', '--yes')
    const web = '\t\t"@kitr/web", // last, on purpose\n'
    const auth = '\t\t() => import("@kitr/auth/provider"),\n'
    expect(read('kitrrc.ts')).toBe(
      dirtyRc
        .replace(web, `${web}\t\t"@kitr/analytics",\n`)
        .replace(auth, `${auth}\t\t() => import("@kitr/analytics/provider"),\n`),
    )
    // Files this package does not own are untouched.
    const after = snapshot(dir)
    expect(after['vite.config.ts']).toBe(dirtyVite)
    for (const file of ['server/main.ts', 'app/routes.ts', 'tsconfig.json'])
      expect(after[file], file).toBe(before[file])
  })

  it('adding it again changes nothing', () => {
    const once = snapshot(dir)
    kitr(dir, 'add', 'analytics', '--no-install', '--yes')
    expect(snapshot(dir)).toEqual(once)
  })

  it('remove takes out what add put in, and the user file is as it was', () => {
    kitr(dir, 'remove', 'analytics', '--no-install')
    expect(read('kitrrc.ts')).toBe(dirtyRc)
    expect(read('vite.config.ts')).toBe(dirtyVite)
  })

  it('removing a package from the middle keeps the comments around it, and it can come back', () => {
    kitr(dir, 'remove', 'http', '--no-install')
    expect(read('kitrrc.ts')).toBe(
      dirtyRc
        .replace('\t\t"@kitr/http",\n', '')
        .replace('\t\t() => import("@kitr/http/provider"),\n', ''),
    )
    kitr(dir, 'add', 'http', '--no-install', '--yes')
    const back = read('kitrrc.ts')
    expect(back).toContain('// logging is wired by hand further down')
    expect(back).toContain('// the server comes before the rest: it is what the team knows best')
    expect(back).toContain('"@kitr/web", // last, on purpose')
    expect(back).toContain('import { web as webPlatform } from "@kitr/web";')
    expect(back).toContain('site: webPlatform({ mode: "ssr" })')
    expect(back).toContain('api: apiServer()')
    expect(read('vite.config.ts')).toBe(dirtyVite)
    typecheck()
  })

  it('kitr config changes one option and leaves the rest of the file as written', () => {
    const before = read('kitrrc.ts')
    kitr(dir, 'config', 'site', 'port', '4100')
    expect(read('kitrrc.ts')).toBe(
      before.replace('webPlatform({ mode: "ssr" })', 'webPlatform({ mode: "ssr", port: 4100 })'),
    )
    kitr(dir, 'config', 'site', 'port', '--unset')
    expect(read('kitrrc.ts')).toBe(before)
  })

  it('a platform can be added and removed without disturbing the file', () => {
    const before = read('kitrrc.ts')
    kitr(dir, 'add', 'web', 'admin', '--no-install', '--mode', 'static', '--port', '3002')
    const added = read('kitrrc.ts')
    expect(added).toContain('\t\tadmin: web({ mode: "static", port: 3002 }),\n')
    expect(added).toContain('import { web } from "@kitr/web";')
    expect(added).toContain('site: webPlatform({ mode: "ssr" })')
    expect(kitr(dir, 'platforms')).toMatch(/admin\s+web\s+mode=static port=3002/)
    kitr(dir, 'platforms', 'remove', 'admin')
    // The import the first `web` brought goes with it; the user's own alias stays.
    expect(read('kitrrc.ts')).toBe(before)
  })

  it('a package that edits the route table and the app leaves the rest of those files', () => {
    const before = snapshot(dir)
    kitr(dir, 'remove', 'actions', '--no-install')
    kitr(dir, 'add', 'actions', '--no-install', '--yes')
    const after = snapshot(dir)
    expect(after['kitrrc.ts']).toContain('// last, on purpose')
    expect(after['vite.config.ts']).toBe(dirtyVite)
    expect(Object.keys(JSON.parse(after['package.json']!).dependencies)).toEqual(
      Object.keys(JSON.parse(before['package.json']!).dependencies),
    )
    typecheck()
  })
})
