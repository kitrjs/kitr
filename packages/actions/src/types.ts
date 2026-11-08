import { defineTypes, type GenerateContext, type GenerateRcInfo } from '@kitr/core'

/**
 * The `actions` generator for `kitr types`. It reads every file under `app/actions`
 * (`directories.actions`), finds the exported `defineQuery` and `defineMutation` calls and writes
 * `.kitr/actions.ts`: the `operations` map `app/app.ts` passes to `createApp`, the same names as a
 * nested `actions` tree, and the `Operations` augmentation that types `useQuery('projects.list')`.
 */

export interface FoundOperation {
  /** Project-relative file. */
  file: string
  /** The exported identifier. */
  exportName: string
  /** The dotted name passed to `defineQuery` or `defineMutation`. */
  name: string
  kind: 'query' | 'mutation'
}

const NAME = /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/

type Ts = typeof import('typescript')
type Node = import('typescript').Node
type Symbol = import('typescript').Symbol

const KINDS = { defineQuery: 'query', defineMutation: 'mutation' } as const

/** Where `defineQuery` and `defineMutation` are declared: the @kitr/actions package, in a workspace or in node_modules. */
const ACTIONS_PACKAGE = /[\\/](?:@kitr[\\/]actions|packages[\\/]actions)[\\/]/
/** An import specifier that names the actions package or its `kitr/actions` re-export. */
const ACTIONS_SPECIFIER = /^(?:@kitr|kitr)\/actions(?:\/|$)/

export interface ScanOptions {
  /** The project root: where `tsconfig.json` is read from and module specifiers resolve. Default `/`. */
  root?: string
  /** In-memory files by project-relative path (modules the actions import), seen before the file system. For tests. */
  files?: Record<string, string>
}

/**
 * Every exported `defineQuery` / `defineMutation` call in the given sources, found with the
 * TypeScript compiler: the callee is resolved to its declaration, so an import alias
 * (`import { defineQuery as query }`), a namespace import (`k.defineQuery`) and a re-export
 * (`export { listProjects } from '../shared/projects'`) all count, and a local function that merely
 * shares the name does not. A name that is not a string literal is an error with `file:line`.
 */
