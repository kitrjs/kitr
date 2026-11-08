import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createContext, readRcPlatforms } from '../src/context'
import { removeRcPlatform, setRcPlatformOption, writeRcPlatform } from '../src/platforms'
import {
  addNamedImport,
  addProperty,
  fileQuote,
  findRcBlock,
  insertEntry,
  removeEntries,
  removeNamedImport,
} from '../src/rc-text'

const dirs: string[] = []
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})
function project(rc: string) {
  const dir = mkdtempSync(join(tmpdir(), 'kitr-rc-text-'))
  dirs.push(dir)
  mkdirSync(dirname(join(dir, 'kitrrc.ts')), { recursive: true })
  writeFileSync(join(dir, 'kitrrc.ts'), rc)
  return {
    ctx: createContext({ root: dir }),
    read: () => readFileSync(join(dir, 'kitrrc.ts'), 'utf8'),
  }
}

describe('findRcBlock', () => {
  it('finds a list by key and reads each element, skipping comments and strings with brackets', () => {
    const src = `// providers: [ not this one
import x from 'y'
export default defineKitrConfig({
  note: "packages: [ nor this ]",
  packages: ['a', "b]", /* c */ 'd'],
  nested: { packages: ['no'] },
})
`
    const block = findRcBlock(src, 'packages', '[')!
    expect(block.elements.map((e) => src.slice(e.start, e.end))).toEqual(["'a'", '"b]"', "'d'"])
    expect(findRcBlock(src, 'providers', '[')).toBeUndefined()
  })

  it('reads an object block with nested values, and quoted keys', () => {
    const src = `export default {\n  'platforms': {\n    site: web({ mode: 'ssr', list: [1, 2] }),\n    "api": server(),\n  },\n}\n`
    const block = findRcBlock(src, 'platforms', '{')!
    expect(block.elements.map((e) => src.slice(e.start, e.end))).toEqual([
      "site: web({ mode: 'ssr', list: [1, 2] })",
      '"api": server()',
    ])
  })

  it('returns nothing without a default export object, or an unclosed block', () => {
    expect(findRcBlock('export const x = { packages: [] }', 'packages', '[')).toBeUndefined()
    expect(findRcBlock('export default { packages: [ "a"', 'packages', '[')).toBeUndefined()
    expect(findRcBlock('export default makeConfig()', 'packages', '[')).toBeUndefined()
  })
})

describe('inserting and removing entries', () => {
  it('inserts into an empty inline list and an empty multi-line list', () => {
    const inline = 'export default { packages: [] }\n'
    const block = findRcBlock(inline, 'packages', '[')!
    expect(insertEntry(inline, block, "'a'")).toBe(
      "export default { packages: [\n  'a',\n] }\n"
        .replace('[\n  ', '[\n  ')
        .replace(' }\n', ' }\n'),
    )
  })

  it('removes the first, middle and last of an inline list', () => {
    const src = "export default { packages: ['a', 'b', 'c'] }\n"
    const block = findRcBlock(src, 'packages', '[')!
    const [a, b, c] = block.elements
    expect(removeEntries(src, block, [a!])).toBe("export default { packages: ['b', 'c'] }\n")
    expect(removeEntries(src, block, [b!])).toBe("export default { packages: ['a', 'c'] }\n")
    expect(removeEntries(src, block, [c!])).toBe("export default { packages: ['a', 'b'] }\n")
    expect(removeEntries(src, block, [b!, c!])).toBe("export default { packages: ['a'] }\n")
  })

  it('addProperty appends a key to the options object', () => {
    const src = 'export default defineKitrConfig({\n  packages: [],\n})\n'
    expect(addProperty(src, 'platforms', '{}')).toBe(
      'export default defineKitrConfig({\n  packages: [],\n  platforms: {},\n})\n',
    )
    expect(addProperty('export const x = 1\n', 'platforms', '{}')).toBe('export const x = 1\n')
  })
})

