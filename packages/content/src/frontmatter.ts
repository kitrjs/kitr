/**
 * Split `---` frontmatter from the body. Each `key: value` line becomes a string; `order` becomes
 * a number. Quotes around a value are dropped.
 */
export function parseFrontmatter(source: string): {
  data: Record<string, string | number>
  body: string
} {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/)
  if (!match) return { data: {}, body: source }
  const data: Record<string, string | number> = {}
  for (const line of match[1]!.split(/\r?\n/)) {
    const m = line.match(/^([\w-]+):\s*(.*)$/)
    if (m) data[m[1]!] = m[2]!.trim().replace(/^(['"])(.*)\1$/, '$2')
  }
  if (typeof data.order === 'string' && data.order.trim() && !Number.isNaN(Number(data.order)))
    data.order = Number(data.order)
  return { data, body: source.slice(match[0].length) }
}
