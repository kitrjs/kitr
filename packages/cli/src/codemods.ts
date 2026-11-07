import { execSync } from 'node:child_process'
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { builders, generateCode, parseModule } from 'magicast'
import type { ProjectContext } from './context'
import { versionOf } from './versions'

/**
 * The codemod API every package recipe uses. Only files whose shape kitr owns
 * are edited: kitrrc.ts, config/*, vite.config.ts, package.json, .env.example, AGENTS.md.
 */
export class Codemods {
  private deps = new Map<string, { version: string; dev: boolean }>()
  private removals = new Set<string>()
  constructor(readonly ctx: ProjectContext) {}

  /** Queue dependencies; written to package.json by `flush()`, installed unless `--no-install`. */
  installPackages(packages: Array<string | { name: string; version?: string; dev?: boolean }>) {
    for (const p of packages) {
      const spec = typeof p === 'string' ? { name: p } : p
      const isKitr = spec.name === 'kitr' || spec.name.startsWith('@kitr/')
      this.deps.set(spec.name, {
        version: spec.version ?? (isKitr ? `^${this.ctx.kitrVersion}` : versionOf(spec.name)),
        dev: spec.dev ?? false,
      })
    }
  }
  removePackages(names: string[]) {
    for (const n of names) this.removals.add(n)
  }

