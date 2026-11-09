import rehypeSlug from 'rehype-slug'
import rehypeStringify from 'rehype-stringify'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { createHighlighter, type Highlighter } from 'shiki'
import { unified } from 'unified'
import { visit } from 'unist-util-visit'
import type { Block, CodeConfig, TocEntry } from './model'

export { parseFrontmatter } from './frontmatter'

/**
 * The markdown pipeline behind `kitr generate`: GitHub markdown, callouts, Shiki code blocks with
 * captions, `kitr` command blocks, a table of contents, numbered steps, "Next steps" cards and
 * plain text for search. It runs at build time in Node; pages ship as the HTML it returns.
 */

/** A markdown node of either tree (mdast or hast), as loosely as the plugins below need it. */
interface MdNode {
  type: string
  tagName?: string
  value?: string
  url?: string
  lang?: string | null
  properties?: Record<string, any>
  children?: MdNode[]
  data?: Record<string, any>
}

/** One h2 or h3 and the plain text under it, for search. */
export interface RenderedSection {
  id: string
  heading: string
  text: string
}

/** What `renderMarkdown` returns. */
export interface RenderedMarkdown {
  /** The leading `# heading`, which is dropped from the body. */
  heading?: string
  blocks: Block[]
  toc: TocEntry[]
  /** True when the page has numbered `## 1. Step` headings. */
  steps: boolean
  /** The plain text before the first h2, for search. */
  intro: string
  sections: RenderedSection[]
}

/** Options for `renderMarkdown`. */
export interface RenderOptions {
  /** Shiki themes and languages. */
  code?: CodeConfig
  /**
   * Rewrite a relative link to another markdown file (`./cli.md#flags`): return the page URL
   * (`/docs/cli#flags`), or `undefined` to keep the link as written.
   */
  resolveLink?: (href: string) => string | undefined
}

/** The Shiki themes used when `code.themes` is not set. */
export const defaultThemes = { light: 'github-light-high-contrast', dark: 'github-dark' } as const
/** The languages loaded when `code.langs` is not set. */
export const defaultLangs = [
  'ts',
  'tsx',
  'js',
  'jsx',
  'json',
  'sh',
  'bash',
  'css',
  'html',
  'md',
  'yaml',
  'diff',
] as const

// kitr-allow-module-state: a cache of pure computations (one Shiki highlighter per theme and language set), so regenerating in dev does not reload grammars
const highlighters = new Map<string, Promise<Highlighter>>()

function highlighterFor(code: CodeConfig = {}) {
  const themes = code.themes ?? defaultThemes
  const langs = code.langs ?? [...defaultLangs]
  const key = JSON.stringify([themes, langs])
  let highlighter = highlighters.get(key)
  if (!highlighter) {
    highlighter = createHighlighter({ themes: [themes.light, themes.dark], langs })
    highlighters.set(key, highlighter)
  }
  return highlighter.then((h) => ({ highlighter: h, themes }))
}

const escapeAttr = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')

const calloutTitles = {
  NOTE: 'Note',
  TIP: 'Tip',
  WARNING: 'Warning',
  SUMMARY: 'The short version',
} as const

/**
 * GitHub alerts: `> [!NOTE]` (TIP, WARNING, SUMMARY) turns a blockquote into
 * `<aside class="callout callout-note" role="note">` with a title line. Text after the marker on
 * its line is the title. The older `> **Warning**` form on its own line counts as `> [!WARNING]`.
 */
