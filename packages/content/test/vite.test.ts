import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { LlmsIndex } from '../src/llms'
import { kitrContent } from '../src/vite'

const dirs: string[] = []
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})

const llms: LlmsIndex = {
  title: 'Acme docs',
  description: 'For agents.',
  pages: [
    {
      url: '/docs/getting-started',
      title: 'Getting started',
      description: 'Install it.',
      section: 'Start here',
      source: 'content/docs/getting-started.md',
    },
  ],
}

function project(withLlms = true) {
  const root = mkdtempSync(join(tmpdir(), 'kitr-content-vite-'))
  dirs.push(root)
  const write = (file: string, content: string) => {
    mkdirSync(dirname(join(root, file)), { recursive: true })
    writeFileSync(join(root, file), content)
  }
  write(
    'content/docs/getting-started.md',
    '---\ntitle: Getting started\n---\n\n# Getting started\n\nRun kitr.\n',
  )
  if (withLlms) write('.kitr/content/llms.json', JSON.stringify(llms))
  return root
}

type Middleware = (req: { url?: string }, res: any, next: (error?: unknown) => void) => void

/** The plugin's dev middleware, after `configResolved`. */
function devServer(root: string, base = '/') {
  const plugin = kitrContent()
  ;(plugin.configResolved as any)({ root, base })
  let middleware: Middleware | undefined
  ;(plugin.configureServer as any)({ middlewares: { use: (fn: Middleware) => (middleware = fn) } })
  return async (url: string) => {
    const res = {
      headers: {} as Record<string, string>,
      body: undefined as string | undefined,
      setHeader(name: string, value: string) {
        this.headers[name] = value
      },
      end(body: string) {
        this.body = body
      },
    }
    let passed = false
    middleware!({ url }, res, () => {
      passed = true
    })
    return { passed, ...res }
  }
}

describe('the content Vite plugin', () => {
  it('serves llms.txt, llms-full.txt and <url>.md in dev', async () => {
    const get = devServer(project())
    const index = await get('/llms.txt')
    expect(index.passed).toBe(false)
    expect(index.headers['content-type']).toBe('text/plain; charset=utf-8')
    expect(index.body).toBe(
      '# Acme docs\n\n> For agents.\n\n## Start here\n\n- [Getting started](/docs/getting-started.md): Install it.\n',
    )
    const full = await get('/llms-full.txt')
    expect(full.body).toContain('Source: /docs/getting-started\n\nRun kitr.')
    const page = await get('/docs/getting-started.md?raw')
    expect(page.headers['content-type']).toBe('text/markdown; charset=utf-8')
    expect(page.body).toBe('# Getting started\n\nInstall it.\n\nRun kitr.\n')
  })

  it('passes on every other path, and on all of them without llms.json', async () => {
    const get = devServer(project())
    expect((await get('/docs/getting-started')).passed).toBe(true)
    expect((await get('/docs/missing.md')).passed).toBe(true)
    expect((await get('/README.md')).passed).toBe(true)
    const off = devServer(project(false))
    expect((await off('/llms.txt')).passed).toBe(true)
  })

  it('honours a base path', async () => {
    const get = devServer(project(), '/handbook/')
    expect((await get('/handbook/llms.txt')).body).toContain('# Acme docs')
  })

  it('emits the files into the client build only', () => {
    const root = project()
    const plugin = kitrContent()
    ;(plugin.configResolved as any)({ root, base: '/' })
    const emitted: Array<{ fileName: string; source: string }> = []
    const emitFile = (file: { fileName: string; source: string }) => emitted.push(file)
    ;(plugin.generateBundle as any).call({ environment: { name: 'ssr' }, emitFile })
    expect(emitted).toEqual([])
    ;(plugin.generateBundle as any).call({ environment: { name: 'client' }, emitFile })
    expect(emitted.map((f) => f.fileName)).toEqual([
      'llms.txt',
      'llms-full.txt',
      'docs/getting-started.md',
    ])
    const none = kitrContent()
    ;(none.configResolved as any)({ root: project(false), base: '/' })
    ;(none.generateBundle as any).call({ emitFile })
    expect(emitted).toHaveLength(3)
  })
})
