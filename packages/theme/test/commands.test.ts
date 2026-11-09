import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cliEntry } from '../src/commands'

const dirs: string[] = []
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
  vi.unstubAllEnvs()
})

const kitrBin = realpathSync(join(import.meta.dirname, '../../kitr/bin/kitr.mjs'))
const expected = createRequire(kitrBin).resolve('@kitr/cli')

describe('cliEntry', () => {
  it('finds @kitr/cli through a global bin symlink, from a folder with no kitr in it', () => {
    // `npm i -g @kitr/kitr` puts a link in /usr/local/bin (or /opt/homebrew/bin) and node keeps
    // that path in process.argv[1]; nothing resolves from the link's own folder.
    const dir = mkdtempSync(join(tmpdir(), 'kitr-bin-'))
    dirs.push(dir)
    mkdirSync(join(dir, 'bin'))
    mkdirSync(join(dir, 'project'))
    symlinkSync(kitrBin, join(dir, 'bin/kitr'))
    vi.stubEnv('KITR_NO_LOCAL', '1')
    expect(cliEntry(join(dir, 'project'), join(dir, 'bin/kitr'))).toBe(expected)
  })

  it("prefers the project's own @kitr/kitr, as the bin's hand-off does", () => {
    const root = join(import.meta.dirname, '../../kitr')
    expect(cliEntry(root, undefined)).toBe(expected)
  })
})
