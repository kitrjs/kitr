---
title: API reference
description: Every export of @kitr/content, with its signature.
order: 2
---

# API reference

Every export of `@kitr/content`, `@kitr/content/react`, `@kitr/content/markdown`, `@kitr/content/types`, `@kitr/content/vite`, read from the published type definitions. The [guide](/packages/content/guide) shows them in use.

## @kitr/content

### search

```ts
function search<E extends SearchEntry>(entries: E[], query: string, limit?: number): E[];
```

Rank search entries against a query. Every word must match somewhere: in the title it is worth
6, in the heading 4 and in the text 1, and an exact title gets 10 more. A whole page beats one
of its sections, and at most two results come from one page so one long page cannot fill the list.

```ts
search(await loadSearch(), 'deploy static', 8)
```

### defineConfig

```ts
const defineConfig: <const C extends ContentConfig>(config: C) => C;
```

Types the default export of `config/content.ts`, which `kitr generate` reads.

### CodeConfig

```ts
interface CodeConfig {
  /** Default `{ light: 'github-light-high-contrast', dark: 'github-dark' }`. */
  themes?: {
    light: string;
    dark: string;
  };
  /** Languages to load. A fence in any other language renders as plain text. Default: ts, tsx, js, jsx, json, sh, bash, css, html, md, yaml, diff. */
  langs?: string[];
}
```

The code highlighter: Shiki themes for light and dark, and the languages it loads.

### CollectionConfig

```ts
interface CollectionConfig {
  /** The folder of `*.md` files, relative to the project root. */
  source: string;
  /** The URL prefix each page is served under: `/docs` serves `getting-started.md` at `/docs/getting-started`. */
  url: string;
  /**
   * A JSON file in `source` that orders and groups the pages (`nav.json`). Without it every `*.md`
   * is listed in one group, sorted by the frontmatter `order`, then by title.
   */
  nav?: string;
  /** The group title when there is no `nav`, and the section search shows. Default: the collection name, capitalised. */
  title?: string;
}
```

One folder of markdown pages served under one URL prefix: `docs: { source: 'content/docs', url: '/docs' }`.

### ContentConfig

```ts
interface ContentConfig {
  /** The collections by name. The name is what `loadPage(name, slug)` and `nav[name]` use. */
  collections: Record<string, CollectionConfig>;
  /** Write `llms.txt`, `llms-full.txt` and `<url>.md` for every page, for coding agents. Default `false`. */
  llms?: boolean | LlmsConfig;
  /** Shiki themes and languages for code blocks. */
  code?: CodeConfig;
  /**
   * The start of an "edit this page" link; the source file's path from the project root is appended:
   * `https://github.com/acme/docs/edit/main` gives `.../edit/main/content/docs/cli.md`.
   */
  editUrl?: string;
}
```

The options in `config/content.ts`. `kitr generate` reads them; the app never does at run time.

### LlmsConfig

```ts
interface LlmsConfig {
  /** The `# heading` of `llms.txt`. Default: the `name` in package.json as words (`acme-docs` is `Acme Docs`). */
  title?: string;
  /** The `> summary` line under the heading. */
  description?: string;
  /** The site's origin (`https://docs.acme.com`), so the links in `llms.txt` are absolute. Default: relative links. */
  url?: string;
}
```

What `llms: { ... }` sets for `llms.txt`. `llms: true` uses the defaults.

### NavGroup

```ts
interface NavGroup<S extends string = string> {
  title: string;
  description?: string;
  items: NavItem<S>[];
}
```

A titled group of pages, in the order `nav.json` lists them.

### NavItem

```ts
interface NavItem<S extends string = string> {
  /** The file name without `.md`, and the last segment of the page's URL. */
  slug: S;
  title: string;
  description?: string;
}
```

One page in a nav group. `S` is the collection's slug union in the generated `#kitr/content`.

### Page

