import type { Plugin } from 'vite'

/** The ESTree nodes this transform reads. `start` and `end` are offsets into the module's code. */
interface Node {
  type: string
  start: number
  end: number
  [key: string]: unknown
}

const isFactory = (name: string) => name === 'defineQuery' || name === 'defineMutation'

const isNode = (value: unknown): value is Node =>
  typeof value === 'object' && value !== null && typeof (value as Node).type === 'string'

/** Visit every node under `root`, parents first. */
function walk(root: unknown, visit: (node: Node) => void): void {
  if (Array.isArray(root)) {
    for (const child of root) walk(child, visit)
    return
  }
  if (!isNode(root)) return
  visit(root)
  for (const [key, value] of Object.entries(root)) {
    if (key !== 'type' && typeof value === 'object') walk(value, visit)
  }
}

/** The local names `@kitr/actions` factories are imported under. */
function factoryNames(program: Node): Set<string> {
  const names = new Set<string>()
  for (const statement of program.body as Node[]) {
    if (statement.type !== 'ImportDeclaration') continue
    if ((statement.source as { value: string }).value !== '@kitr/actions') continue
    for (const specifier of statement.specifiers as Node[]) {
      const imported = (specifier.imported as { name?: string } | undefined)?.name
      if (specifier.type === 'ImportSpecifier' && imported && isFactory(imported))
        names.add((specifier.local as { name: string }).name)
    }
  }
  return names
}

/** The `handler` property of a factory call's options object, when the call has one. */
function handlerOf(call: Node, factories: Set<string>): Node | undefined {
  const callee = call.callee as Node & { name?: string }
  if (callee.type !== 'Identifier' || !factories.has(callee.name as string)) return undefined
  const options = (call.arguments as Node[])[1]
  if (options?.type !== 'ObjectExpression') return undefined
  return (options.properties as Node[]).find((property) => {
    if (property.type !== 'Property' || property.computed) return false
    const key = property.key as Node & { name?: string; value?: unknown }
    return key.name === 'handler' || key.value === 'handler'
  })
}

/** Apply `edits` to `code`, each replacing the range `start` to `end` with `text`. */
function splice(code: string, edits: Array<{ start: number; end: number; text: string }>): string {
  let out = code
  for (const edit of [...edits].sort((a, b) => b.start - a.start))
    out = out.slice(0, edit.start) + edit.text + out.slice(edit.end)
  return out
}

/**
 * Empty the `handler` of every `defineQuery` and `defineMutation` call in `code`, then drop the
 * imports nothing refers to any more. The calls themselves stay: the browser still needs each
 * action's name, input schema and cache effects. Returns `undefined` when there is nothing to strip.
 *
 * `code` is JavaScript: run it after the TypeScript transform.
 */
export function stripHandlers(code: string, parse: (code: string) => unknown): string | undefined {
  if (!code.includes('@kitr/actions')) return undefined
  const program = parse(code) as Node
  const factories = factoryNames(program)
  if (!factories.size) return undefined

  const edits: Array<{ start: number; end: number; text: string }> = []
  walk(program, (node) => {
    if (node.type !== 'CallExpression') return
    const handler = handlerOf(node, factories)
    if (handler) edits.push({ start: handler.start, end: handler.end, text: 'handler: undefined' })
  })
  if (!edits.length) return undefined

  const stripped = splice(code, edits)
  const rest = parse(stripped) as Node
  const used = new Set<string>()
  walk(
    (rest.body as Node[]).filter((statement) => statement.type !== 'ImportDeclaration'),
    (node) => {
      if (node.type === 'Identifier' || node.type === 'JSXIdentifier') used.add(node.name as string)
    },
  )
  const unused: typeof edits = []
  for (const statement of rest.body as Node[]) {
    if (statement.type !== 'ImportDeclaration') continue
    const specifiers = statement.specifiers as Node[]
    const names = specifiers.map((s) => (s.local as { name: string }).name)
    if (names.length && names.every((name) => !used.has(name)))
      unused.push({ start: statement.start, end: statement.end, text: '' })
  }
  return splice(stripped, unused)
}

/**
 * Keeps server code out of the browser. An action's `handler` runs on the server, but it is written
 * in a file the browser bundle imports for the action's name and schema, so without this its code
 * and every import it uses (the database client, secrets, `node:` modules) would ship to visitors.
 */
export function kitrActions(): Plugin {
  return {
    name: 'kitr:actions-client',
    transform(code, id) {
      const environment = (this as { environment?: { name: string } }).environment
      if (environment?.name !== 'client' || id.includes('/node_modules/')) return undefined
      const result = stripHandlers(code, (source) => this.parse(source))
      return result === undefined ? undefined : { code: result, map: null }
    },
  }
}

export default kitrActions