  /** Add a provider lazy import to kitrrc.ts (`() => import('x')`). Idempotent. */
  addProvider(spec: string) {
    this.editRc((mod, src) => {
      if (hasImportOf(src, spec)) return
      ensureArray(mod, 'providers').push(builders.raw(`() => import('${spec}')`))
    })
  }
  removeProvider(spec: string) {
    // Lazy imports are opaque to magicast's proxies, so match them by their generated source.
    this.editRc((mod) => {
      const providers = ensureArray(mod, 'providers')
      for (let i = providers.length - 1; i >= 0; i--) {
        if (hasImportOf(generateCode(providers[i]).code, spec)) providers.splice(i, 1)
      }
    })
  }
  addPackage(name: string) {
    this.editRc((mod) => {
      const packages = ensureArray(mod, 'packages')
      if (!packages.includes(name)) packages.push(name)
    })
  }
  removePackage(name: string) {
    this.editRc((mod) => {
      const packages = ensureArray(mod, 'packages')
      for (let i = packages.length - 1; i >= 0; i--) {
        const v = packages[i]
        const text = typeof v === 'string' ? v : generateCode(v).code.replace(/^['"]|['"]$/g, '')
        if (text === name) packages.splice(i, 1)
      }
    })
  }
  addCommand(spec: string) {
    this.editRc((mod, src) => {
      if (hasImportOf(src, spec)) return
      ensureArray(mod, 'commands').push(builders.raw(`() => import('${spec}')`))
    })
  }

  private editRc(edit: (mod: any, src: string) => void) {
    const rcPath = this.ctx.rcPath ?? this.ctx.path('kitrrc.ts')
    if (!existsSync(rcPath)) {
      this.ctx.write(
        'kitrrc.ts',
        `import { defineKitrConfig } from 'kitr/app'\n\nexport default defineKitrConfig({\n  packages: [],\n  providers: [],\n})\n`,
      )
      this.ctx.rcPath = rcPath
    }
    if (this.ctx.dryRun) return
    const src = readFileSync(rcPath, 'utf8')
    const mod = parseModule(src)
    const target =
      mod.exports.default?.$type === 'function-call'
        ? mod.exports.default.$args[0]
        : mod.exports.default
    if (!target || typeof target !== 'object')
      throw new Error(`${rcPath}: expected \`export default defineKitrConfig({...})\``)
    edit(target, src)
    writeFileSync(rcPath, generateCode(mod, { quote: 'single' }).code)
    this.ctx.touched.add('kitrrc.ts')
  }

  /** Add `import x from 'spec'` and `x()` to `plugins: [...]` in vite.config.ts. */
  addVitePlugin(importName: string, spec: string, call = `${importName}()`) {
    const file = ['vite.config.ts', 'vite.config.mts', 'vite.config.js']
      .map((f) => this.ctx.path(f))
      .find(existsSync)
    if (!file)
      return this.ctx.log.warn(
        `No vite.config.ts found; add \`${call}\` from '${spec}' to plugins yourself.`,
      )
    if (this.ctx.dryRun) return
    const src = readFileSync(file, 'utf8')
    if (src.includes(spec)) return
    const mod = parseModule(src)
    mod.imports.$prepend({ from: spec, imported: 'default', local: importName })
    const cfg =
      mod.exports.default?.$type === 'function-call'
        ? mod.exports.default.$args[0]
        : mod.exports.default
    const plugins = ensureArray(cfg, 'plugins')
    plugins.push(builders.raw(call))
    writeFileSync(file, generateCode(mod).code)
    this.ctx.touched.add('vite.config.ts')
  }

  /**
   * Add a variable to the typed env in app/env.ts: `addEnvSchema('public', 'VITE_API_URL', "e.url({ default: 'http://localhost:3333' })")`.
   * Also appends it to `.env.example`. Idempotent.
   */
  addEnvSchema(scope: 'public' | 'server', name: string, schema: string, example?: string) {
    const rel = `${this.ctx.readRc().directories.app ?? 'app'}/env.ts`
    const file = this.ctx.path(rel)
    if (example !== undefined) this.addEnv({ [name]: example })
    if (!existsSync(file))
      return this.ctx.log.warn(`No ${rel}; declare ${name} in createEnv() yourself.`)
    if (this.ctx.dryRun) return
    const src = readFileSync(file, 'utf8')
    if (new RegExp(`\\b${escapeRegExp(name)}\\s*:`).test(src)) return
    const mod = parseModule(src)
    const call = mod.exports.env
    if (call?.$type !== 'function-call')
      return this.ctx.log.warn(
        `${rel}: expected \`export const env = createEnv({...})\`; declare ${name} yourself.`,
      )
    const options = call.$args[0]
    if (!options[scope]) options[scope] = {}
    options[scope][name] = builders.raw(schema)
    writeFileSync(file, generateCode(mod, { quote: 'single' }).code)
    this.ctx.touched.add(rel)
  }

  /** Replace one side-effect CSS import with another in a file (e.g. the root route). Adds it if neither is present. */
  replaceCssImport(file: string, from: string | undefined, to: string) {
    const full = this.ctx.path(file)
    if (!existsSync(full) || this.ctx.dryRun) return
    const src = readFileSync(full, 'utf8')
    if (src.includes(`'${to}'`)) return
    const next =
      from && src.includes(`import '${from}'`)
        ? src.replace(`import '${from}'`, `import '${to}'`)
        : src.replace(/^(import[^\n]*\n)(?!import)/m, `$1import '${to}'\n`)
    writeFileSync(full, next)
    this.ctx.touched.add(file)
  }

  /** Delete a file kitr generated earlier (e.g. index.html when switching to Start). */
  remove(file: string) {
    const full = this.ctx.path(file)
    if (!existsSync(full)) return
    if (!this.ctx.dryRun) rmSync(full)
    this.ctx.log.step(`remove ${file}`)
  }

  /** Add a default import to a file kitr owns (vite.config.ts, capacitor.config.ts). Idempotent. */
  addImport(file: string, local: string, spec: string) {
    const full = this.ctx.path(file)
    if (!existsSync(full) || this.ctx.dryRun) return
    const src = readFileSync(full, 'utf8')
    if (src.includes(`from '${spec}'`) || src.includes(`from "${spec}"`)) return
    const mod = parseModule(src)
    mod.imports.$prepend({ from: spec, imported: 'default', local })
    writeFileSync(full, generateCode(mod).code)
    this.ctx.touched.add(file)
  }

  /** Remove a top-level package.json field if it still holds `value`. */
  removePackageField(name: string, value: unknown) {
    const pkgPath = this.ctx.path('package.json')
    if (!existsSync(pkgPath)) return
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
    if (JSON.stringify(pkg[name]) !== JSON.stringify(value)) return
    delete pkg[name]
    if (!this.ctx.dryRun) writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`)
    this.ctx.pkg = pkg
    this.ctx.touched.add('package.json')
  }

  /** Set a top-level package.json field (`main`, `build`...). Overwrites. */
  setPackageField(name: string, value: unknown) {
    const pkgPath = this.ctx.path('package.json')
    const pkg = existsSync(pkgPath) ? JSON.parse(readFileSync(pkgPath, 'utf8')) : {}
    if (JSON.stringify(pkg[name]) === JSON.stringify(value)) return
    pkg[name] = value
    if (!this.ctx.dryRun) writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`)
    this.ctx.pkg = pkg
    this.ctx.touched.add('package.json')
  }

  /** Set a package.json script unless it exists. */
  addScript(name: string, command: string) {
    const pkgPath = this.ctx.path('package.json')
    const pkg = existsSync(pkgPath) ? JSON.parse(readFileSync(pkgPath, 'utf8')) : {}
    pkg.scripts ??= {}
    if (pkg.scripts[name] === command) return
    pkg.scripts[name] = command
    if (!this.ctx.dryRun) writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`)
    this.ctx.pkg = pkg
    this.ctx.touched.add('package.json')
  }

  /** Remove package.json scripts, but only ones still set to what the recipe wrote (`undefined` matches any). */
  removeScripts(scripts: Record<string, string | undefined>) {
    const pkgPath = this.ctx.path('package.json')
    if (!existsSync(pkgPath)) return
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
    let changed = false
    for (const [name, command] of Object.entries(scripts)) {
      const current = pkg.scripts?.[name]
      if (current === undefined) continue
      if (command !== undefined && current !== command) continue
      delete pkg.scripts[name]
      changed = true
    }
    if (!changed) return
    if (!this.ctx.dryRun) writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`)
    this.ctx.pkg = pkg
    this.ctx.touched.add('package.json')
  }

