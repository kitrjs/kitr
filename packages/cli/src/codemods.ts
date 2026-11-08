import { execSync } from 'node:child_process'
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { builders, generateCode, parseModule } from 'magicast'
import { type ProjectContext, projectBin } from './context'
import { readPlatformConfig } from './platform-config'
import { findRcBlock, insertEntry, quoteOf, removeEntries } from './rc-text'
import { versionOf } from './versions'

/** Which route table a package extends: pages (`app`) or endpoints and sockets (`server`). */
export type RouteTableSide = 'app' | 'server'

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
  addProvider(spec: string, comment?: string) {
    this.editRcList('providers', { add: { spec, lazy: true } })
    if (comment) this.commentProvider(spec, comment)
  }

  /** A `// comment` line above the provider's lazy import, once. */
  private commentProvider(spec: string, comment: string) {
    const rcPath = this.ctx.rcPath ?? this.ctx.path('kitrrc.ts')
    if (this.ctx.dryRun || !existsSync(rcPath)) return
    const lines = readFileSync(rcPath, 'utf8').split('\n')
    const at = lines.findIndex((line) => line.includes(`import('${spec}')`))
    if (at < 0 || lines[at - 1]?.trim() === `// ${comment}`) return
    const line = lines[at]!
    const indent = /^\s*/.exec(line)![0]
    // `providers: [() => import('x')]` on one line: open the array so the comment has a line of its own.
    const inline = /^(\s*)providers:\s*\[(\(\) => import\('[^']+'\))\](,?)$/.exec(line)
    if (inline) {
      lines.splice(
        at,
        1,
        `${indent}providers: [`,
        `${indent}  // ${comment}`,
        `${indent}  ${inline[2]},`,
        `${indent}]${inline[3]}`,
      )
    } else if (/^\s*\(\) => import\(/.test(line)) {
      lines.splice(at, 0, `${indent}// ${comment}`)
    } else return
    writeFileSync(rcPath, lines.join('\n'))
  }
  removeProvider(spec: string) {
    this.editRcList('providers', { remove: (text) => hasImportOf(text, spec) })
  }
  addPackage(name: string) {
    this.editRcList('packages', { add: { spec: name, lazy: false } })
  }
  removePackage(name: string) {
    this.editRcList('packages', {
      remove: (text) => text.slice(1, -1) === name && /^['"]/.test(text),
    })
  }
  addCommand(spec: string) {
    this.editRcList('commands', { add: { spec, lazy: true } })
  }

  /**
   * Edit one list of kitrrc.ts (`packages`, `providers`, `commands`) as text. The list's own
   * entries, their order, comments, quotes and indentation are never reprinted: an added entry is
   * inserted after the last one in the style of the others, and a removed entry takes its own line
   * with it. Falls back to a structural edit when the list does not exist yet.
   */
  private editRcList(
    key: 'packages' | 'providers' | 'commands',
    edit: { add?: { spec: string; lazy: boolean }; remove?: (elementSource: string) => boolean },
  ) {
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
    const list = findRcBlock(src, key, '[')
    if (!list) {
      // No such list yet: let magicast create it.
      return this.editRc((mod) => {
        if (!edit.add) return
        const { spec, lazy } = edit.add
        ensureArray(mod, key).push(lazy ? builders.raw(`() => import('${spec}')`) : spec)
      })
    }
    let next = src
    if (edit.add) {
      const { spec, lazy } = edit.add
      const present = list.elements.some((el) => {
        const text = src.slice(el.start, el.end)
        return lazy ? hasImportOf(text, spec) : text.slice(1, -1) === spec && /^['"]/.test(text)
      })
      if (present) return
      const quote = quoteOf(src, list)
      next = insertEntry(
        src,
        list,
        lazy ? `() => import(${quote}${spec}${quote})` : `${quote}${spec}${quote}`,
      )
    }
    if (edit.remove) {
      const doomed = list.elements.filter((el) => edit.remove?.(src.slice(el.start, el.end)))
      if (!doomed.length) return
      next = removeEntries(src, list, doomed)
    }
    if (next === src) return
    writeFileSync(rcPath, next)
    this.ctx.touched.add('kitrrc.ts')
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
    const next = cssImportEdit(src, from, to)
    if (next === src) return
    writeFileSync(full, next)
    this.ctx.touched.add(file)
  }

  /**
   * Insert `line` (with its import) into the server entry once. By default it goes after the
   * routes and anything attached before it; `first` puts it straight after `createServer()` so
   * middleware that must see every request reads in the order it runs. The entry is the
   * `server` platform's `entry` option when one is listed in kitrrc.ts, else `server/main.ts`.
   */
  attachToServer(options: { marker: string; import?: string; line: string; first?: boolean }) {
    const file = this.serverEntry()
    const full = this.ctx.path(file)
    if (!existsSync(full)) return
    const main = readFileSync(full, 'utf8')
    if (main.includes(options.marker)) return
    let next = options.import
      ? main.replace(/(import \{ createServer \} from '@kitr\/server'\n)/, `$1${options.import}\n`)
      : main
    next = options.first
      ? next.replace(/(export const server = createServer\([^\n]*\)\n)/, `$1${options.line}\n`)
      : next.replace(
          /(export const server = createServer\([^\n]*\)\n(?:(?:\/\/[^\n]*\n)?(?!export |const |\n)[^\n]+\n)*)/,
          `$1${options.line}\n`,
        )
    if (next === main) return
    if (!this.ctx.dryRun) writeFileSync(full, next)
    this.ctx.touched.add(file)
    this.ctx.log.step(`edit ${file}`)
  }

  /** The server platform's entry file from kitrrc.ts, default `server/main.ts`. */
  serverEntry(): string {
    const platform = Object.values(this.ctx.readRc().platforms).find((p) => p.factory === 'server')
    const entry = platform?.options?.entry
    return typeof entry === 'string'
      ? entry
      : `${this.ctx.readRc().directories.server ?? 'server'}/main.ts`
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
    mod.imports.$append({ from: spec, imported: 'default', local })
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

  /**
   * Make the project ready for `kitr types`: the `#kitr/*` path and `.kitr` include in
   * tsconfig.json, `.kitr` in .gitignore, and the typecheck script going through `kitr typecheck`.
   * Projects from `kitr new` have all of it; this brings older ones up to date. Idempotent.
   */
  enableGeneratedTypes() {
    const tsPath = this.ctx.path('tsconfig.json')
    if (existsSync(tsPath)) {
      const ts = JSON.parse(readFileSync(tsPath, 'utf8'))
      let changed = false
      ts.compilerOptions ??= {}
      ts.compilerOptions.paths ??= {}
      if (!ts.compilerOptions.paths['#kitr/*']) {
        ts.compilerOptions.paths['#kitr/*'] = ['./.kitr/*']
        changed = true
      }
      ts.include ??= []
      // A bare `.kitr` is skipped by tsc (dot folders), the explicit wildcard is not.
      if (!ts.include.includes('.kitr/**/*')) {
        ts.include.push('.kitr/**/*')
        changed = true
      }
      if (changed) {
        if (!this.ctx.dryRun) writeFileSync(tsPath, `${JSON.stringify(ts, null, 2)}\n`)
        this.ctx.touched.add('tsconfig.json')
      }
    }
    const ignorePath = this.ctx.path('.gitignore')
    const ignore = existsSync(ignorePath) ? readFileSync(ignorePath, 'utf8') : ''
    if (!ignore.split('\n').some((line) => line.trim() === '.kitr' || line.trim() === '.kitr/')) {
      if (!this.ctx.dryRun)
        writeFileSync(ignorePath, `${ignore}${ignore && !ignore.endsWith('\n') ? '\n' : ''}.kitr\n`)
      this.ctx.touched.add('.gitignore')
    }
    const pkg = this.ctx.pkg
    const typecheck: string | undefined = pkg.scripts?.typecheck
    // `kitr typecheck` generates, then runs tsc; a script already calling kitr is left alone.
    if (typecheck && !/\bkitr (types|generate|typecheck)\b/.test(typecheck))
      this.setScript(
        'typecheck',
        /^tsc( --noEmit)?$/.test(typecheck) ? 'kitr typecheck' : `kitr generate && ${typecheck}`,
      )
    if (pkg.imports && !pkg.imports['#kitr/*']) {
      this.setPackageField('imports', { ...pkg.imports, '#kitr/*': './.kitr/*' })
    }
  }

  /**
   * Pass the generated operations to `createApp` in `app/app.ts`: adds
   * `import { operations } from '#kitr/actions'` and `operations` to the options. Idempotent.
   */
  /** Pass `<name>` (imported from `from`) to `createApp({ ... })` in app/app.ts. Idempotent. */
  registerAppOption(name: string, from: string) {
    const file = `${this.ctx.readRc().directories.app ?? 'app'}/app.ts`
    const full = this.ctx.path(file)
    if (!existsSync(full) || this.ctx.dryRun) return
    const src = readFileSync(full, 'utf8')
    if (src.includes(`'${from}'`)) return
    const withImport = src.replace(
      /^((?:import[^\n]*\n)+)/m,
      `$1import { ${name} } from '${from}'\n`,
    )
    const next = withImport.replace(/createApp\(\{\s*/, (m) => `${m}${name}, `)
    if (next === src) {
      this.ctx.log.warn(
        `${file}: could not find createApp({ ... }); add \`${name}\` from '${from}' yourself`,
      )
      return
    }
    writeFileSync(full, next)
    this.ctx.touched.add(file)
  }

  unregisterAppOption(name: string, from: string) {
    const file = `${this.ctx.readRc().directories.app ?? 'app'}/app.ts`
    const full = this.ctx.path(file)
    if (!existsSync(full) || this.ctx.dryRun) return
    const src = readFileSync(full, 'utf8')
    if (!src.includes(`'${from}'`)) return
    const escaped = from.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
    const next = src
      .replace(new RegExp(`^import \\{ ${name} \\} from '${escaped}'\\n`, 'm'), '')
      .replace(new RegExp(`(createApp\\(\\{\\s*)${name},\\s*`), '$1')
      .replace(new RegExp(`,\\s*${name}(\\s*\\})`), '$1')
    writeFileSync(full, next)
    this.ctx.touched.add(file)
  }

  /** Set a package.json script, replacing what is there. */
  setScript(name: string, command: string) {
    this.addScript(name, command)
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
    const bin = projectBin(this.ctx.root, 'biome')
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
   * Regenerate it from every file in config/. Idempotent. When a platform has its own folder
   * (`config/admin/theme.ts`) or leaves packages out (`without`), the index holds one object per
   * such platform and picks one with `forBuildPlatform()`, so the server built as `api` reads what
   * the Vite plugin would give the `api` build.
   */
  syncConfigIndex() {
    const rc = this.ctx.readRc()
    const dir = rc.directories.config ?? 'config'
    if (!this.ctx.exists(dir)) return
    const layout = readPlatformConfig(this.ctx, rc)
    const names = layout.shared
    const ident = (n: string) => n.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
    // Platform names may hold `_` and capitals too (`admin_v2`, `adminV2`).
    const camel = (n: string) => n.replace(/[-_]([a-z0-9])/gi, (_, c) => c.toUpperCase())
    const header = `// Generated by kitr: one entry per file in ${dir}/. \`kitr add\` rewrites it; edit freely between runs.\n`
    const entry = (key: string, value: string) =>
      `  ${key === value ? key : `${/^[a-zA-Z_$][\w$]*$/.test(key) ? key : `'${key}'`}: ${value}`},`
    const own = Object.entries(layout.platforms).filter(
      ([, p]) => p.overrides.length || p.dropped.length,
    )
    if (!own.length) {
      const body = `${header}${names.map((n) => `import ${ident(n)} from './${n}'`).join('\n')}\n\nexport const config = {\n${names.map((n) => `  ${ident(n) === n ? n : `'${n}': ${ident(n)}`},`).join('\n')}\n}\n`
      this.ctx.write(`${dir}/index.ts`, body, { overwrite: true })
      return
    }
    const imports = [
      "import { forBuildPlatform } from 'kitr/app'",
      ...names.map((n) => `import ${ident(n)} from './${n}'`),
    ]
    const objects = [`const shared = {\n${names.map((n) => entry(n, ident(n))).join('\n')}\n}`]
    const table: string[] = []
    for (const [platform, p] of own) {
      const local = (n: string) => camel(`${platform}-${n}`)
      for (const n of p.overrides) imports.push(`import ${local(n)} from './${platform}/${n}'`)
      const value = (n: string) => (p.overrides.includes(n) ? local(n) : ident(n))
      const object = camel(`${platform}-config`)
      // Overrides only: the shared object, then this platform's files. With `without`, the list.
      const lines = p.dropped.length
        ? p.files.map((f) => entry(f.name, value(f.name)))
        : ['  ...shared,', ...p.overrides.map((n) => entry(n, value(n)))]
      objects.push(`const ${object} = {\n${lines.join('\n')}\n}`)
      table.push(`${/^[a-zA-Z_$][\w$]*$/.test(platform) ? platform : `'${platform}'`}: ${object}`)
    }
    const body = `${header}${imports.join('\n')}\n\n${objects.join('\n\n')}\n\n/** The build's platform (KITR_PLATFORM) picks its object; anything else gets the shared one. */\nexport const config = forBuildPlatform({ ${table.join(', ')}, default: shared })\n`
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
  /**
   * The route table a package extends. Pages live in the app table (`directories.routeTable`,
   * default `app/routes.ts`); endpoints and sockets in the server table (`directories.serverRouteTable`,
   * default `server/routes.ts`) so the server bundle never imports React. A server-only project
   * has one table, the server's.
   */
  routeTablePath(table: RouteTableSide = 'app'): string {
    const dirs = this.ctx.readRc().directories
    if (table === 'server' || this.ctx.isServerOnly())
      return dirs.serverRouteTable ?? `${dirs.server ?? 'server'}/routes.ts`
    return dirs.routeTable ?? `${dirs.app ?? 'app'}/routes.ts`
  }

  /**
   * Add a route-table extension: `import <name> from '<spec>'` and `<name>` in the first argument of
   * `defineRoutes([...], ...)`. Creates the file with an empty table when missing. Idempotent.
   */
  extendRoutes(spec: string, options: { table?: RouteTableSide } = {}) {
    const file = this.routeTablePath(options.table)
    const full = this.ctx.path(file)
    const server = options.table === 'server' || this.ctx.isServerOnly()
    if (!existsSync(full)) {
      const what = server ? 'endpoints and sockets' : 'routes'
      this.ctx.write(
        file,
        `import { defineRoutes } from 'kitr/app'\n\n/** The ${what} of this app. Packages add their methods here (\`kitr add\` maintains the list). */\nexport const routes = defineRoutes([], (r) => r)\n\nexport type ${server ? 'ServerRoutes' : 'AppRoutes'} = typeof routes.$types\n`,
      )
    }
    if (this.ctx.dryRun) return
    // Whatever extends the server table needs the server to serve it.
    if (server) this.mountServerRoutes()
    const src = readFileSync(full, 'utf8')
    if (src.includes(`'${spec}'`) || src.includes(`"${spec}"`)) return
    const local = extensionLocalName(spec)
    const mod = parseModule(src)
    const call = findDefineRoutes(mod)
    if (!call) throw new Error(`${file}: expected a \`defineRoutes([...], ...)\` call`)
    insertPackageImport(mod, spec, local)
    if (!call.$args.length || !Array.isArray(call.$args[0])) call.$args.unshift([])
    call.$args[0].push(builders.raw(local))
    writeFileSync(full, emit(mod))
    this.ctx.touched.add(file)
  }

  removeRoutesExtension(spec: string, options: { table?: RouteTableSide } = {}) {
    const file = this.routeTablePath(options.table)
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
    writeFileSync(full, emit(mod))
    this.ctx.touched.add(file)
  }

  /**
   * Append a link to the method chain of a route table: `.page(...)`, `.ws(...)`, anything the
   * table's extensions provide. `imports` are added when missing. Returns false when the table is
   * not a chain (`(r) => { ... }`), in which case the caller tells the user to add the line by hand.
   * Idempotent on `options.skipIf` (a pattern already present means the link is there).
   */
  appendRoute(
    link: string,
    options: {
      table?: RouteTableSide
      imports?: Array<{ from: string; local: string; imported?: string }>
      skipIf?: RegExp
    } = {},
  ): boolean {
    const file = this.routeTablePath(options.table)
    const full = this.ctx.path(file)
    if (!existsSync(full))
      this.extendRoutes(
        options.table === 'server' ? '@kitr/api/routes' : '@kitr/router/routes',
        options,
      )
    if (this.ctx.dryRun) return true
    let src = readFileSync(full, 'utf8')
    if (options.skipIf?.test(src)) return true
    const mod = parseModule(src)
    const call = findDefineRoutes(mod)
    const define = call?.$ast?.arguments?.[1]
    const body = define?.body
    if (!body || body.type === 'BlockStatement' || typeof body.end !== 'number') return false
    let added = false
    for (const spec of options.imports ?? []) {
      if (src.includes(`'${spec.from}'`) || src.includes(`"${spec.from}"`)) continue
      mod.imports.$append({
        from: spec.from,
        imported: spec.imported ?? spec.local,
        local: spec.local,
      })
      added = true
    }
    if (added) src = emit(mod)
    // Imports changed the offsets: find the chain again in the new source.
    const again = findDefineRoutes(parseModule(src))?.$ast?.arguments?.[1]
    const chainEnd: number = again?.body?.end ?? body.end
    const chainStart: number = again?.start ?? define.start ?? 0
    // `(r) => r` (the empty table) becomes `(r) => r.page(...)`; a chain gets one more link.
    const indent = /\n( *)\./.exec(src.slice(chainStart, chainEnd))?.[1] ?? '    '
    const next = `${src.slice(0, chainEnd)}\n${indent}${link}${src.slice(chainEnd)}`
    writeFileSync(full, next)
    this.ctx.touched.add(file)
    return true
  }

  /** Append `.page('<path>', { lazy: () => import('<module>') })` to the app table. */
  addPage(path: string, module: string): boolean {
    return this.appendRoute(`.page('${path}', { lazy: () => import('${module}') })`, {
      table: 'app',
      skipIf: new RegExp(`\\.page\\(\\s*['"]${escapeRegExp(path)}['"]`),
    })
  }

  /**
   * Pass the server table to `createServer({ ... })` in the server entry, importing it. Called
   * whenever a package extends the server table, so a server/main.ts written before the table
   * existed serves it too. Idempotent; skipped when there is no server entry.
   */
  mountServerRoutes() {
    const file = this.serverEntry()
    const full = this.ctx.path(file)
    if (!existsSync(full)) return
    const main = readFileSync(full, 'utf8')
    const call = /createServer\(\{([^}]*)\}\)/.exec(main)
    if (!call || /\broutes\b/.test(call[1]!)) return
    const table = this.routeTablePath('server')
    const spec = relativeImport(file, table)
    let next = main.replace(call[0], `createServer({${call[1]!.replace(/\s*$/, '')}, routes })`)
    if (!next.includes(`'${spec}'`) && !next.includes('#server/routes'))
      next = next.replace(
        /(import \{ createServer \} from '@kitr\/server'\n)/,
        `$1import { routes } from '${spec}'\n`,
      )
    if (next === main) return
    if (!this.ctx.dryRun) writeFileSync(full, next)
    this.ctx.touched.add(file)
    this.ctx.log.step(`edit ${file}`)
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

/**
 * `import <local> from '<spec>'` after the last package import (before `#app/*` and relative
 * ones), so the extension list reads in the order it is declared and the file stays sorted.
 */
function insertPackageImport(mod: ReturnType<typeof parseModule>, spec: string, local: string) {
  type Decl = { type: string; source?: { value?: unknown } }
  const body = (mod.$ast as unknown as { body: Decl[] }).body
  let at = 0
  body.forEach((node, i) => {
    const from = node.type === 'ImportDeclaration' ? String(node.source?.value ?? '') : null
    if (from !== null && !from.startsWith('#') && !from.startsWith('.')) at = i + 1
  })
  const decl = (parseModule(`import ${local} from '${spec}'\n`).$ast as unknown as { body: Decl[] })
    .body[0]!
  body.splice(at, 0, decl)
}

/** `@kitr/api/routes` → `api`; `@acme/thing/routes` → `thing`; `my-router` → `myRouter`. */
export function extensionLocalName(spec: string): string {
  const parts = spec.split('/').filter((p) => p && !p.startsWith('@'))
  // `@kitr/api/routes` is the api package's extension: `api` in `defineRoutes([api], ...)`.
  const base =
    parts.length > 1 && parts.at(-1) === 'routes'
      ? parts.at(-2)!
      : parts.length > 1
        ? parts.slice(-2).join('-')
        : (parts[0] ?? 'ext')
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

/** magicast output in the project's style: single quotes, no semicolons on imports, no blank line before the one it added. */
function emit(mod: any): string {
  return generateCode(mod, { quote: 'single' })
    .code.replace(/^(import [^\n]*);$/gm, '$1')
    .replace(/\n\n(import [^\n]*\n)(?=\n)/g, '\n$1')
}

/** `server/main.ts` importing `server/routes.ts` → `./routes`; across directories → `../x/routes`. */
export function relativeImport(from: string, to: string): string {
  const fromParts = from.split('/').slice(0, -1)
  const toParts = to.replace(/\.tsx?$/, '').split('/')
  let i = 0
  while (i < fromParts.length && i < toParts.length - 1 && fromParts[i] === toParts[i]) i++
  const up = fromParts.length - i
  const rest = toParts.slice(i).join('/')
  return up === 0 ? `./${rest}` : `${'../'.repeat(up)}${rest}`
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

/**
 * Swap or add a stylesheet in a route file. Start's root route links its CSS as
 * `import css0 from 'x.css?url'` plus `{ rel: 'stylesheet', href: css0 }`; other files import it
 * for its side effect. Either way the old sheet is replaced, never loaded next to the new one.
 */
export function cssImportEdit(src: string, from: string | undefined, to: string): string {
  if (src.includes(`'${to}'`) || src.includes(`'${to}?url'`)) return src
  if (from && src.includes(`'${from}?url'`)) return src.replace(`'${from}?url'`, `'${to}?url'`)
  if (from && src.includes(`import '${from}'`))
    return src.replace(`import '${from}'`, `import '${to}'`)
  const linked = [...src.matchAll(/^import (\w+) from '[^']+\?url'\n/gm)]
  const links = src.match(/links: \[/)
  if (linked.length && links) {
    let n = linked.length
    while (new RegExp(`\\bcss${n}\\b`).test(src)) n++
    const last = linked[linked.length - 1]!
    const at = last.index! + last[0].length
    const withImport = `${src.slice(0, at)}import css${n} from '${to}?url'\n${src.slice(at)}`
    return withImport.replace(
      /links: \[([^\]]*)\]/,
      (_m, inner: string) =>
        `links: [${inner.trim() ? `${inner.trim()}, ` : ''}{ rel: 'stylesheet', href: css${n} }]`,
    )
  }
  return src.replace(/^(import[^\n]*\n)(?!import)/m, `$1import '${to}'\n`)
}
