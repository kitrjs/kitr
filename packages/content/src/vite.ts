import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Plugin } from 'vite'
import { type LlmsIndex, llmsFullTxt, llmsTxt, pageMarkdown } from './llms'

/** Options for the content Vite plugin. */
export interface ContentViteOptions {
  /** Where `kitr generate` wrote `llms.json`, relative to the root. Default `.kitr/content`. */
  dir?: string
}

/**
 * The content package's Vite plugin, added by `@kitr/vite` because the package declares it. When
 * `llms` is on in `config/content.ts`, the dev server answers `/llms.txt`, `/llms-full.txt` and
 * `<page url>.md`, and a build writes the same files next to the HTML in the client output, so a
 * static or server-rendered site ships them. The text comes from `.kitr/content/llms.json` and
 * the markdown sources; nothing is rendered twice.
 */
export function kitrContent(options: ContentViteOptions = {}): Plugin {
  let root = process.cwd()
  let base = '/'
  const index = (): LlmsIndex | undefined => {
    const file = join(root, options.dir ?? '.kitr/content', 'llms.json')
    return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as LlmsIndex) : undefined
  }
  const read = (source: string) => readFileSync(join(root, source), 'utf8')
  /** The text served at a path, or undefined when the path is not one of these files. */
  const textFor = (llms: LlmsIndex, path: string): string | undefined => {
    if (path === '/llms.txt') return llmsTxt(llms)
    if (path === '/llms-full.txt') return llmsFullTxt(llms, read)
    if (!path.endsWith('.md')) return undefined
    const page = llms.pages.find((p) => `${p.url}.md` === path)
    return page ? pageMarkdown(page, read(page.source)) : undefined
  }
  return {
    name: 'kitr:content',
    // Before the router's dev middleware, which would answer `/docs/cli.md` with a page.
    enforce: 'pre',
    configResolved(config) {
      root = config.root
      base = config.base || '/'
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        let path = (req.url ?? '').split(/[?#]/)[0] ?? ''
        if (base !== '/' && path.startsWith(base)) path = `/${path.slice(base.length)}`
        if (!/^\/llms(-full)?\.txt$|\.md$/.test(path)) return next()
        try {
          const llms = index()
          const text = llms && textFor(llms, decodeURIComponent(path))
          if (text === undefined) return next()
          res.setHeader(
            'content-type',
            `${path.endsWith('.md') ? 'text/markdown' : 'text/plain'}; charset=utf-8`,
          )
          res.end(text)
        } catch (error) {
          next(error)
        }
      })
    },
    generateBundle() {
      const env = (this as { environment?: { name: string } }).environment
      if (env && env.name !== 'client') return
      const llms = index()
      if (!llms) return
      const emit = (fileName: string, source: string) =>
        this.emitFile({ type: 'asset', fileName, source })
      emit('llms.txt', llmsTxt(llms))
      emit('llms-full.txt', llmsFullTxt(llms, read))
      for (const page of llms.pages)
        emit(`${page.url.replace(/^\/+/, '')}.md`, pageMarkdown(page, read(page.source)))
    },
  }
}

export default kitrContent