  /** Append variables to `.env.example` (and `.env` if present) when missing. */
  addEnv(vars: Record<string, string>, comment?: string) {
    for (const name of ['.env.example', '.env']) {
      const file = this.ctx.path(name)
      if (name === '.env' && !existsSync(file)) continue
      const current = existsSync(file) ? readFileSync(file, 'utf8') : ''
      const missing = Object.entries(vars).filter(([k]) => !new RegExp(`^${k}=`, 'm').test(current))
      if (!missing.length) continue
      const block = `${current.endsWith('\n') || current === '' ? current : `${current}\n`}${comment ? `# ${comment}\n` : ''}${missing.map(([k, v]) => `${k}=${v}`).join('\n')}\n`
      if (!this.ctx.dryRun) writeFileSync(file, block)
      this.ctx.touched.add(name)
    }
  }

  /** Add a section to AGENTS.md under a `## kitr: <name>` heading. Idempotent. */
  addAgentsSection(name: string, body: string) {
    const file = this.ctx.path('AGENTS.md')
    const heading = `## kitr: ${name}`
    const current = existsSync(file)
      ? readFileSync(file, 'utf8')
      : '# Agent guide\n\nThis app is built with kitr. Each section below is maintained by `kitr add`.\n'
    if (current.includes(heading)) return
    if (!this.ctx.dryRun)
      writeFileSync(file, `${current.trimEnd()}\n\n${heading}\n\n${body.trim()}\n`)
    this.ctx.touched.add('AGENTS.md')
  }
  removeAgentsSection(name: string) {
    const file = this.ctx.path('AGENTS.md')
    if (!existsSync(file) || this.ctx.dryRun) return
    const current = readFileSync(file, 'utf8')
    const next = current.replace(
      new RegExp(`\\n## kitr: ${escapeRegExp(name)}\\n[\\s\\S]*?(?=\\n## |$)`),
      '',
    )
    if (next !== current) writeFileSync(file, next)
  }

  /** Format the files this run touched with the project's Biome, when it has one. Best effort. */
  format() {
    if (this.ctx.dryRun) return
    const files = [...this.ctx.touched].filter(
      (f) =>
        /\.(ts|tsx|js|mjs|json)$/.test(f) && f !== 'package.json' && existsSync(this.ctx.path(f)),
    )
    if (!files.length) return
    const bin = this.ctx.path('node_modules', '.bin', 'biome')
    if (!existsSync(bin)) return
    try {
      execSync(`"${bin}" format --write ${files.map((f) => `"${f}"`).join(' ')}`, {
        cwd: this.ctx.root,
        stdio: 'pipe',
      })
    } catch {}
  }

