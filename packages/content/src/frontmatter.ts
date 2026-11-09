/**
 * Split `---` frontmatter from the body. Each `key: value` line becomes a string; `order` becomes
 * a number. Quotes around a value are dropped.
 */
export function parseFrontmatter(source: string): {
  data: Record<string, string | number>
  body: string
} {
  const block = frontmatterBlock(source)
  if (!block) return { data: {}, body: source }
  const data: Record<string, string | number> = {}
  for (const line of block.yaml.split(/\r?\n/)) {
    const m = line.match(/^([\w-]+):(.*)$/)
    if (m) data[m[1]!] = m[2]!.trim().replace(/^(['"])(.*)\1$/, '$2')
  }
  if (typeof data.order === 'string' && data.order.trim() && !Number.isNaN(Number(data.order)))
    data.order = Number(data.order)
  return { data, body: source.slice(block.end) }
}

/** The text between the opening and closing `---` fences, and where the body starts. Scanned, not regex-matched, so unclosed blocks stay linear. */
function frontmatterBlock(source: string): { yaml: string; end: number } | undefined {
  const open = source.startsWith('---\n') ? 4 : source.startsWith('---\r\n') ? 5 : 0
  if (!open) return undefined
  const nl = source.indexOf('\n---', open)
  if (nl === -1) return undefined
  const yamlEnd = nl > open && source[nl - 1] === '\r' ? nl - 1 : nl
  let end = nl + 4
  if (source[end] === '\r' && source[end + 1] === '\n') end += 2
  else if (source[end] === '\n') end++
  return { yaml: source.slice(open, yamlEnd), end }
}
