/**
 * A small reader for `app/routes.ts`: the `defineRoutes([router], (r) => r.root(...).page(...))`
 * chain. Good enough for a tree, with no TypeScript program: it scans the source once, skipping
 * comments and string contents, finds the `.page(`, `.layout(` and `.group(` calls, nests them by
 * their parentheses and gives each the `import('...')` of its `lazy` option.
 */

export interface RouteEntry {
  kind: 'page' | 'layout' | 'group'
  /** The first argument: the page path, the layout id or the group prefix. */
  label: string
  /** For a page: the URL with every enclosing group prefix applied. */
  path?: string
  /** The module of its `lazy: () => import('./pages/x')`, as written. */
  module?: string
  /** 0-based line of the call. */
  line: number
  children: RouteEntry[]
}

interface StringLit {
  start: number
  end: number
  value: string
}

interface Scan {
  /** The source with comments and string contents blanked, same length and line breaks. */
  masked: string
  strings: StringLit[]
  /** Index of each `(` → index of its `)`. */
  closes: Map<number, number>
}

function scan(src: string): Scan {
  const out = src.split('')
  const strings: StringLit[] = []
  const closes = new Map<number, number>()
  const parens: number[] = []
  // Each entry is a template literal waiting for its `${...}` to close, with the brace depth.
  const templates: number[] = []
  let braces = 0
  const blank = (from: number, to: number) => {
    for (let k = from; k < to; k++) if (out[k] !== '\n') out[k] = ' '
  }
  let i = 0
  const readTemplate = (from: number): number => {
    // From just after a backtick (or a `}` closing an interpolation) to the closing backtick or
    // the next `${`.
    let j = from
    while (j < src.length) {
      if (src[j] === '\\') j += 2
      else if (src[j] === '`') {
        blank(from, j)
        return j + 1
      } else if (src[j] === '$' && src[j + 1] === '{') {
        blank(from, j)
        templates.push(braces)
        return j + 2
      } else j++
    }
    blank(from, j)
    return j
  }
  while (i < src.length) {
    const c = src[i]!
    const next = src[i + 1]
    if (c === '/' && next === '/') {
      const end = src.indexOf('\n', i)
      const stop = end < 0 ? src.length : end
      blank(i, stop)
      i = stop
    } else if (c === '/' && next === '*') {
      const end = src.indexOf('*/', i + 2)
      const stop = end < 0 ? src.length : end + 2
      blank(i, stop)
      i = stop
    } else if (c === "'" || c === '"') {
      let j = i + 1
      let value = ''
      while (j < src.length && src[j] !== c && src[j] !== '\n') {
        if (src[j] === '\\') {
          value += src[j + 1] ?? ''
          j += 2
        } else value += src[j++]
      }
      strings.push({ start: i, end: j + 1, value })
      blank(i + 1, j)
      i = j + 1
    } else if (c === '`') {
      i = readTemplate(i + 1)
    } else if (c === '{') {
      braces++
      i++
    } else if (c === '}') {
      if (templates.length && templates[templates.length - 1] === braces) {
        templates.pop()
        i = readTemplate(i + 1)
      } else {
        braces--
        i++
      }
    } else if (c === '(') {
      parens.push(i)
      i++
    } else if (c === ')') {
      const open = parens.pop()
      if (open !== undefined) closes.set(open, i)
      i++
    } else i++
  }
  return { masked: out.join(''), strings, closes }
}

/** The string literal starting right at `from` (after whitespace), if any. */
function stringAt(s: Scan, from: number): StringLit | undefined {
  let j = from
  while (j < s.masked.length && /\s/.test(s.masked[j]!)) j++
  return s.strings.find((lit) => lit.start === j)
}

export function joinPath(prefix: string, path: string): string {
  const joined = `${prefix.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`
  const clean = joined.replace(/\/+/g, '/')
  return clean.length > 1 ? clean.replace(/\/$/, '') : '/'
}