function remarkCallouts() {
  return (tree: MdNode) => {
    visit(tree as any, 'blockquote', (node: MdNode) => {
      const kids = node.children ?? []
      const first = kids[0]
      const inline = first?.type === 'paragraph' ? (first.children ?? []) : []
      const bold = inline[0]
      const word =
        bold?.type === 'strong' && bold.children?.length === 1 && bold.children[0]!.type === 'text'
          ? bold.children[0]!.value!.trim().match(/^(note|tip|warning)$/i)
          : null
      const after = inline[1]
      if (
        word &&
        (!after ||
          after.type === 'break' ||
          (after.type === 'text' && after.value!.startsWith('\n')))
      ) {
        const marker = `[!${word[1]!.toUpperCase()}]`
        if (after?.type === 'text')
          inline.splice(0, 2, { type: 'text', value: marker + after.value })
        else inline.splice(0, 1, { type: 'text', value: `${marker}\n` })
      }
      const lead = inline[0]
      const m =
        lead?.type === 'text' ? lead.value!.match(/^\[!(NOTE|TIP|WARNING|SUMMARY)\][ \t]*/) : null
      if (!m || !lead) return
      const kind = m[1] as keyof typeof calloutTitles
      const rest = inline.slice(1)
      let title: MdNode[] = []
      let body: MdNode[] = rest
      const afterMarker = lead.value!.slice(m[0].length)
      const nl = afterMarker.indexOf('\n')
      const sameLine = nl === -1 ? afterMarker : afterMarker.slice(0, nl)
      if (nl !== -1) {
        // The title is the rest of the marker's line; what follows starts the body.
        if (sameLine.trim()) title.push({ type: 'text', value: sameLine.trim() })
        const tail = afterMarker.slice(nl + 1)
        body = tail ? [{ type: 'text', value: tail }, ...rest] : rest
      } else {
        // The marker's line runs on through inline nodes up to the next line break.
        if (sameLine) title.push({ type: 'text', value: sameLine })
        body = []
        for (let i = 0; i < rest.length; i++) {
          const n = rest[i]!
          if (n.type === 'text' && n.value!.includes('\n')) {
            const at = n.value!.indexOf('\n')
            if (n.value!.slice(0, at)) title.push({ type: 'text', value: n.value!.slice(0, at) })
            const tail = n.value!.slice(at + 1)
            body = tail ? [{ type: 'text', value: tail }, ...rest.slice(i + 1)] : rest.slice(i + 1)
            break
          }
          if (n.type === 'break') {
            body = rest.slice(i + 1)
            break
          }
          title.push(n)
        }
      }
      if (!title.length) title = [{ type: 'text', value: calloutTitles[kind] }]
      const children: MdNode[] = [
        {
          type: 'paragraph',
          data: { hProperties: { className: ['callout-title'] } },
          children: title,
        },
      ]
      if (body.length) children.push({ type: 'paragraph', children: body })
      children.push(...kids.slice(1))
      node.children = children
      node.data = {
        hName: 'aside',
        hProperties: { className: ['callout', `callout-${kind.toLowerCase()}`], role: 'note' },
      }
    })
  }
}

