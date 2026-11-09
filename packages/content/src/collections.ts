import { parseFrontmatter } from './frontmatter'
import type { LlmsIndex, LlmsPage } from './llms'
import { renderMarkdown } from './markdown'
import type {
  CollectionConfig,
  ContentConfig,
  LlmsConfig,
  NavGroup,
  NavItem,
  Page,
  SearchEntry,
} from './model'

/**
 * Turns `config/content.ts` and the markdown it points at into pages, nav and the search index.
 * It reads files through the same small interface `kitr generate` hands a generator, so it never
 * touches the file system itself and tests can feed it a folder of fixtures.
 */

/** The file access `buildContent` needs: what `GenerateContext` provides. */
export interface ContentFiles {
  /** Files under `dir` matching the glob, relative to the root. */
  glob(dir: string, pattern: string): string[]
  exists(path: string): boolean
  read(path: string): string
}

/** One page `buildContent` rendered, with where it came from. */
export interface BuiltPage {
  collection: string
  slug: string
  /** The markdown file, relative to the project root. */
  source: string
  page: Page
}

/** Everything `kitr generate` writes for the content package. */
export interface BuiltContent {
  pages: BuiltPage[]
  /** Each collection's groups, in nav order. */
  nav: Record<string, NavGroup[]>
  search: SearchEntry[]
  /** Set when `llms` is on. */
  llms?: LlmsIndex
}

/** One entry of a `nav.json` group: a slug, or a slug with overrides and a file elsewhere. */
export type NavFileItem =
  | string
  | { slug: string; title?: string; description?: string; source?: string }

/** The shape of a collection's `nav.json`. */
export type NavFile = Array<{ title: string; description?: string; pages: NavFileItem[] }>

/** `a/b/../c` as `a/c`, with `/` separators and no leading `./`. */
export function normalizePath(path: string): string {
  const out: string[] = []
  for (const part of path.replace(/\\/g, '/').split('/')) {
    if (!part || part === '.') continue
    if (part === '..' && out.length && out.at(-1) !== '..') out.pop()
    else out.push(part)
  }
  return out.join('/')
}

const dirOf = (path: string) => path.split('/').slice(0, -1).join('/')
const baseOf = (path: string) => (path.split('/').at(-1) ?? path).replace(/\.md$/, '')
const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const joinUrl = (prefix: string, slug: string) => `${prefix.replace(/\/+$/, '')}/${slug}`

interface Entry {
  collection: string
  config: CollectionConfig
  group: string
  item: { slug: string; title?: string; description?: string }
  source: string
}

/** The pages of one collection, in nav order: from `nav.json`, or every `*.md` sorted by `order`, then title. */
function entriesOf(files: ContentFiles, name: string, config: CollectionConfig): Entry[] {
  const source = normalizePath(config.source)
  if (config.nav) {
    const navPath = normalizePath(`${source}/${config.nav}`)
    if (!files.exists(navPath))
      throw new Error(`config/content.ts: the ${name} collection's nav file ${navPath} is missing`)
    let nav: NavFile
    try {
      nav = JSON.parse(files.read(navPath))
    } catch (error) {
      throw new Error(`${navPath} is not valid JSON: ${(error as Error).message}`)
    }
    if (!Array.isArray(nav))
      throw new Error(`${navPath} must be a list of groups: [{ "title": "...", "pages": [...] }]`)
    const navDir = dirOf(navPath)
    const out: Entry[] = []
    for (const group of nav)
      for (const raw of group.pages ?? []) {
        const item = typeof raw === 'string' ? { slug: raw } : raw
        const file = normalizePath(
          item.source ? `${navDir}/${item.source}` : `${navDir}/${item.slug}.md`,
        )
        if (!files.exists(file))
          throw new Error(`${navPath} lists "${item.slug}", but ${file} does not exist`)
        out.push({ collection: name, config, group: group.title, item, source: file })
      }
    return out
  }
  const group = config.title ?? capitalise(name)
  return files
    .glob(source, '*.md')
    .map((file) => {
      const { data, body } = parseFrontmatter(files.read(file))
      const title =
        typeof data.title === 'string' ? data.title : body.match(/^\s*# (.+)/)?.[1]?.trim()
      return {
        order: typeof data.order === 'number' ? data.order : Number.POSITIVE_INFINITY,
        title: title ?? baseOf(file),
        entry: { collection: name, config, group, item: { slug: baseOf(file) }, source: file },
      }
    })
    .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title))
    .map((x) => x.entry)
}

