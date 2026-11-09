import { createDefineConfig } from '@kitr/core'

/** One folder of markdown pages served under one URL prefix: `docs: { source: 'content/docs', url: '/docs' }`. */
export interface CollectionConfig {
  /** The folder of `*.md` files, relative to the project root. */
  source: string
  /** The URL prefix each page is served under: `/docs` serves `getting-started.md` at `/docs/getting-started`. */
  url: string
  /**
   * A JSON file in `source` that orders and groups the pages (`nav.json`). Without it every `*.md`
   * is listed in one group, sorted by the frontmatter `order`, then by title.
   */
  nav?: string
  /** The group title when there is no `nav`, and the section search shows. Default: the collection name, capitalised. */
  title?: string
}

/** What `llms: { ... }` sets for `llms.txt`. `llms: true` uses the defaults. */
export interface LlmsConfig {
  /** The `# heading` of `llms.txt`. Default: the `name` in package.json as words (`acme-docs` is `Acme Docs`). */
  title?: string
  /** The `> summary` line under the heading. */
  description?: string
  /** The site's origin (`https://docs.acme.com`), so the links in `llms.txt` are absolute. Default: relative links. */
  url?: string
}

/** The code highlighter: Shiki themes for light and dark, and the languages it loads. */
export interface CodeConfig {
  /** Default `{ light: 'github-light-high-contrast', dark: 'github-dark' }`. */
  themes?: { light: string; dark: string }
  /** Languages to load. A fence in any other language renders as plain text. Default: ts, tsx, js, jsx, json, sh, bash, css, html, md, yaml, diff. */
  langs?: string[]
}

/** The options in `config/content.ts`. `kitr generate` reads them; the app never does at run time. */
export interface ContentConfig {
  /** The collections by name. The name is what `loadPage(name, slug)` and `nav[name]` use. */
  collections: Record<string, CollectionConfig>
  /** Write `llms.txt`, `llms-full.txt` and `<url>.md` for every page, for coding agents. Default `false`. */
  llms?: boolean | LlmsConfig
  /** Shiki themes and languages for code blocks. */
  code?: CodeConfig
  /**
   * The start of an "edit this page" link; the source file's path from the project root is appended:
   * `https://github.com/acme/docs/edit/main` gives `.../edit/main/content/docs/cli.md`.
   */
  editUrl?: string
}

declare module '@kitr/core' {
  interface ConfigRegistry {
    content: ContentConfig
  }
}

/** Types the default export of `config/content.ts`, which `kitr generate` reads. */
export const defineConfig = createDefineConfig<ContentConfig>()

/** A piece of a rendered page: HTML, or a `kitr ...` command the app renders with a package-manager picker. */
export type Block = { type: 'html'; html: string } | { type: 'cmd'; cmd: string }

/** One h2 or h3 of a page, for the table of contents. `id` is the heading's anchor. */
export interface TocEntry {
  /** 2 for an h2, 3 for an h3. */
  depth: number
  /** The heading's `id`, for `#id` links. */
  id: string
  /** The heading as plain text, without a step number. */
  text: string
}

/** A rendered page, as `loadPage(collection, slug)` returns it. */
export interface Page {
  /** The page's path: `/docs/getting-started`. */
  url: string
  /** From `nav.json`, the frontmatter or the leading `# heading`, in that order. */
  title: string
  /** From `nav.json` or the frontmatter. */
  description?: string
  /** The nav group the page is listed under. */
  section: string
  /** The frontmatter, as written. */
  data: Record<string, string | number>
  /** The body: HTML and the `kitr` commands between it. */
  blocks: Block[]
  /** The page's h2 and h3 headings, in order. */
  toc: TocEntry[]
  /** The page has numbered `## 1. Step` headings. */
  steps: boolean
  /** The "edit this page" link, when `editUrl` is set. */
  editUrl?: string
}

/** One page in a nav group. `S` is the collection's slug union in the generated `#kitr/content`. */
export interface NavItem<S extends string = string> {
  /** The file name without `.md`, and the last segment of the page's URL. */
  slug: S
  title: string
  description?: string
}

/** A titled group of pages, in the order `nav.json` lists them. */
export interface NavGroup<S extends string = string> {
  title: string
  description?: string
  items: NavItem<S>[]
}

/** One search result: a whole page (`heading` empty) or one of its h2/h3 sections. */
export interface SearchEntry {
  /** The page path, with `#id` for a section. */
  url: string
  /** The page title. */
  title: string
  /** The nav group, shown next to the result. */
  section: string
  /** The section heading; empty for the page itself. */
  heading: string
  /** The plain text of the page's intro or of the section, for matching and the snippet. */
  text: string
}