/** Parse the page tree of an `app/routes.ts` chain. */
export function parsePageRoutes(src: string): RouteEntry[] {
  const s = scan(src)
  interface Call {
    entry: RouteEntry
    open: number
    close: number
  }
  const calls: Call[] = []
  for (const m of s.masked.matchAll(/\.\s*(page|layout|group)\s*\(/g)) {
    const open = m.index + m[0].length - 1
    const close = s.closes.get(open)
    const first = stringAt(s, open + 1)
    if (close === undefined || !first) continue
    calls.push({
      open,
      close,
      entry: {
        kind: m[1] as RouteEntry['kind'],
        label: first.value,
        line: src.slice(0, m.index).split('\n').length - 1,
        children: [],
      },
    })
  }
  const innermost = (at: number, except?: Call) => {
    let best: Call | undefined
    for (const c of calls)
      if (c !== except && c.open < at && at < c.close && (!best || c.open > best.open)) best = c
    return best
  }
  const roots: RouteEntry[] = []
  const parents = new Map<Call, Call | undefined>()
  for (const call of calls) {
    const parent = innermost(call.open, call)
    parents.set(call, parent)
    ;(parent ? parent.entry.children : roots).push(call.entry)
  }
  for (const m of s.masked.matchAll(/\bimport\s*\(/g)) {
    const open = m.index + m[0].length - 1
    const lit = stringAt(s, open + 1)
    const owner = lit && innermost(m.index)
    if (owner && !owner.entry.module) owner.entry.module = lit.value
  }
  for (const call of calls) {
    if (call.entry.kind !== 'page') continue
    let prefix = ''
    for (let p = parents.get(call); p; p = parents.get(p))
      if (p.entry.kind === 'group') prefix = joinPath(p.entry.label, prefix)
    call.entry.path = joinPath(prefix || '/', call.entry.label)
  }
  return roots
}

/** Every page in the tree, depth first. */
export function flattenPages(entries: RouteEntry[]): RouteEntry[] {
  return entries.flatMap((e) =>
    e.kind === 'page' ? [e, ...flattenPages(e.children)] : flattenPages(e.children),
  )
}

/**
 * Candidate files for a route's module, relative to the project root: `./pages/sign-in` in
 * `app/routes.ts` → `app/pages/sign-in.tsx`, `.ts`, `/index.tsx`, `/index.ts`. A page without a
 * lazy import falls back to `app/pages/<path>` (`/` → `index`).
 */
export function moduleCandidates(entry: RouteEntry, routesDir: string): string[] {
  const exts = ['', '.tsx', '.ts', '.jsx', '.js', '/index.tsx', '/index.ts']
  let base: string | undefined
  if (entry.module?.startsWith('.')) base = normalize(`${routesDir}/${entry.module}`)
  else if (entry.module?.startsWith('#app/'))
    base = normalize(`${routesDir}/${entry.module.slice('#app/'.length)}`)
  else if (entry.kind === 'page' && entry.path) {
    const name = entry.path === '/' ? 'index' : entry.path.replace(/^\//, '')
    base = normalize(`${routesDir}/pages/${name}`)
  }
  if (!base) return []
  return exts.map((e) => `${base}${e}`).filter((p) => /\.[jt]sx?$/.test(p))
}

/** Resolve `.` and `..` segments of a `/`-separated relative path. */
export function normalize(path: string): string {
  const parts: string[] = []
  for (const part of path.split('/')) {
    if (part === '' || part === '.') continue
    if (part === '..') parts.pop()
    else parts.push(part)
  }
  return parts.join('/')
}

/**
 * Candidate controller files for an API route name: `projects.index` →
 * `server/controllers/projects-controller.ts`; `admin.users.index` →
 * `server/controllers/admin/users-controller.ts`; `health` → `.../health-controller.ts`.
 */
export function controllerCandidates(name: string, serverDir = 'server'): string[] {
  if (!/^[\w.-]+$/.test(name)) return []
  const kebab = (s: string) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
  const parts = name.split('.').map(kebab)
  // The last segment is usually the action (`index`, `signIn`), so drop it first.
  const order =
    parts.length > 1
      ? [
          parts.length - 1,
          parts.length,
          ...Array.from({ length: parts.length - 2 }, (_, i) => parts.length - 2 - i),
        ]
      : [1]
  return order.map((n) => {
    const segs = parts.slice(0, n)
    const file = segs.pop()!
    return `${serverDir}/controllers/${[...segs, `${file}-controller.ts`].join('/')}`
  })
}