  /**
   * The standalone server (tsx, no Vite) imports `config/index.ts` instead of `virtual:kitr/config`.
   * Regenerate it from every file in config/. Idempotent.
   */
  syncConfigIndex() {
    const dir = this.ctx.readRc().directories.config ?? 'config'
    if (!this.ctx.exists(dir)) return
    const { readdirSync } = require('node:fs') as typeof import('node:fs')
    const names = readdirSync(this.ctx.path(dir))
      .filter((f) => /^[a-z0-9-]+\.ts$/.test(f) && f !== 'index.ts')
      .map((f) => f.replace(/\.ts$/, ''))
      .sort()
    const ident = (n: string) => n.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
    const body = `// Generated by kitr: one entry per file in ${dir}/. \`kitr add\` rewrites it; edit freely between runs.\n${names.map((n) => `import ${ident(n)} from './${n}'`).join('\n')}\n\nexport const config = {\n${names.map((n) => `  ${ident(n) === n ? n : `'${n}': ${ident(n)}`},`).join('\n')}\n}\n`
    this.ctx.write(`${dir}/index.ts`, body, { overwrite: true })
  }

  /** Is this dependency queued for install in this run? */
  queued(name: string): boolean {
    return this.deps.has(name)
  }

  /** Edit tsconfig.json's compilerOptions with a function; the file is created when missing. */
  editTsconfig(edit: (tsconfig: Record<string, any>) => void) {
    const file = this.ctx.path('tsconfig.json')
    const current = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {}
    const before = JSON.stringify(current)
    edit(current)
    if (JSON.stringify(current) === before) return
    if (!this.ctx.dryRun) writeFileSync(file, `${JSON.stringify(current, null, 2)}\n`)
    this.ctx.touched.add('tsconfig.json')
  }

  /** Add entries to a string array under compilerOptions (`types`, `lib`) or the root (`include`). */
  addTsconfigList(where: 'compilerOptions' | 'root', key: string, entries: string[]) {
    this.editTsconfig((ts) => {
      if (where !== 'root') ts.compilerOptions ??= {}
      const target = where === 'root' ? ts : ts.compilerOptions
      target[key] ??= []
      const list: string[] = target[key]
      for (const e of entries) if (!list.includes(e)) list.push(e)
    })
  }

  removeTsconfigList(where: 'compilerOptions' | 'root', key: string, entries: string[]) {
    this.editTsconfig((ts) => {
      const target = where === 'root' ? ts : ts.compilerOptions
      if (!Array.isArray(target?.[key])) return
      target[key] = target[key].filter((e: string) => !entries.includes(e))
    })
  }

  /**
   * Edit an existing source file with magicast. The callback may mutate the module or return
   * replacement text. Missing files are skipped with a step line.
   */
  editFile(
    file: string,
    edit: (mod: any, src: string) => void | string,
    options: { quote?: 'single' | 'double' } = {},
  ) {
    const full = this.ctx.path(file)
    if (!existsSync(full)) return this.ctx.log.step(`skip ${file} (missing)`)
    const src = readFileSync(full, 'utf8')
    const mod = parseModule(src)
    const result = edit(mod, src)
    const next =
      typeof result === 'string'
        ? result
        : generateCode(mod, { quote: options.quote ?? 'single' }).code
    if (next === src) return
    if (!this.ctx.dryRun) writeFileSync(full, next)
    this.ctx.touched.add(file)
  }

  /** The route table file: `directories.routeTable`, default `app/routes.ts`. */
  routeTablePath(): string {
    const dirs = this.ctx.readRc().directories
    return dirs.routeTable ?? `${dirs.app ?? 'app'}/routes.ts`
  }

  /**
   * Add a route-table extension: `import ext from '<spec>'` and `ext` in the first argument of
   * `defineRoutes([...], ...)`. Creates the file with an empty table when missing. Idempotent.
   */
  extendRoutes(spec: string) {
    const file = this.routeTablePath()
    const full = this.ctx.path(file)
    if (!existsSync(full)) {
      this.ctx.write(
        file,
        `import { defineRoutes } from 'kitr/app'\n\n/** The route table. Packages add their methods here (\`kitr add\` maintains the list). */\nexport const routes = defineRoutes([], (r) => r)\n\nexport type AppRoutes = typeof routes.$types\n`,
      )
    }
    if (this.ctx.dryRun) return
    const src = readFileSync(full, 'utf8')
    if (src.includes(`'${spec}'`) || src.includes(`"${spec}"`)) return
    const local = extensionLocalName(spec)
    const mod = parseModule(src)
    const call = findDefineRoutes(mod)
    if (!call) throw new Error(`${file}: expected a \`defineRoutes([...], ...)\` call`)
    mod.imports.$prepend({ from: spec, imported: 'default', local })
    if (!call.$args.length || !Array.isArray(call.$args[0])) call.$args.unshift([])
    call.$args[0].push(builders.raw(local))
    writeFileSync(full, generateCode(mod, { quote: 'single' }).code)
    this.ctx.touched.add(file)
  }