const shells = ['sh', 'bash', 'shell', 'zsh', 'console'] as const
/** A first line that names the file the block is: `// app/routes.ts`, `# config.yaml`, `<!-- index.html -->`. */
const captionLine =
  /^\s*(?:\/\/|#|\/\*|<!--)\s*([^\s'"`<>]*[\w/$\]-]\.[A-Za-z0-9]+)\s*(?:\*\/|-->)?\s*$/

/**
 * Code blocks: Shiki HTML with both themes as CSS variables, wrapped in `div.code`. A shell block
 * whose every line starts with `kitr ` becomes a command block instead, and a first line that
 * names a file becomes the block's caption.
 */
function remarkCode(highlighter: Highlighter, themes: { light: string; dark: string }) {
  const langs = new Set(highlighter.getLoadedLanguages())
  return () => (tree: MdNode) => {
    visit(tree as any, 'code', (node: MdNode, index: number | undefined, parent: MdNode) => {
      if (index === undefined || !parent?.children) return
      const lang = node.lang ?? ''
      const lines = (node.value ?? '').split('\n').filter((l) => l.trim())
      const isShell = (shells as readonly string[]).includes(lang)
      if (isShell && lines.length && lines.every((l) => /^kitr\s/.test(l.trim()))) {
        parent.children[index] = {
          type: 'html',
          value: `<kitr-cmd data-cmd="${escapeAttr(lines.map((l) => l.trim()).join('\n'))}"></kitr-cmd>`,
        }
        return
      }
      let code = node.value ?? ''
      const firstLine = code.split('\n', 1)[0] ?? ''
      const caption = isShell ? null : firstLine.match(captionLine)
      const file = caption?.[1]
      if (file) code = code.slice(firstLine.length + 1)
      const used = langs.has(lang) ? lang : 'text'
      const html = highlighter
        .codeToHtml(code, { lang: used, themes, defaultColor: false })
        .replace(
          '<pre ',
          `<pre data-lang="${escapeAttr(used)}"${file ? ` data-file="${escapeAttr(file)}"` : ''} `,
        )
      parent.children[index] = {
        type: 'html',
        value: `<div class="code">${file ? `<div class="code-file">${escapeHtml(file)}</div>` : ''}${html}</div>`,
      }
    })
  }
}

/** Relative links to other markdown files point at the pages they became. */
function remarkLinks(resolve: ((href: string) => string | undefined) | undefined) {
  return () => (tree: MdNode) => {
    if (!resolve) return
    visit(tree as any, ['link', 'definition'], (node: MdNode) => {
      const url = node.url ?? ''
      if (/^[a-z][\w+.-]*:|^\/|^#/i.test(url) || !/\.md(#|$)/.test(url)) return
      const to = resolve(url)
      if (to) node.url = to
    })
  }
}

const nextHeading = /^(next steps|what next|where next)$/i
const isBlank = (n: MdNode) => n.type === 'text' && !n.value!.trim()
const textOf = (node: MdNode): string =>
  node.type === 'text' ? (node.value ?? '') : (node.children ?? []).map(textOf).join('')
const hasClass = (node: MdNode | undefined, name: string) => {
  const c = node?.properties?.className
  return Array.isArray(c) && c.includes(name)
}

/** A list whose every item starts with a link, as card data; null if it is anything else. */
function cardItems(list: MdNode) {
  const cards: Array<{ link: MdNode; rest: MdNode[] }> = []
  for (const li of (list.children ?? []).filter((n) => n.type === 'element')) {
    let kids = (li.children ?? []).filter((n) => !isBlank(n))
    // A loose list wraps each item in a paragraph.
    if (kids[0]?.type === 'element' && kids[0].tagName === 'p') kids = kids[0].children ?? []
    const [link, ...tail] = kids
    if (link?.type !== 'element' || link.tagName !== 'a') return null
    const rest = tail.map((n) => structuredClone(n))
    const lead = rest[0]
    if (lead?.type === 'text') lead.value = lead.value!.replace(/^\s*[:–—-]?\s*/, '')
    cards.push({ link, rest: rest.filter((n) => !(n.type === 'text' && !n.value)) })
  }
  return cards.length ? cards : null
}

/** The last section, when it is "Next steps" and one list of links, becomes `nav.next-cards`. */
function nextCards(tree: MdNode) {
  const nodes = tree.children ?? []
  let at = -1
  for (let i = nodes.length - 1; i >= 0; i--)
    if (nodes[i]!.type === 'element' && nodes[i]!.tagName === 'h2') {
      at = i
      break
    }
  if (at === -1 || !nextHeading.test(textOf(nodes[at]!).trim())) return
  const body = nodes.slice(at + 1).filter((n) => !isBlank(n))
  const list = body[0]
  if (body.length !== 1 || list?.type !== 'element' || list.tagName !== 'ul') return
  const cards = cardItems(list)
  if (!cards) return
  nodes.splice(at + 1, nodes.length - at - 1, {
    type: 'element',
    tagName: 'nav',
    properties: { className: ['next-cards'], ariaLabel: 'Next steps' },
    children: cards.map(({ link, rest }) => ({
      type: 'element',
      tagName: 'a',
      properties: { ...link.properties, className: ['next-card'] },
      children: [
        {
          type: 'element',
          tagName: 'strong',
          properties: { className: ['next-card-title'] },
          children: link.children ?? [],
        },
        ...(rest.length
          ? [{ type: 'element', tagName: 'span', properties: {}, children: rest }]
          : []),
      ],
    })),
  })
}

interface CollectState {
  toc: TocEntry[]
  sections: RenderedSection[]
  steps: boolean
  intro: { text: string }
}

/**
 * After rehype-slug: h2/h3 into the table of contents, `## 1. Step` headings into step markers,
 * the plain text of each section for search, then next-step cards, scrollable tables and
 * external links that open in a new tab.
 */
function rehypeCollect(state: CollectState) {
  return () => (tree: MdNode) => {
    visit(tree as any, 'element', (node: MdNode) => {
      const id = node.properties?.id
      if ((node.tagName === 'h2' || node.tagName === 'h3') && typeof id === 'string') {
        let heading = textOf(node)
        // "1. Install the CLI": the number becomes a marker; the id stays the slug of the full text.
        const step = node.tagName === 'h2' ? heading.match(/^(\d+)\.\s+/) : null
        const lead = node.children?.[0]
        if (step && lead?.type === 'text') {
          heading = heading.slice(step[0].length)
          lead.value = lead.value!.replace(/^\d+\.\s+/, '')
          node.children!.unshift({
            type: 'element',
            tagName: 'span',
            properties: { className: ['step-marker'], ariaHidden: 'true' },
            children: [{ type: 'text', value: step[1] }],
          })
          node.properties!.className = [...(node.properties!.className ?? []), 'step-heading']
          state.steps = true
        }
        state.toc.push({ depth: node.tagName === 'h2' ? 2 : 3, id, text: heading })
        state.sections.push({ id, heading, text: '' })
      } else if (node.tagName === 'p' || node.tagName === 'li' || node.tagName === 'td') {
        // A callout's title line is a label, not content.
        if (hasClass(node, 'callout-title')) return
        const current = state.sections.at(-1) ?? state.intro
        current.text += ` ${textOf(node)}`
      }
    })
    nextCards(tree)
    // Wide tables scroll inside a focusable region, so keyboard users can scroll them too.
    visit(tree as any, 'element', (node: MdNode, index: number | undefined, parent: MdNode) => {
      if (node.tagName !== 'table' || index === undefined || !parent?.children) return
      if (hasClass(parent, 'table-wrap')) return
      parent.children[index] = {
        type: 'element',
        tagName: 'div',
        properties: { className: ['table-wrap'], tabIndex: 0 },
        children: [node],
      }
    })
    // External links open in a new tab; internal ones stay in the app's router.
    visit(tree as any, 'element', (node: MdNode) => {
      if (node.tagName === 'a' && /^https?:/.test(node.properties?.href ?? '')) {
        node.properties!.target = '_blank'
        node.properties!.rel = 'noreferrer'
      }
    })
  }
}

const normalizeText = (s: string) => s.replace(/\s+/g, ' ').trim()

/** Split the HTML at the command placeholders, so the app renders each command as a component. */
function toBlocks(html: string): Block[] {
  const blocks: Block[] = []
  let last = 0
  for (const m of html.matchAll(/<kitr-cmd data-cmd="([^"]*)"><\/kitr-cmd>/g)) {
    if (m.index! > last) blocks.push({ type: 'html', html: html.slice(last, m.index) })
    blocks.push({
      type: 'cmd',
      cmd: m[1]!
        .replace(/&quot;/g, '"')
        .replace(/&lt;/g, '<')
        .replace(/&amp;/g, '&'),
    })
    last = m.index! + m[0].length
  }
  if (last < html.length) blocks.push({ type: 'html', html: html.slice(last) })
  return blocks.filter((b) => b.type === 'cmd' || b.html.trim())
}

/**
 * Render one markdown body (no frontmatter) to blocks, a table of contents and search text. The
 * leading `# heading` is returned as `heading` and left out of the HTML: pages render their title
 * themselves.
 *
 *   const page = await renderMarkdown('# Install\n\n```sh\nkitr add content\n```\n')
 *   // => { heading: 'Install', blocks: [{ type: 'cmd', cmd: 'kitr add content' }], ... }
 */
export async function renderMarkdown(
  markdown: string,
  options: RenderOptions = {},
): Promise<RenderedMarkdown> {
  const { highlighter, themes } = await highlighterFor(options.code)
  const state: CollectState = { toc: [], sections: [], steps: false, intro: { text: '' } }
  const h1 = markdown.match(/^\s*# (.+)\r?\n?/)
  const body = h1 ? markdown.slice(h1[0].length) : markdown
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkCallouts)
    .use(remarkLinks(options.resolveLink))
    .use(remarkCode(highlighter, themes))
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeSlug)
    .use(rehypeCollect(state))
    .use(rehypeStringify, { allowDangerousHtml: true })
    .process(body)
  return {
    ...(h1 ? { heading: h1[1]!.trim() } : {}),
    blocks: toBlocks(String(file)),
    toc: state.toc,
    steps: state.steps,
    intro: normalizeText(state.intro.text),
    sections: state.sections.map((s) => ({ ...s, text: normalizeText(s.text) })),
  }
}