export async function scanActions(
  sources: Array<{ file: string; source: string }>,
  options: ScanOptions = {},
): Promise<FoundOperation[]> {
  const ts: Ts = await import('typescript').then((m) => (m as { default?: Ts }).default ?? m)
  const root = (options.root ?? '').replace(/\\/g, '/').replace(/\/$/, '')
  const abs = (file: string) => `${root}/${file}`
  const virtual = new Map(sources.map(({ file, source }) => [abs(file), source]))
  const memory = new Map([
    ...Object.entries(options.files ?? {}).map(([file, text]) => [abs(file), text] as const),
    ...virtual,
  ])
  const extra = (path: string) => memory.get(path)

  const compilerOptions = readCompilerOptions(ts, root || '/')
  const host = ts.createCompilerHost(compilerOptions, true)
  const real = {
    fileExists: host.fileExists.bind(host),
    readFile: host.readFile.bind(host),
    getSourceFile: host.getSourceFile.bind(host),
    directoryExists: host.directoryExists?.bind(host),
  }
  host.directoryExists = (dir) =>
    [...memory.keys()].some((path) => path.startsWith(`${dir}/`)) ||
    (real.directoryExists?.(dir) ?? false)
  host.fileExists = (path) => extra(path) !== undefined || real.fileExists(path)
  host.readFile = (path) => extra(path) ?? real.readFile(path)
  host.getSourceFile = (path, languageVersion, ...rest) => {
    const text = extra(path)
    return text === undefined
      ? real.getSourceFile(path, languageVersion, ...rest)
      : ts.createSourceFile(path, text, languageVersion, true)
  }

  const program = ts.createProgram({
    rootNames: [...virtual.keys()],
    options: compilerOptions,
    host,
  })
  const checker = program.getTypeChecker()
  const rel = (path: string) => (path.startsWith(`${root}/`) ? path.slice(root.length + 1) : path)
  const where = (node: Node) => {
    const sf = node.getSourceFile()
    return `${rel(sf.fileName)}:${sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1}`
  }

  const unalias = (symbol: Symbol) => {
    let current = symbol
    for (let i = 0; i < 20 && current.flags & ts.SymbolFlags.Alias; i++) {
      const next = checker.getAliasedSymbol(current)
      if (next === current || next.escapedName === 'unknown')
        return { symbol: current, resolved: false }
      current = next
    }
    return { symbol: current, resolved: true }
  }

  /** `k.defineQuery(...)` where `k` is `import * as k from 'kitr/actions'` that did not resolve (not installed yet). */
  const namespaceKind = (call: import('typescript').CallExpression) => {
    const { expression } = call
    if (!ts.isPropertyAccessExpression(expression) || !ts.isIdentifier(expression.expression))
      return undefined
    const namespace = checker.getSymbolAtLocation(expression.expression)
    const spec = namespace?.declarations?.find(ts.isNamespaceImport)
    const from = spec?.parent.parent.moduleSpecifier
    return from && ts.isStringLiteral(from) && ACTIONS_SPECIFIER.test(from.text)
      ? KINDS[expression.name.text as keyof typeof KINDS]
      : undefined
  }

  /** `defineQuery` or `defineMutation` from @kitr/actions, whatever it was imported as; undefined for any other call. */
  const defineKind = (call: import('typescript').CallExpression) => {
    const callee = ts.isPropertyAccessExpression(call.expression)
      ? call.expression.name
      : call.expression
    const symbol = checker.getSymbolAtLocation(callee)
    if (!symbol) return namespaceKind(call)
    const { symbol: target, resolved } = unalias(symbol)
    if (resolved) {
      const declaration = target.declarations?.[0]
      const kind = KINDS[target.name as keyof typeof KINDS]
      return kind && declaration && ACTIONS_PACKAGE.test(declaration.getSourceFile().fileName)
        ? kind
        : undefined
    }
    // The actions package is not installed (yet): trust the import that names it.
    const spec = target.declarations?.find(ts.isImportSpecifier)
    const from = spec?.parent.parent.parent.moduleSpecifier
    const original = spec && (spec.propertyName ?? spec.name).text
    return spec && from && ts.isStringLiteral(from) && ACTIONS_SPECIFIER.test(from.text)
      ? KINDS[original as keyof typeof KINDS]
      : undefined
  }

  const unwrap = (expression: import('typescript').Expression): import('typescript').Expression =>
    ts.isParenthesizedExpression(expression) ||
    ts.isAsExpression(expression) ||
    ts.isSatisfiesExpression(expression) ||
    ts.isNonNullExpression(expression)
      ? unwrap(expression.expression)
      : expression

  const out: FoundOperation[] = []
  for (const file of sources.map((s) => s.file)) {
    const sourceFile = program.getSourceFile(abs(file))
    const moduleSymbol = sourceFile && checker.getSymbolAtLocation(sourceFile)
    if (!moduleSymbol) continue
    for (const exported of checker.getExportsOfModule(moduleSymbol)) {
      const { symbol: target, resolved } = unalias(exported)
      const declaration = resolved ? target.valueDeclaration : undefined
      if (!declaration || !ts.isVariableDeclaration(declaration) || !declaration.initializer)
        continue
      // A re-export of an operation defined in another scanned file is counted where it is defined.
      const declaredIn = declaration.getSourceFile().fileName
      if (declaredIn !== abs(file) && virtual.has(declaredIn)) continue
      const call = unwrap(declaration.initializer)
      if (!ts.isCallExpression(call)) continue
      const kind = defineKind(call)
      if (!kind) continue
      const first = call.arguments[0]
      if (!first || !(ts.isStringLiteral(first) || ts.isNoSubstitutionTemplateLiteral(first)))
        throw new Error(
          `[kitr/actions] ${where(first ?? call)}: the name passed to ${kind === 'query' ? 'defineQuery' : 'defineMutation'}() for \`${exported.name}\` must be a string literal, like 'projects.list': \`kitr types\` reads names without running your code.`,
        )
      out.push({ file, exportName: exported.name, name: first.text, kind })
    }
  }
  return out
}