describe('imports', () => {
  it('detects the quote and semicolon style of the file', () => {
    expect(fileQuote('import a from "a";\n')).toBe('"')
    expect(fileQuote("import a from 'a'\n")).toBe("'")
    expect(fileQuote('const x = 1\n')).toBe("'")
    const out = addNamedImport('import { a } from "a";\n\nexport {}\n', 'web', 'kitr/web')
    expect(out).toBe('import { a } from "a";\nimport { web } from "kitr/web";\n\nexport {}\n')
  })

  it('adds after a multi-line import, and at the top of a file without imports', () => {
    const multi = "import {\n  a,\n  b,\n} from 'x'\n\nexport {}\n"
    expect(addNamedImport(multi, 'web', 'kitr/web')).toBe(
      "import {\n  a,\n  b,\n} from 'x'\nimport { web } from 'kitr/web'\n\nexport {}\n",
    )
    expect(addNamedImport('export {}\n', 'web', 'kitr/web')).toBe(
      "import { web } from 'kitr/web'\n\nexport {}\n",
    )
  })

  it('does not import twice, even under another name', () => {
    const src = "import { web as site } from 'kitr/web'\n"
    expect(addNamedImport(src, 'site', 'kitr/web')).toBe(src)
    expect(addNamedImport("import { web } from 'kitr/web'\n", 'web', 'kitr/web')).toBe(
      "import { web } from 'kitr/web'\n",
    )
  })

  it('removes one specifier, or the whole statement when it was the only one', () => {
    const two = "import { server, web } from 'kitr/x'\nexport {}\n"
    expect(removeNamedImport(two, 'web')).toBe("import { server } from 'kitr/x'\nexport {}\n")
    expect(removeNamedImport("import { web } from 'kitr/web'\nexport {}\n", 'web')).toBe(
      'export {}\n',
    )
    expect(removeNamedImport("import {web as site, server} from 'kitr/x'\n", 'site')).toBe(
      "import {server} from 'kitr/x'\n",
    )
    expect(removeNamedImport("import { a } from 'a'\n", 'web')).toBe("import { a } from 'a'\n")
  })
})

describe('platform entries in a file the user edited', () => {
  const rc = `import { defineKitrConfig } from "kitr/app";
import { web as webPlatform } from "kitr/web";
import { server } from "kitr/server";

export default defineKitrConfig({
\tpackages: [],
\tplatforms: {
\t\t// the shop front
\t\tsite: webPlatform({ mode: "ssr" }),
\t\tapi: server(), // keep
\t},
});
`

  it('reads the renamed factory as its type, and remembers the local name', () => {
    expect(readRcPlatforms(rc)).toMatchObject({
      site: { factory: 'web', local: 'webPlatform', source: 'kitr/web' },
      api: { factory: 'server', source: 'kitr/server' },
    })
    expect(readRcPlatforms(rc).api).not.toHaveProperty('local')
  })

  it('sets an option in the entry, in the double quotes of the file, and unsets it again', () => {
    const { ctx, read } = project(rc)
    setRcPlatformOption(ctx, 'site', 'mode', 'static')
    expect(read()).toBe(rc.replace('{ mode: "ssr" }', '{ mode: "static" }'))
    setRcPlatformOption(ctx, 'site', 'mode', undefined)
    expect(read()).toBe(rc.replace('webPlatform({ mode: "ssr" })', 'webPlatform()'))
    expect(() => setRcPlatformOption(ctx, 'nope', 'mode', 'x')).toThrow(/not a factory call/)
  })

  it('removes an entry with its own line; the comment above it stays; the trailing one goes', () => {
    const { ctx, read } = project(rc)
    expect(removeRcPlatform(ctx, 'api')).toBe('server')
    expect(read()).toBe(
      rc
        .replace('\t\tapi: server(), // keep\n', '')
        .replace('import { server } from "kitr/server";\n', ''),
    )
  })

  it('keeps the import while another platform calls the same renamed factory', () => {
    const two = rc.replace('api: server(),', 'admin: webPlatform({ mode: "static" }),')
    const { ctx, read } = project(two)
    // Another platform is still a web platform: the type is in use, the import stays.
    expect(removeRcPlatform(ctx, 'admin')).toBeUndefined()
    expect(read()).toContain('import { web as webPlatform } from "kitr/web";')
    expect(removeRcPlatform(ctx, 'site')).toBe('web')
    expect(read()).not.toContain('webPlatform')
  })

  it('adds a platform in the file style and replaces a second add of the same name', () => {
    const { ctx, read } = project(rc)
    writeRcPlatform(ctx, 'tv', { entry: 'kitr/tv', factory: 'tv' }, { port: 1 })
    expect(read()).toContain('\t\ttv: tv({ port: 1 }),\n')
    expect(read()).toContain('import { tv } from "kitr/tv";')
    const once = read()
    writeRcPlatform(ctx, 'tv', { entry: 'kitr/tv', factory: 'tv' }, { port: 2 })
    expect(read()).toBe(once.replace('port: 1', 'port: 2'))
  })

  it('creates the platforms object when the file has none', () => {
    const { ctx, read } = project('export default defineKitrConfig({\n  packages: [],\n})\n')
    writeRcPlatform(ctx, 'api', { entry: 'kitr/server', factory: 'server' }, {})
    expect(read()).toContain('platforms: { api: server() },')
    expect(read()).toContain("import { server } from 'kitr/server'")
  })
})