/** Options for `buildContent`. */
export interface BuildOptions {
  /** The `llms.txt` title when `llms.title` is not set: the package.json `name`. */
  name?: string
}

/**
 * Render every collection in `config`: one page per markdown file, the nav groups, the search
 * index (a page entry plus one per h2/h3) and, with `llms` on, the `llms.txt` index. A relative
 * link to another markdown file (`./cli.md#flags`) is rewritten to that page's URL, matched by path
 * first and by file name across collections second.
 */
export async function buildContent(
  files: ContentFiles,
  config: ContentConfig,
  options: BuildOptions = {},
): Promise<BuiltContent> {
  const entries = Object.entries(config.collections ?? {}).flatMap(([name, collection]) =>
    entriesOf(files, name, collection),
  )
  const bySource = new Map<string, string>()
  const byName = new Map<string, string>()
  for (const e of entries) {
    const url = joinUrl(e.config.url, e.item.slug)
    bySource.set(e.source, url)
    if (!byName.has(baseOf(e.source))) byName.set(baseOf(e.source), url)
    if (!byName.has(e.item.slug)) byName.set(e.item.slug, url)
  }

  const pages: BuiltPage[] = []
  const nav: Record<string, NavGroup[]> = {}
  const search: SearchEntry[] = []
  const llmsPages: LlmsPage[] = []
  for (const name of Object.keys(config.collections ?? {})) nav[name] = []

  for (const e of entries) {
    const { data, body } = parseFrontmatter(files.read(e.source))
    const resolveLink = (href: string) => {
      const [path = '', hash] = href.split('#')
      const target = normalizePath(`${dirOf(e.source)}/${path}`)
      const url = bySource.get(target) ?? byName.get(baseOf(path))
      return url ? `${url}${hash ? `#${hash}` : ''}` : undefined
    }
    const rendered = await renderMarkdown(body, { code: config.code, resolveLink })
    const url = joinUrl(e.config.url, e.item.slug)
    const title =
      e.item.title ??
      (typeof data.title === 'string' ? data.title : undefined) ??
      rendered.heading ??
      e.item.slug
    const description =
      e.item.description ?? (typeof data.description === 'string' ? data.description : undefined)
    const page: Page = {
      url,
      title,
      ...(description ? { description } : {}),
      section: e.group,
      data,
      blocks: rendered.blocks,
      toc: rendered.toc,
      steps: rendered.steps,
      ...(config.editUrl ? { editUrl: `${config.editUrl.replace(/\/+$/, '')}/${e.source}` } : {}),
    }
    pages.push({ collection: e.collection, slug: e.item.slug, source: e.source, page })

    const groups = nav[e.collection]!
    let group = groups.find((g) => g.title === e.group)
    if (!group) {
      group = { title: e.group, items: [] }
      groups.push(group)
    }
    const item: NavItem = { slug: e.item.slug, title, ...(description ? { description } : {}) }
    group.items.push(item)

    search.push({
      url,
      title,
      section: e.group,
      heading: '',
      text: `${description ?? ''} ${rendered.intro}`.trim(),
    })
    for (const s of rendered.sections)
      search.push({
        url: `${url}#${s.id}`,
        title,
        section: e.group,
        heading: s.heading,
        text: s.text,
      })
    llmsPages.push({
      url,
      title,
      ...(description ? { description } : {}),
      section: e.group,
      source: e.source,
    })
  }

  // Group descriptions come from nav.json, which only the entries know; add them in one pass.
  for (const [name, collection] of Object.entries(config.collections ?? {})) {
    if (!collection.nav) continue
    const navPath = normalizePath(`${normalizePath(collection.source)}/${collection.nav}`)
    const groups = JSON.parse(files.read(navPath)) as NavFile
    for (const g of nav[name] ?? []) {
      const description = groups.find((x) => x.title === g.title)?.description
      if (description) g.description = description
    }
  }

  const llms = config.llms
  if (!llms) return { pages, nav, search }
  const opts: LlmsConfig = llms === true ? {} : llms
  return {
    pages,
    nav,
    search,
    llms: {
      title: opts.title ?? options.name ?? 'Docs',
      ...(opts.description ? { description: opts.description } : {}),
      ...(opts.url ? { url: opts.url.replace(/\/+$/, '') } : {}),
      pages: llmsPages,
    },
  }
}