```ts
interface Page {
  /** The page's path: `/docs/getting-started`. */
  url: string;
  /** From `nav.json`, the frontmatter or the leading `# heading`, in that order. */
  title: string;
  /** From `nav.json` or the frontmatter. */
  description?: string;
  /** The nav group the page is listed under. */
  section: string;
  /** The frontmatter, as written. */
  data: Record<string, string | number>;
  /** The body: HTML and the `kitr` commands between it. */
  blocks: Block[];
  /** The page's h2 and h3 headings, in order. */
  toc: TocEntry[];
  /** The page has numbered `## 1. Step` headings. */
  steps: boolean;
  /** The "edit this page" link, when `editUrl` is set. */
  editUrl?: string;
}
```

A rendered page, as `loadPage(collection, slug)` returns it.

### SearchEntry

```ts
interface SearchEntry {
  /** The page path, with `#id` for a section. */
  url: string;
  /** The page title. */
  title: string;
  /** The nav group, shown next to the result. */
  section: string;
  /** The section heading; empty for the page itself. */
  heading: string;
  /** The plain text of the page's intro or of the section, for matching and the snippet. */
  text: string;
}
```

One search result: a whole page (`heading` empty) or one of its h2/h3 sections.

### TocEntry

```ts
interface TocEntry {
  /** 2 for an h2, 3 for an h3. */
  depth: number;
  /** The heading's `id`, for `#id` links. */
  id: string;
  /** The heading as plain text, without a step number. */
  text: string;
}
```

One h2 or h3 of a page, for the table of contents. `id` is the heading's anchor.

### Block

```ts
type Block = {
  type: 'html';
  html: string;
} | {
  type: 'cmd';
  cmd: string;
};
```

A piece of a rendered page: HTML, or a `kitr ...` command the app renders with a package-manager picker.

## @kitr/content/react

### DocBody

```ts
function DocBody({ page, renderCommand, className }: DocBodyProps): import("react").JSX.Element;
```

A page's rendered markdown: the HTML blocks from `kitr generate` with each `kitr` command
rendered by `renderCommand` between them. It adds a Copy button to every code block and keeps
clicks on internal links (`/docs/cli`) in the app's router instead of reloading the page.

### Toc

```ts
function Toc({ page, title, active, className }: TocProps): import("react").JSX.Element | null;
```

"On this page": the page's h2 and h3 as links, the one being read marked, and an edit link when the page has one.

### useActiveHeading

```ts
function useActiveHeading(toc: TocEntry[], offset?: number): string | undefined;
```

The id of the heading being read: the last one whose top has scrolled above `offset` pixels
(the height of a sticky header, plus some), or the last heading once the page is at its end.

### DocBodyProps

```ts
interface DocBodyProps {
  /** The page from `loadPage(collection, slug)`. Only `blocks` and `steps` are read. */
  page: Pick<Page, 'blocks' | 'steps'>;
  /**
   * Render a `kitr ...` command block, such as a package-manager picker:
   * `renderCommand={(cmd) => <Command cmd={cmd} />}`. Default: a plain code block.
   */
  renderCommand?: (cmd: string) => ReactNode;
  /** Classes added after `prose`. */
  className?: string;
}
```

Props of `<DocBody>`.

### TocProps

```ts
interface TocProps {
  /** The page from `loadPage(collection, slug)`. `toc` and `editUrl` are read. */
  page: Pick<Page, 'toc' | 'editUrl'>;
  /** The label above the list and the navigation's name. Default `On this page`. */
  title?: string;
  /** The heading to mark as current. Default: `useActiveHeading(page.toc)`. */
  active?: string;
  className?: string;
}
```

Props of `<Toc>`.

## @kitr/content/markdown

### parseFrontmatter

```ts
function parseFrontmatter(source: string): {
  data: Record<string, string | number>;
  body: string;
};
```

Split `---` frontmatter from the body. Each `key: value` line becomes a string; `order` becomes
a number. Quotes around a value are dropped.

### renderMarkdown

```ts
function renderMarkdown(markdown: string, options?: RenderOptions): Promise<RenderedMarkdown>;
```

Render one markdown body (no frontmatter) to blocks, a table of contents and search text. The
leading `# heading` is returned as `heading` and left out of the HTML: pages render their title
themselves.

```ts
const page = await renderMarkdown('# Install\n\n```sh\nkitr add content\n```\n')
// => { heading: 'Install', blocks: [{ type: 'cmd', cmd: 'kitr add content' }], ... }
```

### defaultLangs

```ts
const defaultLangs: readonly [
  "ts",
  "tsx",
  "js",
  "jsx",
  "json",
  "sh",
  "bash",
  "css",
  "html",
  "md",
  "yaml",
  "diff"
];
```

The languages loaded when `code.langs` is not set.

### defaultThemes

```ts
const defaultThemes: {
  readonly light: "github-light-high-contrast";
  readonly dark: "github-dark";
};
```

The Shiki themes used when `code.themes` is not set.

### RenderedMarkdown

```ts
interface RenderedMarkdown {
  /** The leading `# heading`, which is dropped from the body. */
  heading?: string;
  blocks: Block[];
  toc: TocEntry[];
  /** True when the page has numbered `## 1. Step` headings. */
  steps: boolean;
  /** The plain text before the first h2, for search. */
  intro: string;
  sections: RenderedSection[];
}
```

What `renderMarkdown` returns.

### RenderedSection

```ts
interface RenderedSection {
  id: string;
  heading: string;
  text: string;
}
```

One h2 or h3 and the plain text under it, for search.

### RenderOptions

```ts
interface RenderOptions {
  /** Shiki themes and languages. */
  code?: CodeConfig;
  /**
   * Rewrite a relative link to another markdown file (`./cli.md#flags`): return the page URL
   * (`/docs/cli#flags`), or `undefined` to keep the link as written.
   */
  resolveLink?: (href: string) => string | undefined;
}
```

Options for `renderMarkdown`.

## @kitr/content/types

### contentFiles

```ts
function contentFiles(content: BuiltContent): GeneratedFile[];
```

The generated files for built content, relative to `.kitr/`.

### loadContentConfig

```ts
function loadContentConfig(root: string, configDir?: string): Promise<ContentConfig | undefined>;
```

Run `config/content.ts` with jiti from the project root, the way the CLI runs `kitrrc.ts`, so
the file can import `defineConfig` from `@kitr/content` and compute values. `undefined` when
the project has no such file.

### renderIndex

```ts
function renderIndex(content: Pick<BuiltContent, 'nav'>): string;
```

`.kitr/content/index.ts`: the nav inline, typed slugs, and lazy loaders for pages and search.

### OUT_DIR

```ts
const OUT_DIR = "content";
```

The folder under `.kitr/` this generator writes.

## @kitr/content/vite

### kitrContent

```ts
function kitrContent(options?: ContentViteOptions): Plugin;
```

The content package's Vite plugin, added by `@kitr/vite` because the package declares it. When
`llms` is on in `config/content.ts`, the dev server answers `/llms.txt`, `/llms-full.txt` and
`<page url>.md`, and a build writes the same files next to the HTML in the client output, so a
static or server-rendered site ships them. The text comes from `.kitr/content/llms.json` and
the markdown sources; nothing is rendered twice.

### ContentViteOptions

```ts
interface ContentViteOptions {
  /** Where `kitr generate` wrote `llms.json`, relative to the root. Default `.kitr/content`. */
  dir?: string;
}
```

Options for the content Vite plugin.

<!-- GENERATED by scripts/api-docs.mjs from the type definitions. Do not edit. -->
