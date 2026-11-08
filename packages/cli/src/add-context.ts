import type { AddContext, Answers, DependencySpec, ProjectInfo } from '@kitr/core/package'
import { resolvePackageName } from '@kitr/core/package'
import type { Codemods } from './codemods'
import type { ProjectContext } from './context'

/**
 * The read-only project facts a package's questions, `doctor` and `add` see. `added` holds the
 * packages this run has configured so far, so a later package can see an earlier one before
 * kitrrc.ts is re-read.
 */
export function createProjectInfo(
  ctx: ProjectContext,
  codemods?: Codemods,
  added: Set<string> = new Set(),
): ProjectInfo {
  const rc = () => ctx.readRc()
  return {
    root: ctx.root,
    pm: ctx.pm,
    get pkg() {
      return ctx.pkg
    },
    get rc() {
      return rc()
    },
    get isServerOnly() {
      return ctx.isServerOnly() && !added.has('@kitr/react')
    },
    has: (dep) =>
      dep in { ...ctx.pkg.dependencies, ...ctx.pkg.devDependencies } || !!codemods?.queued(dep),
    hasPackage(name) {
      const full = resolvePackageName(name)
      return rc().packages.includes(full) || added.has(full)
    },
    exists: (path) => ctx.exists(path),
    read: (path) => ctx.read(path),
  }
}

/** Everything a package's `add` and `remove` may do, over the shared codemod queue. */
export function createAddContext(
  ctx: ProjectContext,
  codemods: Codemods,
  answers: Answers,
  added: Set<string> = new Set(),
): AddContext {
  const info = createProjectInfo(ctx, codemods, added)
  const configDir = () => ctx.readRc().directories.config ?? 'config'
  return {
    ...info,
    // Getters do not survive a spread; re-declare the live ones.
    get pkg() {
      return ctx.pkg
    },
    get rc() {
      return ctx.readRc()
    },
    get isServerOnly() {
      return info.isServerOnly
    },
    answers,
    dryRun: ctx.dryRun,
    log: ctx.log,
    deps: {
      add(...specs: Array<string | DependencySpec>) {
        codemods.installPackages(specs)
      },
      remove(...names: string[]) {
        codemods.removePackages(names)
      },
    },
    provider: {
      add: (spec, options) => codemods.addProvider(spec, options?.comment),
      remove: (spec) => codemods.removeProvider(spec),
    },
    config(name, source, options) {
      ctx.write(`${configDir()}/${name}.ts`, source, options)
    },
    write: (path, content, options) => ctx.write(path, content, options),
    unlink: (path) => codemods.remove(path),
    edit: (path, fn, options) => codemods.editFile(path, fn, options),
    scripts: {
      add: (name, command) => codemods.addScript(name, command),
      remove: (name, command) => codemods.removeScripts({ [name]: command }),
    },
    packageJson: {
      set: (field, value) => codemods.setPackageField(field, value),
      remove: (field, value) => codemods.removePackageField(field, value),
    },
    env: {
      add: (vars, comment) => codemods.addEnv(vars, comment),
      schema: (scope, name, schema, example) => codemods.addEnvSchema(scope, name, schema, example),
    },
    agents: {
      add: (name, body) => codemods.addAgentsSection(name, body),
      remove: (name) => codemods.removeAgentsSection(name),
    },
    tsconfig: {
      addTypes: (...types) => codemods.addTsconfigList('compilerOptions', 'types', types),
      removeTypes: (...types) => codemods.removeTsconfigList('compilerOptions', 'types', types),
      addLib: (...libs) => codemods.addTsconfigList('compilerOptions', 'lib', libs),
      addInclude: (...entries) => codemods.addTsconfigList('root', 'include', entries),
      addPaths(paths) {
        codemods.editTsconfig((ts) => {
          ts.compilerOptions ??= {}
          const opts = ts.compilerOptions
          opts.paths ??= {}
          for (const [k, v] of Object.entries(paths)) opts.paths[k] ??= v
        })
      },
      set(option, value) {
        codemods.editTsconfig((ts) => {
          ts.compilerOptions ??= {}
          ts.compilerOptions[option] = value
        })
      },
    },
    vite: {
      addPlugin: (importName, spec, call) => codemods.addVitePlugin(importName, spec, call),
    },
    routes: {
      extend: (spec, options) => codemods.extendRoutes(spec, options),
      remove: (spec, options) => codemods.removeRoutesExtension(spec, options),
      addPage: (path, module) => codemods.addPage(path, module),
      append: (link, options) => codemods.appendRoute(link, options),
    },
    types: { enable: () => codemods.enableGeneratedTypes() },
    app: {
      option: (name, from) => codemods.registerAppOption(name, from),
      removeOption: (name, from) => codemods.unregisterAppOption(name, from),
    },
    replaceImport: (file, from, to) => codemods.replaceCssImport(file, from, to),
    server: {
      attach: (options) => codemods.attachToServer(options),
    },
  }
}
