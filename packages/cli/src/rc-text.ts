/**
 * kitrrc.ts edited as text. The file is the user's: its order, comments, quotes, indentation
 * and renamed imports must survive `kitr add`, `kitr remove` and `kitr config`. A syntax tree
 * printed back (magicast, recast) reflows what it touches and mangles tab indentation, and the
 * offsets it reports count tabs as spaces, so edits find their place with a small scanner that
 * knows only strings, comments and brackets, and change nothing but the bytes they own.
 */

/** A bracketed block in the source: `[...]` (a list) or `{...}` (an object), and its elements' ranges. */
export interface RcBlock {
  /** Index of the opening bracket. */
  start: number
  /** Index after the closing bracket. */
  end: number
  /** Each top-level element, comments and surrounding commas excluded. */
  elements: Array<{ start: number; end: number }>
}

export const lineStart = (src: string, at: number) => src.lastIndexOf('\n', at - 1) + 1
export const lineEnd = (src: string, at: number) => {
  const i = src.indexOf('\n', at)
  return i === -1 ? src.length : i
}
const indentOf = (src: string, at: number) => /^[ \t]*/.exec(src.slice(lineStart(src, at)))![0]

/**
 * The index after whatever starts at `i` that is not code: a comment, a string or whitespace.
 * Returns `i` itself when the character at `i` is code.
 */
function skipNonCode(src: string, i: number): number {
  const c = src[i]
  if (c === '/' && src[i + 1] === '/') return lineEnd(src, i)
  if (c === '/' && src[i + 1] === '*') {
    const close = src.indexOf('*/', i + 2)
    return close === -1 ? src.length : close + 2
  }
  if (c === '"' || c === "'" || c === '`') {
    let j = i + 1
    while (j < src.length && src[j] !== c) j += src[j] === '\\' ? 2 : 1
    return j + 1
  }
  return c !== undefined && /\s/.test(c) ? i + 1 : i
}

/** The options object of the default export: the first `{` after `export default`. */
export function findOptionsObject(src: string): number {
  for (let i = 0; i < src.length; ) {
    const next = skipNonCode(src, i)
    if (next !== i) i = next
    else if (/^export\s+default\b/.test(src.slice(i, i + 20))) {
      for (let j = i + 14; j < src.length; ) {
        const skipped = skipNonCode(src, j)
        if (skipped !== j) j = skipped
        else if (src[j] === '{') return j
        else j++
      }
      return -1
    } else i++
  }
  return -1
}

/**
 * The block `key: [...]` or `key: {...}` directly inside the options object of kitrrc.ts's
 * default export.
 */
export function findRcBlock(src: string, key: string, open: '[' | '{'): RcBlock | undefined {
  const keyed = new RegExp(`(['"]?)${key}\\1\\s*:\\s*\\${open}`, 'y')
  const object = findOptionsObject(src)
  if (object === -1) return undefined
  let depth = 0
  for (let i = object; i < src.length; ) {
    // A key may be a quoted string, so try it before strings are skipped.
    if (depth === 1 && !/[\w$.]/.test(src[i - 1] ?? '')) {
      keyed.lastIndex = i
      const m = keyed.exec(src)
      if (m) return readBlock(src, i + m[0].length - 1)
    }
    const skipped = skipNonCode(src, i)
    if (skipped !== i) {
      i = skipped
      continue
    }
    const c = src[i]!
    if ('([{'.includes(c)) depth++
    else if (')]}'.includes(c) && --depth === 0) return undefined
    i++
  }
  return undefined
}

