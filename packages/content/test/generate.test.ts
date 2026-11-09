import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative } from 'node:path'
import { type GenerateContext, globToRegExp } from '@kitr/core'
import { afterEach, describe, expect, it } from 'vitest'
import { buildContent } from '../src/collections'
import { llmsFullTxt, llmsTxt, pageMarkdown } from '../src/llms'
import generator, { loadContentConfig, renderIndex } from '../src/types'

const dirs: string[] = []
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})

/** A project on disk from a map of files. */
function project(files: Record<string, string>) {
  const root = mkdtempSync(join(tmpdir(), 'kitr-content-'))
  dirs.push(root)
  for (const [file, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, file)), { recursive: true })
    writeFileSync(join(root, file), content)
  }
  return root
}

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) yield* walk(full)
    else yield full
  }
}

/** The context `kitr generate` hands a generator, over a folder. */
function context(root: string): GenerateContext {
  return {
    root,
    rc: { packages: [], providers: [], directories: { config: 'config' }, platforms: {} },
    glob: (dir, pattern) => {
      const base = join(root, dir)
      try {
        statSync(base)
      } catch {
        return []
      }
      const re = globToRegExp(pattern)
      return [...walk(base)]
        .filter((f) => re.test(relative(base, f).split('\\').join('/')))
        .map((f) => relative(root, f).split('\\').join('/'))
        .sort()
    },
    exists: (path) => {
      try {
        statSync(join(root, path))
        return true
      } catch {
        return false
      }
    },
    read: (path) => readFileSync(join(root, path), 'utf8'),
    importPath: (file) => `../${file}`,
  }
}

const docs = {
  'package.json': '{ "name": "acme-docs" }',
  'config/content.ts': `const config = {
  collections: {
    docs: { source: 'content/docs', url: '/docs', nav: 'nav.json' },
    blog: { source: 'content/blog', url: '/blog' },
  },
  llms: { description: 'Acme docs for agents.' },
  editUrl: 'https://github.com/acme/docs/edit/main/',
}
export default config
`,
  'content/docs/nav.json': JSON.stringify([
    {
      title: 'Start here',
      description: 'The first steps.',
      pages: ['getting-started', { slug: 'cli', title: 'The CLI' }],
    },
    { title: 'Reference', pages: [{ slug: 'kits', source: '../shared/kits-reference.md' }] },
  ]),
  'content/docs/getting-started.md': `---
title: Getting started
description: Install and write a first page.
---

# Getting started

Install the CLI first.

## 1. Install

\`\`\`sh
kitr add content
\`\`\`

See [the CLI](./cli.md#flags) and [kits](kits-reference.md).

## 2. Write a page

Pages are markdown.
`,
  'content/docs/cli.md': '# Command line\n\nEvery command.\n\n## Flags\n\nThe flags.\n',
  'content/shared/kits-reference.md':
    '---\ndescription: Every kit.\n---\n\n# Kits\n\nOne per kit.\n',
  'content/blog/second.md': '---\ntitle: Second post\norder: 2\n---\n\nTwo.\n',
  'content/blog/first.md': '---\ntitle: First post\norder: 1\n---\n\nOne.\n',
  'content/blog/notes.md': '# Notes\n\nNo order.\n',
}

describe('loadContentConfig', () => {
  it('runs config/content.ts and returns its default export', async () => {
    const root = project(docs)
    const config = await loadContentConfig(root)
    expect(Object.keys(config!.collections)).toEqual(['docs', 'blog'])
  })

  it('is undefined without the file and an error for a bad export', async () => {
    expect(await loadContentConfig(project({}))).toBeUndefined()
    const root = project({ 'config/content.ts': 'export default 1\n' })
    await expect(loadContentConfig(root)).rejects.toThrow(/must export defineConfig/)
  })
})

