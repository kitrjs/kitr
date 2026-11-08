import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { loadApp } from '../src/commands'

const dirs: string[] = []
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

function project(main: string) {
  const dir = mkdtempSync(join(tmpdir(), 'kitr-jobs-'))
  dirs.push(dir)
  mkdirSync(join(dir, 'server'))
  writeFileSync(join(dir, 'server/main.ts'), main)
  return dir
}

const app = "{ name: 'the-app', boot: async () => {}, container: { use: () => null } }"

describe('jobs:work entry', () => {
  // The generated server/main.ts exports `server`, so jobs:work takes a server as well as an app.
  it('boots the app behind an exported server', async () => {
    const dir = project(`export const server = { app: ${app} }\nexport default server\n`)
    expect(((await loadApp(dir, 'server/main.ts')) as any).name).toBe('the-app')
  })

  it('still takes an exported app', async () => {
    const dir = project(`export const app = ${app}\n`)
    expect(((await loadApp(dir, 'server/main.ts')) as any).name).toBe('the-app')
  })

  it('names the problem when the entry has neither', async () => {
    const dir = project('export const nothing = 1\n')
    await expect(loadApp(dir, 'server/main.ts')).rejects.toThrow(/neither `server` nor `app`/)
    await expect(loadApp(dir, 'server/missing.ts')).rejects.toThrow(/not found/)
  })
})