/** The elements of the block whose opening bracket is at `open`. */
function readBlock(src: string, open: number): RcBlock | undefined {
  const closing = src[open] === '[' ? ']' : '}'
  const elements: RcBlock['elements'] = []
  let depth = 0
  let start = -1
  let end = -1
  const finish = () => {
    if (start !== -1) elements.push({ start, end })
    start = -1
  }
  for (let i = open + 1; i < src.length; ) {
    const skipped = skipNonCode(src, i)
    if (skipped !== i) {
      // A string is part of an element; whitespace and comments are not.
      if (/['"`]/.test(src[i]!)) {
        if (start === -1) start = i
        end = skipped
      }
      i = skipped
      continue
    }
    const c = src[i]!
    if (depth === 0 && c === closing) {
      finish()
      return { start: open, end: i + 1, elements }
    }
    if (depth === 0 && c === ',') {
      finish()
      i++
      continue
    }
    if ('([{'.includes(c)) depth++
    else if (')]}'.includes(c)) depth--
    if (start === -1) start = i
    end = i + 1
    i++
  }
  return undefined
}

/** The quote the block's first element is written with, `'` when it has none. */
export function quoteOf(src: string, block: RcBlock): string {
  const first = block.elements[0]
  return (first && /['"]/.exec(src.slice(first.start, first.end))?.[0]) || "'"
}

/** The quote the file's imports are written with, `'` when it has none. */
export function fileQuote(src: string): string {
  return /^import\b[^\n]*?(['"])/m.exec(src)?.[1] ?? "'"
}

/** Insert an entry after the block's last element, in the style the block is already written in. */
export function insertEntry(src: string, block: RcBlock, entry: string): string {
  const last = block.elements.at(-1)
  if (!last) {
    const lineIndent = indentOf(src, block.start)
    const unit = lineIndent.includes('\t') ? '\t' : '  '
    const inner = src.slice(block.start + 1, block.end - 1)
    const kept = inner.trim() ? `${inner.trimEnd()}\n` : '\n'
    return `${src.slice(0, block.start + 1)}${kept}${lineIndent}${unit}${entry},\n${lineIndent}${src.slice(block.end - 1)}`
  }
  const comma = /^\s*,/.exec(src.slice(last.end))?.[0] ?? ''
  const afterLast = last.end + comma.length
  const alone = /^[ \t]*$/.test(src.slice(lineStart(src, last.start), last.start))
  if (!alone) {
    // An inline block: `[a, b]` becomes `[a, b, c]`.
    return comma
      ? `${src.slice(0, afterLast)} ${entry},${src.slice(afterLast)}`
      : `${src.slice(0, last.end)}, ${entry}${src.slice(last.end)}`
  }
  // One entry per line: the new one goes on the line after the last, past a comment trailing it.
  const at = lineEnd(src, afterLast)
  const head = comma ? src.slice(0, at) : `${src.slice(0, last.end)},${src.slice(last.end, at)}`
  return `${head}\n${indentOf(src, last.start)}${entry}${comma ? ',' : ''}${src.slice(at)}`
}

/** Remove elements; one on a line of its own takes the line (and a comment trailing it) along. */
export function removeEntries(src: string, block: RcBlock, doomed: RcBlock['elements']): string {
  let out = src
  for (const el of [...doomed].reverse()) {
    const comma = /^[ \t]*,?/.exec(out.slice(el.end))?.[0] ?? ''
    const afterEl = el.end + comma.length
    const rest = out.slice(afterEl, lineEnd(out, afterEl))
    const before = out.slice(lineStart(out, el.start), el.start)
    if (/^[ \t]*$/.test(before) && /^[ \t]*(\/\/.*|\/\*.*\*\/[ \t]*)?$/.test(rest)) {
      const to = Math.min(lineEnd(out, afterEl) + 1, out.length)
      out = out.slice(0, lineStart(out, el.start)) + out.slice(to)
      continue
    }
    // Inline: drop the element with the comma that follows it, or the one before it when last.
    if (comma.includes(',')) {
      const gap = /^\s*/.exec(out.slice(afterEl))?.[0] ?? ''
      out = out.slice(0, el.start) + out.slice(afterEl + gap.length)
    } else {
      const prev = /,\s*$/.exec(out.slice(block.start, el.start))?.[0] ?? ''
      out = out.slice(0, el.start - prev.length) + out.slice(el.end)
    }
  }
  return out
}

/**
 * Add `key: value` as the last property of the options object, for a file that has no such key
 * yet. Returns the source unchanged when it has no options object.
 */
export function addProperty(src: string, key: string, value: string): string {
  const object = findOptionsObject(src)
  if (object === -1) return src
  const block = readBlock(src, object)
  if (!block) return src
  return insertEntry(src, block, `${key}: ${value}`)
}

/** The end of the last import statement (after its newline), or 0 when there is none. */
function afterLastImport(src: string): number {
  const imports = /^import\b[^;'"]*?(?:from\s*)?(['"])[^'"\n]+\1;?[ \t]*(?:\/\/[^\n]*)?\n?/gm
  let at = 0
  for (let m = imports.exec(src); m; m = imports.exec(src)) at = m.index + m[0].length
  return at
}

/** `import { name } from 'spec'` after the last import, in the file's quote and semicolon style. */
export function addNamedImport(src: string, name: string, spec: string): string {
  const escaped = spec.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
  const existing = new RegExp(`import\\s*\\{([^}]*)\\}\\s*from\\s*['"]${escaped}['"]`).exec(src)
  const has = (names: string) =>
    names.split(',').some((n) => (n.trim().split(/\s+as\s+/)[1] ?? n.trim()) === name)
  if (existing && has(existing[1]!)) return src
  const q = fileQuote(src)
  const semi = /^import\b[^\n]*;[ \t]*$/m.test(src) ? ';' : ''
  const line = `import { ${name} } from ${q}${spec}${q}${semi}\n`
  const at = afterLastImport(src)
  if (at === 0) return `${line}${src.startsWith('\n') ? '' : '\n'}${src}`
  const head = src.slice(0, at)
  return `${head}${head.endsWith('\n') ? '' : '\n'}${line}${src.slice(at)}`
}

/** Remove the specifier `local` from the named imports; the whole statement goes when it was the only one. */
export function removeNamedImport(src: string, local: string): string {
  const statement = /^import\s*\{([^}]*)\}\s*from\s*(['"])[^'"\n]+\2;?[ \t]*\n?/gm
  for (let m = statement.exec(src); m; m = statement.exec(src)) {
    const names = m[1]!
      .split(',')
      .map((n) => n.trim())
      .filter(Boolean)
    const keep = names.filter((n) => (n.split(/\s+as\s+/)[1] ?? n) !== local)
    if (keep.length === names.length) continue
    if (!keep.length) return src.slice(0, m.index) + src.slice(m.index + m[0].length)
    const braces = /\{([^}]*)\}/.exec(m[0])!
    const spaced = braces[1]!.startsWith(' ') || !braces[1]!.trim()
    const inner = keep.join(', ')
    const replaced = m[0].replace(/\{[^}]*\}/, spaced ? `{ ${inner} }` : `{${inner}}`)
    return src.slice(0, m.index) + replaced + src.slice(m.index + m[0].length)
  }
  return src
}
