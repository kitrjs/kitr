import type { SearchEntry } from './model'

/**
 * Rank search entries against a query. Every word must match somewhere. A whole word in the
 * title is worth 6 on the page's own entry and 2 on each of its sections, in the heading 4 and in
 * the text 1; a word that only matches inside a longer one (`kitr` in `kitrrc.ts`) counts half in
 * the title and heading. An exact title gets 10 more. A query of several words that appears as
 * typed gets 8 more in the heading or 6 more in the text, so `kitr remove` finds the command
 * before pages that merely say "kitr" and "remove". A whole page beats one of its sections, and at
 * most two results come from one page so one long page cannot fill the list.
 *
 *   search(await loadSearch(), 'deploy static', 8)
 */
export function search<E extends SearchEntry>(entries: E[], query: string, limit = 8): E[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (!words.length) return []
  const exact = words.join(' ')
  const scored: Array<[number, E]> = []
  for (const entry of entries) {
    const title = entry.title.toLowerCase()
    const heading = entry.heading.toLowerCase()
    const text = entry.text.toLowerCase()
    let score = 0
    const titleWeight = entry.heading ? 2 : 6
    for (const w of words) {
      const s = weigh(title, w, titleWeight) + weigh(heading, w, 4) + (text.includes(w) ? 1 : 0)
      if (!s) {
        score = 0
        break
      }
      score += s
    }
    if (score && title === exact) score += 10
    if (score && words.length > 1) {
      if (heading.includes(exact)) score += 8
      else if (text.includes(exact)) score += 6
    }
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

/** `weight` when `word` is a whole word of `field`, half when it is only part of one, else 0. */
function weigh(field: string, word: string, weight: number): number {
  let at = field.indexOf(word)
  if (at < 0) return 0
  while (at >= 0) {
    const before = field[at - 1]
    const after = field[at + word.length]
    if (!isWordChar(before) && !isWordChar(after)) return weight
    at = field.indexOf(word, at + 1)
  }
  return weight / 2
}

const isWordChar = (c: string | undefined) => c !== undefined && /[\p{L}\p{N}_]/u.test(c)
