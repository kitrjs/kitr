import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { copyExample, freePort, kitr, kitrBin, remove, startProcess } from './helpers'

/** `kitr dev | build | start | platforms | config` on real example projects, through the CLI binary. */
describe('platform commands', () => {
  let backend: string
  let fullstack: string
  beforeAll(() => {
    backend = copyExample('backend')
    fullstack = copyExample('fullstack')
  }, 120_000)
  afterAll(() => {
    remove(backend)
    remove(fullstack)
  })

  const closed = async (url: string) => {
    for (let i = 0; i < 50; i++) {
      try {
        await fetch(url)
      } catch {
        return true
      }
      await new Promise((r) => setTimeout(r, 100))
    }
    return false
  }

  it('kitr platforms lists each platform with its options, and types lists every kind', () => {
    expect(kitr(fullstack, 'platforms')).toMatch(/site\s+web\s+mode=ssr[\s\S]*api\s+server/)
    const types = kitr(backend, 'platforms', 'types')
    for (const t of ['web', 'server', 'desktop', 'tauri', 'mobile'])
      expect(types).toMatch(new RegExp(`\\b${t}\\b`))
  })

  it('kitr config <name> shows every option with its current value', () => {
    const out = kitr(fullstack, 'config', 'site')
    expect(out).toMatch(/site \(web\)/)
    expect(out).toMatch(/mode\s+ssr/)
    expect(out).toMatch(/KITR_SITE_<OPTION>/)
    expect(() => kitr(fullstack, 'config', 'nope')).toThrow(/No platform named "nope"/)
    expect(() => kitr(fullstack, 'config', 'site', 'colour', 'red')).toThrow(/no option "colour"/)
  })

  it('kitr config sets, validates and unsets an option in kitrrc.ts', () => {
    const rc = () => readFileSync(join(backend, 'kitrrc.ts'), 'utf8')
    kitr(backend, 'config', 'api', 'runtime', 'bun')
    expect(rc()).toMatch(/runtime: 'bun'/)
    expect(kitr(backend, 'platforms')).toMatch(/api\s+server\s+.*runtime=bun/)
    expect(() => kitr(backend, 'config', 'api', 'runtime', 'jvm')).toThrow()
    expect(rc()).toMatch(/runtime: 'bun'/)
    kitr(backend, 'config', 'api', 'runtime', '--unset')
    expect(rc()).not.toMatch(/runtime:/)
  })

  it('dev, build and start reject an unknown platform name', () => {
    for (const cmd of ['dev', 'build', 'start'])
      expect(() => kitr(backend, cmd, 'nope')).toThrow(/No platform named "nope".*api/)
  })

  it('kitr build api typechecks the server', () => {
    expect(kitr(backend, 'build', 'api')).toMatch(/api: typechecked/)
  }, 120_000)

  it('kitr start api serves on --port and stops with the CLI', async () => {
    const port = await freePort()
    const base = `http://127.0.0.1:${port}`
    const server = await startProcess(
      backend,
      process.execPath,
      [kitrBin, 'start', 'api', '--port', String(port)],
      `${base}/healthz`,
      { LOG_LEVEL: 'warn' },
    )
    try {
      const res = await fetch(`${base}/api/health`)
      expect(res.status).toBe(200)
    } finally {
      await server.stop()
    }
    // SIGTERM to kitr reaches the server it spawned: nothing is left listening.
    expect(await closed(`${base}/healthz`)).toBe(true)
  }, 90_000)

  it('KITR_API_PORT overrides the port from kitrrc.ts', async () => {
    const port = await freePort()
    const base = `http://127.0.0.1:${port}`
    const server = await startProcess(
      backend,
      process.execPath,
      [kitrBin, 'start', 'api'],
      `${base}/healthz`,
      { KITR_API_PORT: String(port), LOG_LEVEL: 'warn' },
    )
    try {
      expect((await fetch(`${base}/api/health`)).status).toBe(200)
    } finally {
      await server.stop()
    }
  }, 90_000)

  it('a bad KITR_* value fails before anything starts', () => {
    expect(() => kitrWithEnv(backend, { KITR_API_PORT: 'eighty' }, 'start', 'api')).toThrow(
      /expected a number/,
    )
  })

  it('kitr dev api runs the server in watch mode', async () => {
    const port = await freePort()
    const base = `http://127.0.0.1:${port}`
    const server = await startProcess(
      backend,
      process.execPath,
      [kitrBin, 'dev', 'api', '--port', String(port), '--host', '127.0.0.1'],
      `${base}/healthz`,
      { LOG_LEVEL: 'warn' },
    )
    try {
      expect((await fetch(`${base}/api/health`)).status).toBe(200)
    } finally {
      await server.stop()
    }
    expect(await closed(`${base}/healthz`)).toBe(true)
  }, 90_000)
})

function kitrWithEnv(cwd: string, env: Record<string, string>, ...args: string[]) {
  try {
    return execFileSync(process.execPath, [kitrBin, ...args], {
      cwd,
      encoding: 'utf8',
      stdio: 'pipe',
      timeout: 30_000,
      env: { ...process.env, NO_COLOR: '1', ...env },
    })
  } catch (error: any) {
    throw new Error(`${error.stdout ?? ''}\n${error.stderr ?? ''}`)
  }
}
