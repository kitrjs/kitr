import type { SearchEntry } from './model'

/**
 * Rank search entries against a query. Every word must match somewhere: in the title it is worth
 * 6, in the heading 4 and in the text 1, and an exact title gets 10 more. A whole page beats one
 * of its sections, and at most two results come from one page so one long page cannot fill the list.
 *
 *   search(await loadSearch(), 'deploy static', 8)
 */
export function search<E extends SearchEntry>(entries: E[], query: string, limit = 8): E[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (!words.length) return []
  const exact = query.toLowerCase().trim()
  const scored: Array<[number, E]> = []
  for (const entry of entries) {
    const title = entry.title.toLowerCase()
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
    if (score && title === exact) score += 10
    if (score) scored.push([score - (entry.heading ? 0.5 : 0), entry])
  }
  const perPage = new Map<string, number>()
  const out: E[] = []
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
