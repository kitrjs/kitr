import type { MaybePromise } from './types'

/**
 * The type-generation contract. `kitr types` runs every generator the project's packages declare
 * and writes their files under `.kitr/`, which the project includes in `tsconfig.json` and reaches
 * as `#kitr/*`. The CLI runs it on `kitr types`, before `kitr dev` and `kitr build`, and the Vite
 * plugin re-runs a generator whenever a file matching its `watch` globs changes.
 *
 * A package declares one as its `./types` export:
 *
 *   export default defineTypes({
 *     name: 'actions',
 *     watch: ['app/actions/** /*.ts'],
 *     generate: (ctx) => [{ file: 'actions.ts', content: '...' }],
 *   })
 *
 * This module is types and an identity function only, so a generator module costs nothing to
 * load and can be typechecked anywhere. The runner that walks files lives in `@kitr/cli`.
 */

/** Static facts about `kitrrc.ts`, read without executing it. */
export interface GenerateRcInfo {
  packages: string[]
  providers: string[]
  directories: Record<string, string>
  platforms: Record<string, { factory: string; source?: string; options?: Record<string, unknown> }>
}

export interface GenerateContext {
  /** The project root. */
  root: string
  rc: GenerateRcInfo
  /** Files under `dir` (relative to the root) matching the glob, as paths relative to the root, sorted. */
  glob(dir: string, pattern: string): string[]
  exists(path: string): boolean
  read(path: string): string
  /** The import specifier that reaches a project file from a file in `.kitr/`: `../app/actions/projects`. */
  importPath(file: string): string
}

export interface GeneratedFile {
  /** Relative to `.kitr/`. */
  file: string
  content: string
}

export interface TypesGenerator {
  /** Short name, shown by `kitr types` and used in error messages. */
  name: string
  /** Globs relative to the project root, or a function of the rc for directory-dependent ones. A change to a matching file re-runs this generator in dev. */
  watch?: string[] | ((rc: GenerateRcInfo) => string[])
  /** Produce the files. Pure: it returns content and never writes. */
  generate(ctx: GenerateContext): MaybePromise<GeneratedFile[]>
}

export function defineTypes(generator: TypesGenerator): TypesGenerator {
  return generator
}

export function isTypesGenerator(value: unknown): value is TypesGenerator {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as TypesGenerator).name === 'string' &&
    typeof (value as TypesGenerator).generate === 'function'
  )
}

/** Resolve a `./types` module: `export default` or a named `types`. */
export function pickTypesGenerator(mod: unknown): TypesGenerator | undefined {
  if (isTypesGenerator(mod)) return mod
  if (!mod || typeof mod !== 'object') return undefined
  const m = mod as Record<string, unknown>
  if (isTypesGenerator(m.default)) return m.default
  if (isTypesGenerator(m.types)) return m.types
  return undefined
}

/** A glob with `**`, `*`, `?` and `{a,b}`, as a RegExp over a `/`-separated relative path. */
export function globToRegExp(pattern: string): RegExp {
  let out = '^'
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i]!
    if (c === '*') {
      if (pattern[i + 1] === '*') {
        i++
        if (pattern[i + 1] === '/') {
          i++
          out += '(?:.*/)?'
        } else out += '.*'
      } else out += '[^/]*'
    } else if (c === '?') out += '[^/]'
    else if (c === '{') {
      const end = pattern.indexOf('}', i)
      const alternatives = pattern
        .slice(i + 1, end)
        .split(',')
        .map((a) => a.replace(/[.+^$()|[\]\\]/g, '\\$&'))
      out += `(?:${alternatives.join('|')})`
      i = end
    } else out += c.replace(/[.+^$()|[\]\\]/g, '\\$&')
  }
  return new RegExp(`${out}$`)
}
