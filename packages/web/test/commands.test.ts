import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import commands, { classNamesOf, cssTypes, renderDts } from '../src/commands'

let dir: string
let cwd: ReturnType<typeof vi.spyOn>
let log: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'kitr-css-types-'))
  cwd = vi.spyOn(process, 'cwd').mockReturnValue(dir)
  log = vi.spyOn(console, 'log').mockImplementation(() => {})
  process.exitCode = undefined
})

afterEach(() => {
  cwd.mockRestore()
  log.mockRestore()
  rmSync(dir, { recursive: true, force: true })
  process.exitCode = undefined
})

const write = (path: string, content: string) => {
  mkdirSync(dirname(join(dir, path)), { recursive: true })
  writeFileSync(join(dir, path), content)
}
const read = (path: string) => readFileSync(join(dir, path), 'utf8')
const run = (args: { check?: boolean } = {}) =>
  cssTypes.run({ args: { dir: 'app', check: false, ...args } })
const output = () => log.mock.calls.map((c) => String(c[0])).join('\n')

describe('classNamesOf', () => {
  it('lists each class once, sorted, ignoring comments and :global', () => {
    const css = `
      /* .commented { } */
      .card { color: red }
      .card:hover, .title-bar > .icon_1 { color: blue }
      :global(.third-party) { x: y }
      .-dashed { }
    `
    expect(classNamesOf(css)).toEqual(['-dashed', 'card', 'icon_1', 'title-bar'])
  })
})

describe('renderDts', () => {
  it('quotes names that are not identifiers', () => {
    const dts = renderDts(['card', 'title-bar'])
    expect(dts).toContain('readonly card: string')
    expect(dts).toContain('readonly "title-bar": string')
    expect(dts).toMatch(/export default classes/)
  })
})

describe('kitr css:types', () => {
  it('is exposed as a command named css:types', () => {
    expect(commands['css:types']).toBe(cssTypes)
    expect(cssTypes.meta.name).toBe('css:types')
  })

  it('writes a typing next to every CSS module and skips node_modules and dot folders', () => {
    write('app/button.module.css', '.root { } .big { }')
    write('app/nested/card.module.css', '.card { }')
    write('app/plain.css', '.not-a-module { }')
    write('app/node_modules/dep/x.module.css', '.dep { }')
    write('app/.hidden/y.module.css', '.hidden { }')
    run()
    expect(read('app/button.module.css.d.ts')).toContain('readonly big')
    expect(read('app/nested/card.module.css.d.ts')).toContain('readonly card')
    expect(() => read('app/plain.css.d.ts')).toThrow()
    expect(() => read('app/node_modules/dep/x.module.css.d.ts')).toThrow()
    expect(() => read('app/.hidden/y.module.css.d.ts')).toThrow()
    expect(output()).toContain('2 file(s) written')
  })

  it('leaves up-to-date typings alone', () => {
    write('app/a.module.css', '.a { }')
    run()
    log.mockClear()
    run()
    expect(output()).toBe('✔ 0 file(s) written')
  })

  it('--check lists stale typings, fails, and writes nothing', () => {
    write('app/a.module.css', '.a { }')
    run({ check: true })
    expect(process.exitCode).toBe(1)
    expect(output()).toContain('stale: app/a.module.css.d.ts')
    expect(() => read('app/a.module.css.d.ts')).toThrow()
  })

  it('--check passes once the typings are current', () => {
    write('app/a.module.css', '.a { }')
    run()
    log.mockClear()
    run({ check: true })
    expect(process.exitCode).toBeUndefined()
    expect(output()).toContain('CSS module typings are up to date')
  })
})
