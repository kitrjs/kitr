// Fails on module-scope mutable state in package sources. Run from the repo root:
//
//   node scripts/check-module-state.mjs
//
// kitr's lifecycle (one app per client, per server process and per test, `app.fork()` per request)
// only holds when packages keep their state on the app, in the container or in a closure, never in
// a module that every app, request and test in the process shares. This script reads every
// `packages/*/src/**/*.{ts,tsx}` (tests excluded) with the TypeScript parser and reports, among
// the statements at the top level of a file:
//
//   - `let` and `var` declarations
//   - `new Map()`, `new Set()`, `new WeakMap()`, `new WeakSet()`
//   - array and object literals (`const x = []`, `const x = { ... }`)
//
// An array or object literal that is frozen at its declaration (`as const`, `Object.freeze(...)`)
// is data, not state, and passes. Anything else passes only with a comment on the statement's
// first line, or on the line above it:
//
//   // kitr-allow-module-state: <why this is process-wide by design>
//
// Use it for state that is process-wide on purpose, such as a cache of pure computations, a lookup
// table that is filled once at import, or the registry a decorator-free API needs to find
// definitions by name. If a second app or a second test could observe it and be surprised, it
// belongs on the app instead.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = fileURLToPath(new URL('..', import.meta.url))
const packagesDir = join(root, 'packages')
const MARKER = 'kitr-allow-module-state:'
const MUTABLE_CLASSES = new Set(['Map', 'Set', 'WeakMap', 'WeakSet'])

const isTest = (file) => /\.(test|spec|test-d)\.tsx?$/.test(file) || /\.d\.ts$/.test(file)

function* sources(dir) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist') continue
    const path = join(dir, name)
    if (statSync(path).isDirectory()) yield* sources(path)
    else if (/\.tsx?$/.test(name) && !isTest(name)) yield path
  }
}

/** What makes this initializer mutable module state, or undefined. */
function mutableKind(expression) {
  let node = expression
  // `x as Foo`, `x satisfies Foo`, `(x)`, `x!` change nothing at runtime; `as const` freezes the type only, but is how data is written.
  while (true) {
    if (ts.isAsExpression(node)) {
      if (ts.isTypeReferenceNode(node.type) && node.type.typeName.getText() === 'const')
        return undefined
      node = node.expression
    } else if (
      ts.isSatisfiesExpression(node) ||
      ts.isParenthesizedExpression(node) ||
      ts.isNonNullExpression(node)
    )
      node = node.expression
    else break
  }
  if (ts.isNewExpression(node) && ts.isIdentifier(node.expression)) {
    const name = node.expression.text
    if (MUTABLE_CLASSES.has(name)) return `new ${name}()`
  }
  if (ts.isArrayLiteralExpression(node)) return 'array literal'
  if (ts.isObjectLiteralExpression(node)) return 'object literal'
  return undefined
}

export function findModuleState(file, text) {
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
  const lines = text.split('\n')
  const allowed = (node) => {
    const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line
    return lines[line].includes(MARKER) || (line > 0 && lines[line - 1].includes(MARKER))
  }
  const hits = []
  const report = (node, message) => {
    if (allowed(node)) return
    const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf))
    hits.push({ line: line + 1, message })
  }
  for (const statement of sf.statements) {
    if (!ts.isVariableStatement(statement)) continue
    if (statement.modifiers?.some((m) => m.kind === ts.SyntaxKind.DeclareKeyword)) continue
    const { flags } = statement.declarationList
    const isConst = (flags & ts.NodeFlags.Const) !== 0
    for (const declaration of statement.declarationList.declarations) {
      const names = declaration.name.getText(sf)
      if (!isConst) report(statement, `\`${isLet(flags) ? 'let' : 'var'} ${names}\``)
      else if (declaration.initializer) {
        const kind = mutableKind(declaration.initializer)
        if (kind) report(statement, `\`const ${names}\` is a ${kind}`)
      }
    }
  }
  return hits
}

const isLet = (flags) => (flags & ts.NodeFlags.Let) !== 0

function main() {
  const failures = []
  let files = 0
  for (const pkg of readdirSync(packagesDir).sort()) {
    const src = join(packagesDir, pkg, 'src')
    try {
      if (!statSync(src).isDirectory()) continue
    } catch {
      continue
    }
    for (const file of sources(src)) {
      files++
      for (const hit of findModuleState(file, readFileSync(file, 'utf8')))
        failures.push(`${relative(root, file)}:${hit.line}  ${hit.message}`)
    }
  }
  if (failures.length) {
    console.error(`Module-scope state in package sources (${failures.length}):\n`)
    for (const failure of failures) console.error(`  ${failure}`)
    console.error(
      `\nKeep the state on the app (app.container, app.config, app.drivers) or in a closure. If it is process-wide by design, add \`// ${MARKER} <reason>\` to the line or the line above it.`,
    )
    process.exit(1)
  }
  console.log(`check-module-state: ${files} files, no module-scope state.`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main()