describe('buildContent', () => {
  it('renders pages in nav order with titles, sections, rewritten links and edit links', async () => {
    const root = project(docs)
    const config = (await loadContentConfig(root))!
    const content = await buildContent(context(root), config, { name: 'acme-docs' })
    expect(content.pages.map((p) => `${p.collection}/${p.slug}`)).toEqual([
      'docs/getting-started',
      'docs/cli',
      'docs/kits',
      'blog/first',
      'blog/second',
      'blog/notes',
    ])
    const start = content.pages[0]!.page
    expect(start).toMatchObject({
      url: '/docs/getting-started',
      title: 'Getting started',
      description: 'Install and write a first page.',
      section: 'Start here',
      steps: true,
      data: { title: 'Getting started', description: 'Install and write a first page.' },
      editUrl: 'https://github.com/acme/docs/edit/main/content/docs/getting-started.md',
    })
    expect(start.blocks.some((b) => b.type === 'cmd' && b.cmd === 'kitr add content')).toBe(true)
    const body = start.blocks.map((b) => (b.type === 'html' ? b.html : '')).join('')
    expect(body).toContain('href="/docs/cli#flags"')
    expect(body).toContain('href="/docs/kits"')
    // Titles: nav.json, then frontmatter, then the leading heading.
    expect(content.pages[1]!.page.title).toBe('The CLI')
    expect(content.pages[2]!.page).toMatchObject({ title: 'Kits', description: 'Every kit.' })
    expect(content.pages[5]!.page).toMatchObject({ title: 'Notes', section: 'Blog' })
  })

  it('builds the nav, the search index and the llms index', async () => {
    const root = project(docs)
    const content = await buildContent(context(root), (await loadContentConfig(root))!, {
      name: 'acme-docs',
    })
    expect(content.nav.docs).toEqual([
      {
        title: 'Start here',
        description: 'The first steps.',
        items: [
          {
            slug: 'getting-started',
            title: 'Getting started',
            description: 'Install and write a first page.',
          },
          { slug: 'cli', title: 'The CLI' },
        ],
      },
      { title: 'Reference', items: [{ slug: 'kits', title: 'Kits', description: 'Every kit.' }] },
    ])
    expect(content.nav.blog![0]!.items.map((i) => i.slug)).toEqual(['first', 'second', 'notes'])
    expect(content.search).toContainEqual({
      url: '/docs/getting-started',
      title: 'Getting started',
      section: 'Start here',
      heading: '',
      text: 'Install and write a first page. Install the CLI first.',
    })
    expect(content.search).toContainEqual({
      url: '/docs/getting-started#2-write-a-page',
      title: 'Getting started',
      section: 'Start here',
      heading: 'Write a page',
      text: 'Pages are markdown.',
    })
    expect(content.llms).toMatchObject({ title: 'acme-docs', description: 'Acme docs for agents.' })
    expect(content.llms!.pages[2]).toEqual({
      url: '/docs/kits',
      title: 'Kits',
      description: 'Every kit.',
      section: 'Reference',
      source: 'content/shared/kits-reference.md',
    })
  })

  it('names the missing file when nav.json lists a page that does not exist', async () => {
    const root = project({
      'content/docs/nav.json': '[{ "title": "Start", "pages": ["missing"] }]',
    })
    await expect(
      buildContent(context(root), {
        collections: { docs: { source: 'content/docs', url: '/docs', nav: 'nav.json' } },
      }),
    ).rejects.toThrow(
      'content/docs/nav.json lists "missing", but content/docs/missing.md does not exist',
    )
  })
})

describe('the generator', () => {
  it('writes pages, nav, search, llms.json and the typed index under .kitr/content', async () => {
    const root = project(docs)
    const files = await generator.generate(context(root))
    const names = files.map((f) => f.file).sort()
    expect(names).toEqual([
      'content/blog.nav.json',
      'content/blog/first.json',
      'content/blog/notes.json',
      'content/blog/second.json',
      'content/docs.nav.json',
      'content/docs/cli.json',
      'content/docs/getting-started.json',
      'content/docs/kits.json',
      'content/index.ts',
      'content/llms.json',
      'content/search.json',
    ])
    const page = JSON.parse(files.find((f) => f.file === 'content/docs/cli.json')!.content)
    expect(page).toMatchObject({ url: '/docs/cli', title: 'The CLI', section: 'Start here' })
    const index = files.find((f) => f.file === 'content/index.ts')!.content
    expect(index).toContain("docs: 'getting-started' | 'cli' | 'kits'")
    expect(index).toContain("blog: 'first' | 'second' | 'notes'")
    expect(index).toContain('export const nav: { [C in Collection]: NavGroup<Slug<C>>[] } = {')
    expect(index).toContain("import.meta.glob<Page>('./*/*.json', { import: 'default' })")
    expect(index).toContain('export async function loadPage(')
    expect(index).toContain('export function loadSearch(')
  })

  it('writes an empty index when there is no config/content.ts', async () => {
    const files = await generator.generate(context(project({})))
    expect(files.map((f) => f.file)).toEqual(['content/search.json', 'content/index.ts'])
    expect(files[1]!.content).toContain('export interface Slugs {}')
  })

  it('quotes collection names that are not identifiers and types an empty one as never', () => {
    const out = renderIndex({ nav: { 'api-docs': [] } })
    expect(out).toContain('"api-docs": never')
    expect(out).toContain('"api-docs": [],')
  })

  it('watches config/content.ts and the content folder', () => {
    const watch = generator.watch as (rc: unknown) => string[]
    const globs = watch({ directories: {} })
    expect(globs).toContain('config/content.ts')
    expect(globs).toContain('content/**/*.md')
  })
})

describe('llms files', () => {
  it('writes the index, the full text and one markdown copy per page', async () => {
    const root = project(docs)
    const ctx = context(root)
    const content = await buildContent(ctx, (await loadContentConfig(root))!, { name: 'Acme' })
    const llms = { ...content.llms!, url: 'https://docs.acme.com' }
    const index = llmsTxt(llms)
    expect(index).toContain('# Acme\n\n> Acme docs for agents.\n\n## Start here\n\n')
    expect(index).toContain(
      '- [Getting started](https://docs.acme.com/docs/getting-started.md): Install and write a first page.\n',
    )
    expect(index).toContain('## Blog\n\n- [First post](https://docs.acme.com/blog/first.md)\n')
    const full = llmsFullTxt(llms, ctx.read)
    expect(full).toContain('# The CLI\n\nSource: https://docs.acme.com/docs/cli\n\nEvery command.')
    const page = pageMarkdown(llms.pages[0]!, ctx.read('content/docs/getting-started.md'))
    expect(
      page.startsWith(
        '# Getting started\n\nInstall and write a first page.\n\nInstall the CLI first.',
      ),
    ).toBe(true)
    expect(page).not.toContain('title: Getting started')
  })
})
