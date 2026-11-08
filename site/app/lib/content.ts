import docsNavJson from '#app/generated/docs-nav.json'
import guidesNavJson from '#app/generated/guides-nav.json'

export type Block = { type: 'html'; html: string } | { type: 'cmd'; cmd: string }

export interface Page {
  url: string
  title: string
  description?: string
  section?: string
  /** Guides only: the packages the guide uses, by short name. */
  packages?: string[]
  /** Guides only: roughly how long the guide takes, such as `30 min`. */
  time?: string
  blocks: Block[]
  /** The page has numbered `## 1. Step` headings. */
  steps?: boolean
  toc: Array<{ depth: number; id: string; text: string }>
  editUrl: string
}

export interface SearchEntry {
  url: string
  title: string
  section: string
  heading: string
  text: string
  /** A package's short name, matched like the title. */
  name?: string
}

export const docsNav = docsNavJson as Array<{
  title: string
  items: Array<{ slug: string; title: string }>
}>

export interface GuideItem {
  slug: string
  title: string
  description: string
  packages: string[]
  /** Platform types the guide ships to: web, server, desktop, tauri, mobile. */
  platforms: string[]
  time?: string
}

export const guidesNav = guidesNavJson as Array<{
  title: string
  description?: string
  items: GuideItem[]
}>

const pages = import.meta.glob<Page>('../generated/pages/*.json', { import: 'default' })

/** One page's rendered content, loaded on demand so each page ships only its own text. */
export async function loadPage(id: string): Promise<Page | null> {
  const load = pages[`../generated/pages/${id}.json`]
  return load ? load() : null
}

let searchIndex: Promise<SearchEntry[]> | undefined
export function loadSearch() {
  searchIndex ??= import('#app/generated/search.json').then((m) => m.default as SearchEntry[])
  return searchIndex
}

/** Rank entries by how many query words they contain, with titles and headings worth more. */
export function search(entries: SearchEntry[], query: string, limit = 8): SearchEntry[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (!words.length) return []
  const scored: Array<[number, SearchEntry]> = []
  for (const entry of entries) {
    const title = `${entry.title} ${entry.name ?? ''}`.toLowerCase()
    const heading = entry.heading.toLowerCase()
    const text = entry.text.toLowerCase()
    let score = 0
    for (const w of words) {
      const s =
        (title.includes(w) ? 6 : 0) + (heading.includes(w) ? 4 : 0) + (text.includes(w) ? 1 : 0)
      if (!s) {
        score = 0
        break
      }
      score += s
    }
    const q = query.toLowerCase().trim()
    if (entry.title.toLowerCase() === q || entry.name === q) score += 10
    // A package's own page first, then its guide and API pages.
    if (entry.name) score += 3
    if (score) scored.push([score - (entry.heading ? 0.5 : 0), entry])
  }
  // At most two hits from one page, so a single long guide doesn't fill the list.
  const perPage = new Map<string, number>()
  const out: SearchEntry[] = []
  for (const [, e] of scored.sort((a, b) => b[0] - a[0])) {
    const page = e.url.split('#')[0] ?? e.url
    const n = perPage.get(page) ?? 0
    if (n >= 2) continue
    perPage.set(page, n + 1)
    out.push(e)
    if (out.length >= limit) break
  }
  return out
}
