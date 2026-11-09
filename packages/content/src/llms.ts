import { parseFrontmatter } from './frontmatter'

/**
 * `llms.txt`, `llms-full.txt` and `<url>.md`, the plain-markdown copies of the docs that coding
 * agents read. Built from `llms.json` (written by `kitr generate`) and the markdown sources, so
 * nothing is rendered twice.
 */

/** One line of `llms.txt`: a page and the markdown file its text comes from. */
export interface LlmsPage {
  url: string
  title: string
  description?: string
  section: string
  /** The markdown file, relative to the project root. */
  source: string
}

/** What `llms.json` holds: the `llms.txt` header and every page in nav order. */
export interface LlmsIndex {
  title: string
  description?: string
  url?: string
  pages: LlmsPage[]
}

/** A page's markdown as agents read it: `# Title`, the description, then the body without its own `# heading`. */
export function pageMarkdown(entry: LlmsPage, source: string): string {
  const { body } = parseFrontmatter(source)
  const text = body.replace(/^\s*# .*\r?\n/, '').trim()
  return `# ${entry.title}\n\n${entry.description ? `${entry.description}\n\n` : ''}${text}\n`
}

/** `llms.txt`: the title, the summary, then one link per page under its group's heading. */
export function llmsTxt(index: LlmsIndex): string {
  const base = index.url ?? ''
  const lines = [`# ${index.title}`, '']
  if (index.description) lines.push(`> ${index.description}`, '')
  let section: string | undefined
  for (const p of index.pages) {
    if (p.section !== section) {
      if (section !== undefined) lines.push('')
      lines.push(`## ${p.section}`, '')
      section = p.section
    }
    lines.push(`- [${p.title}](${base}${p.url}.md)${p.description ? `: ${p.description}` : ''}`)
  }
  return `${lines.join('\n')}\n`
}

/** `llms-full.txt`: every page's markdown in nav order, each headed by its title and URL. */
export function llmsFullTxt(index: LlmsIndex, read: (source: string) => string): string {
  const base = index.url ?? ''
  return index.pages
    .map((p) => {
      const { body } = parseFrontmatter(read(p.source))
      const text = body.replace(/^\s*# .*\r?\n/, '').trim()
      return `# ${p.title}\n\nSource: ${base}${p.url}\n\n${text}\n`
    })
    .join('\n\n')
}