  removeRoutesExtension(spec: string) {
    const file = this.routeTablePath()
    const full = this.ctx.path(file)
    if (!existsSync(full) || this.ctx.dryRun) return
    const src = readFileSync(full, 'utf8')
    if (!src.includes(`'${spec}'`) && !src.includes(`"${spec}"`)) return
    const mod = parseModule(src)
    const local = Object.values(
      mod.imports as Record<string, { from: string; local: string }>,
    ).find((i) => i.from === spec)?.local
    if (!local) return
    const call = findDefineRoutes(mod)
    if (call && Array.isArray(call.$args[0])) {
      const list = call.$args[0]
      for (let i = list.length - 1; i >= 0; i--)
        if (generateCode(list[i]).code.trim() === local) list.splice(i, 1)
    }
    delete (mod.imports as Record<string, unknown>)[local]
    writeFileSync(full, generateCode(mod, { quote: 'single' }).code)
    this.ctx.touched.add(file)
  }

  /** Write queued deps to package.json and run the package manager. */
  async flush(options: { install?: boolean } = {}) {
    const pkgPath = this.ctx.path('package.json')
    const pkg = existsSync(pkgPath)
      ? JSON.parse(readFileSync(pkgPath, 'utf8'))
      : { name: 'app', private: true, type: 'module' }
    pkg.dependencies ??= {}
    pkg.devDependencies ??= {}
    let changed = false
    for (const [name, { version, dev }] of this.deps) {
      const bucket = dev ? pkg.devDependencies : pkg.dependencies
      if (
        bucket[name] !== version &&
        !(name in pkg.dependencies) &&
        !(name in pkg.devDependencies)
      ) {
        bucket[name] = version
        changed = true
      }
    }
    for (const name of this.removals) {
      if (name in pkg.dependencies || name in pkg.devDependencies) {
        delete pkg.dependencies[name]
        delete pkg.devDependencies[name]
        changed = true
      }
    }
    if (changed) {
      pkg.dependencies = sortKeys(pkg.dependencies)
      pkg.devDependencies = sortKeys(pkg.devDependencies)
      if (!this.ctx.dryRun) writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`)
      this.ctx.touched.add('package.json')
    }
    this.deps.clear()
    this.removals.clear()
    this.ctx.pkg = pkg
    this.syncConfigIndex()
    this.format()
    if (options.install && changed && !this.ctx.dryRun) {
      const cmd = this.ctx.pm === 'yarn' ? 'yarn' : `${this.ctx.pm} install`
      this.ctx.log.step(`${cmd}`)
      execSync(cmd, { cwd: this.ctx.root, stdio: this.ctx.verbose ? 'inherit' : 'pipe' })
      // Biome may only exist now.
      this.format()
    }
  }
}

/** `@kitr/api/routes` → `apiRoutes`; `@acme/thing/routes` → `thingRoutes`. */
export function extensionLocalName(spec: string): string {
  const parts = spec.split('/').filter((p) => p && !p.startsWith('@'))
  const base = parts.length > 1 ? parts.slice(-2).join('-') : (parts[0] ?? 'ext')
  const camel = base.replace(/[^a-zA-Z0-9]+(.)?/g, (_, c: string | undefined) =>
    c ? c.toUpperCase() : '',
  )
  return /^[a-zA-Z_$]/.test(camel) ? camel : `_${camel}`
}

/** The `defineRoutes(...)` call in a module: an `export const x = defineRoutes(...)` or the default export. */
function findDefineRoutes(mod: any): any | undefined {
  const isCall = (v: any) =>
    v && v.$type === 'function-call' && generateCode(v).code.startsWith('defineRoutes(')
  for (const value of Object.values(mod.exports ?? {})) if (isCall(value)) return value
  return undefined
}

function hasImportOf(src: string, spec: string) {
  return new RegExp(`import\\(\\s*['"]${escapeRegExp(spec)}['"]\\s*\\)`).test(src)
}
function ensureArray(obj: any, key: string) {
  if (!obj[key]) obj[key] = []
  return obj[key]
}
function sortKeys<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(
    Object.keys(obj)
      .sort()
      .map((k) => [k, obj[k]]),
  ) as T
}
function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
