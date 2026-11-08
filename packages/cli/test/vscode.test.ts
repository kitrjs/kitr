import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createContext } from '../src/context'
import { writeVscode } from '../src/kits-base'

let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'kitr-vscode-'))
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

describe('generated .vscode/extensions.json', () => {
  it('recommends the kitr extension', () => {
    const ctx = createContext({ root: dir, pm: 'pnpm' })
    expect(writeVscode(ctx)).toBe(true)
    const file = readFileSync(join(dir, '.vscode/extensions.json'), 'utf8')
    expect(JSON.parse(file)).toEqual({ recommendations: ['kitrjs.kitr'] })
    expect(file.endsWith('}\n')).toBe(true)
  })

  it('leaves an existing file alone', () => {
    mkdirSync(join(dir, '.vscode'))
    writeFileSync(join(dir, '.vscode/extensions.json'), '{ "recommendations": ["acme.tools"] }\n')
    const ctx = createContext({ root: dir, pm: 'pnpm' })
    expect(writeVscode(ctx)).toBe(false)
    expect(readFileSync(join(dir, '.vscode/extensions.json'), 'utf8')).toContain('acme.tools')
  })
})