/** The project's compiler options (path aliases, JSX, module resolution), trimmed for a read-only walk. */
function readCompilerOptions(ts: Ts, root: string): import('typescript').CompilerOptions {
  const configPath = ts.findConfigFile(root, ts.sys.fileExists)
  const config = configPath ? ts.readConfigFile(configPath, ts.sys.readFile) : undefined
  const parsed =
    configPath && config && !config.error
      ? ts.parseJsonConfigFileContent(
          config.config,
          ts.sys,
          configPath.replace(/[\\/][^\\/]*$/, ''),
        )
      : undefined
  return {
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    jsx: ts.JsxEmit.Preserve,
    ...parsed?.options,
    noEmit: true,
    skipLibCheck: true,
    // Only the files the actions import are read: no ambient @types, no tsconfig include globs.
    types: [],
    composite: false,
    incremental: false,
    declaration: false,
  }
}

/** The generated module for a set of operations. Exported for tests and for `kitr doctor`. */
export function renderActions(found: FoundOperation[], ctx: Pick<GenerateContext, 'importPath'>) {
  const byName = new Map<string, FoundOperation>()
  for (const op of found) {
    if (!NAME.test(op.name))
      throw new Error(
        `[kitr/actions] "${op.name}" in ${op.file} is not a valid name: use dotted identifiers like projects.update`,
      )
    const other = byName.get(op.name)
    if (other)
      throw new Error(
        `[kitr/actions] "${op.name}" is defined twice: ${other.file} (${other.exportName}) and ${op.file} (${op.exportName})`,
      )
    byName.set(op.name, op)
  }
  const names = [...byName.keys()].sort()
  for (const name of names)
    for (const candidate of names)
      if (candidate.startsWith(`${name}.`))
        throw new Error(
          `[kitr/actions] "${name}" cannot be both an operation and a group: "${candidate}" is nested under it`,
        )
  const files = [...new Set(found.map((op) => op.file))].sort()
  const alias = new Map(files.map((file, i) => [file, `m${i}`]))
  const ref = (name: string) => {
    const op = byName.get(name)!
    return `${alias.get(op.file)}.${op.exportName}`
  }
  const imports = files
    .map((file) => `import * as ${alias.get(file)} from '${ctx.importPath(file)}'`)
    .join('\n')
  const flat = names.map((name) => `  '${name}': ${ref(name)},`).join('\n')
  const augmentation = names.map((name) => `    '${name}': typeof ${ref(name)}`).join('\n')
  return `// Generated by \`kitr types\` from your actions. Do not edit.
${imports ? `${imports}\n` : ''}
/** Every server query and mutation by name. Pass it to \`createApp({ operations })\`. */
export const operations = {${flat ? `\n${flat}\n` : ''}} as const

/** The same operations as a tree: \`actions.projects.update(input)\`. */
export const actions = ${renderTree(names, ref, 0)}

declare module '@kitr/core' {
  interface Operations {${augmentation ? `\n${augmentation}\n  ` : ''}}
}
`
}

function renderTree(names: string[], ref: (name: string) => string, depth: number): string {
  const pad = '  '.repeat(depth + 1)
  const key = (k: string) => (/^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k))
  const groups = new Map<string, string[]>()
  const lines: string[] = []
  for (const name of names) {
    const dot = name.indexOf('.')
    if (dot < 0) lines.push(`${pad}${key(name)}: ${ref(name)},`)
    else
      groups.set(name.slice(0, dot), [
        ...(groups.get(name.slice(0, dot)) ?? []),
        name.slice(dot + 1),
      ])
  }
  for (const [head, rest] of groups)
    lines.push(`${pad}${key(head)}: ${renderTree(rest, (n) => ref(`${head}.${n}`), depth + 1)},`)
  return lines.length ? `{\n${lines.join('\n')}\n${'  '.repeat(depth)}}` : '{}'
}

const actionsDir = (rc: GenerateRcInfo) =>
  rc.directories.actions ?? `${rc.directories.app ?? 'app'}/actions`

export default defineTypes({
  name: 'actions',
  watch: (rc) => [`${actionsDir(rc)}/**/*.{ts,tsx}`],
  async generate(ctx) {
    const dir = actionsDir(ctx.rc)
    const sources = ctx
      .glob(dir, '**/*.{ts,tsx}')
      .filter((file) => !/\.(test|spec)\.tsx?$/.test(file) && !/\.d\.ts$/.test(file))
      .map((file) => ({ file, source: ctx.read(file) }))
    const found = sources.length ? await scanActions(sources, { root: ctx.root }) : []
    return [{ file: 'actions.ts', content: renderActions(found, ctx) }]
  },
})
