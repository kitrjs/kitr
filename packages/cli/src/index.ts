import { type CommandDef, runMain as cittyRunMain, defineCommand, runCommand } from 'citty'
import pc from 'picocolors'
import { add, describePackage, remove } from './commands/add'
import { agents } from './commands/agents'
import { catalog } from './commands/catalog'
import { doctor } from './commands/doctor'
import { eject } from './commands/eject'
import { generate, typecheck } from './commands/generate'
import { coreGeneratorCommands, makeCommand, nearestKind, packageGenerators } from './commands/make'
import { newCommand } from './commands/new'
import { packageCheck } from './commands/package-check'
import { build, config, dev, platforms, start } from './commands/platforms'
import { serve } from './commands/serve'
import { types } from './commands/types'
import { upgrade } from './commands/upgrade'
import { cliVersion, createContext, findProjectRoot, findRcPath, log } from './context'
import { installedPackages } from './packages'
import {
  fanOut,
  findWorkspace,
  resolveApp,
  shouldFanOut,
  takeAppFlag,
  takeFilterFlag,
  workspaceCommand,
} from './workspace'

export { createAddContext, createProjectInfo } from './add-context'
export { Codemods } from './codemods'
export { buildCatalog } from './commands/catalog'
export type { Finding } from './commands/doctor'
export { runChecks } from './commands/doctor'
export type { StubFn } from './commands/make'
export {
  coreGenerators,
  generatorRows,
  renderStub,
  stubOverrides,
} from './commands/make'
export { configurePackages } from './configure'
export type { ProjectContext, RcInfo } from './context'
export { createContext, findProjectRoot, readRcInfo } from './context'
export {
  type GenerateRunResult,
  type GenerateStep,
  loadGenerateSteps,
  runGenerate,
} from './generate'
export { blankKit, type Kit, kitNames, loadKit } from './kits'
export {
  categories,
  type KitrCatalog,
  type KitrCatalogEntry,
  type KitrCategory,
  type KitrManifest,
  type KitrPlatformInfo,
  validateManifest,
} from './manifest'
export { kitManifests, manifests } from './manifests.gen'
export type { LoadedPackage } from './packages'
export { cliResolve, installedPackages, loadPackage, resolvePackageName } from './packages'
export { knownPackageNames, resolvePlan } from './plan'
export {
  addPlatform,
  createPlatformContext,
  loadPlatforms,
  platformTypeNames,
  resolvePlatformType,
  runPlatforms,
} from './platforms'
export { describeQuestions, resolveAnswers } from './questions'
export type { TypesRunOptions, TypesRunResult } from './types'
export {
  createGenerateContext,
  GENERATED_DIR,
  generatorsFor,
  loadGenerators,
  platformsGenerator,
  renderPlatforms,
  runTypes,
  watchGlobsOf,
} from './types'
export { versionOf, versions } from './versions'
export {
  findWorkspace,
  findWorkspacePath,
  readWorkspace,
  takeAppFlag,
  type WorkspaceInfo,
} from './workspace'

const info = defineCommand({
  meta: {
    name: 'info',
    description: 'Print the project summary: kitr version, packages, providers, package manager.',
  },
  run() {
    const ctx = createContext()
    const rc = ctx.readRc()
    console.log(
      JSON.stringify(
        {
          root: ctx.root,
          kitr: ctx.kitrVersion,
          packageManager: ctx.pm,
          serverOnly: ctx.isServerOnly(),
          platforms: rc.platforms,
          packages: rc.packages,
          providers: rc.providers,
          directories: rc.directories,
        },
        null,
        2,
      ),
    )
  },
})

export const main = defineCommand({
  meta: {
    name: 'kitr',
    version: cliVersion(),
    description:
      'kitr: one way to build web, mobile, desktop and backend apps. Every command runs from flags alone, so agents and CI never hit a prompt. Inside a project, installed packages add their own commands (kitr ui, kitr make:<kind>), listed here when you run --help there.',
  },
  subCommands: {
    new: newCommand,
    add,
    remove,
    make: makeCommand,
    ...coreGeneratorCommands,
    dev,
    build,
    start,
    serve,
    platforms,
    config,
    types,
    generate,
    typecheck,
    doctor,
    'package:check': packageCheck,
    catalog,
    agents,
    eject,
    upgrade,
    info,
    workspace: workspaceCommand,
  },
})

/**
 * Commands the installed packages contribute: each package's `commands()` module and a
 * `make:<kind>` per generator. Loaded only when needed: for `--help`, or when the word typed is
 * not a core command. Outside a kitr project there are none.
 */
export async function packageCommands(): Promise<Record<string, CommandDef<any>>> {
  const root = findProjectRoot()
  if (!findRcPath(root)) return {}
  const ctx = createContext({ root })
  const out: Record<string, CommandDef<any>> = {}
  const owners: Record<string, string> = {}
  const claim = (name: string, owner: string, command: CommandDef<any>) => {
    if (name in main.subCommands!)
      throw new Error(`${owner} tries to register "${name}", which is a core kitr command`)
    if (owners[name] && owners[name] !== owner)
      throw new Error(`${owner} and ${owners[name]} both register the "${name}" command`)
    owners[name] = owner
    out[name] = command
  }
  for (const loaded of await installedPackages(ctx)) {
    if (!loaded.definition.commands) continue
    try {
      const mod = (await loaded.definition.commands()) as Record<string, any>
      const commands = (
        mod.default && typeof mod.default === 'object' && !mod.default.meta ? mod.default : mod
      ) as Record<string, CommandDef<any>>
      for (const [key, command] of Object.entries(commands)) {
        if (
          !command ||
          typeof command !== 'object' ||
          !('run' in command || 'subCommands' in command)
        )
          continue
        const meta =
          command.meta && typeof command.meta === 'object' && !('then' in command.meta)
            ? (command.meta as { name?: string })
            : undefined
        claim(meta?.name ?? key, loaded.package, command)
      }
    } catch (error) {
      if (process.env.DEBUG) console.error(error)
      log.warn(`${loaded.package}: could not load its commands (${(error as Error).message})`)
    }
  }
  for (const [name, command] of Object.entries(await packageGenerators(ctx)))
    claim(name, (command.meta as { description?: string })?.description ?? name, command)
  return out
}

export async function runMain(rawArgv = process.argv.slice(2)) {
  // Monorepo mode: `--app <name>` runs the command inside that app of kitr.workspace.ts; a
  // fan-out command typed at the workspace root runs in every app. `--filter=a,b` is the same as
  // typing the names after the command.
  let argv = rawArgv
  try {
    const taken = takeAppFlag(takeFilterFlag(rawArgv))
    argv = taken.argv
    if (taken.app) process.chdir(resolveApp(findWorkspace(), taken.app))
    else {
      const workspace = shouldFanOut(argv)
      if (workspace) return await fanOut(workspace, argv)
    }
  } catch (error) {
    console.error(`\n${pc.red('✖')} ${(error as Error).message}`)
    process.exitCode = 1
    return
  }
  const first = argv[0]
  const wantsHelp = argv.includes('--help') || argv.includes('-h')
  // `kitr add jobs --help`: the package's questions as flags.
  if (first === 'add' && wantsHelp && argv[1] && !argv[1].startsWith('-')) {
    try {
      console.log(await describePackage(argv[1]))
      return
    } catch (error) {
      console.error(`\n${pc.red('✖')} ${(error as Error).message}`)
      process.exitCode = 1
      return
    }
  }
  const core = main.subCommands as Record<string, CommandDef<any>>
  let command = main
  if (wantsHelp || (first && !first.startsWith('-') && !(first in core))) {
    const extra = await packageCommands().catch((error) => {
      console.error(`\n${pc.red('✖')} ${(error as Error).message}`)
      process.exitCode = 1
      return {}
    })
    if (Object.keys(extra).length)
      command = defineCommand({ ...main, subCommands: { ...core, ...extra } })
  }
  // `kitr make:controler`: name the generator they meant instead of citty's "unknown command".
  if (first?.startsWith('make:') && !wantsHelp) {
    const commands = command.subCommands as Record<string, CommandDef<any>>
    if (!(first in commands)) {
      const kinds = Object.keys(commands)
        .filter((n) => n.startsWith('make:'))
        .map((n) => n.slice('make:'.length))
      const near = nearestKind(first.slice('make:'.length), kinds)
      console.error(
        `\n${pc.red('✖')} There is no ${first} generator in this project.${
          near ? ` Did you mean make:${near}?` : ''
        } Run kitr make to list them, or kitr add <package> for its generators.`,
      )
      process.exitCode = 1
      return
    }
  }
  if (argv.length === 1 && (argv[0] === '--version' || argv[0] === '-v')) {
    console.log(cliVersion())
    return
  }
  if (wantsHelp) return cittyRunMain(command, { rawArgs: argv })
  try {
    await runCommand(command, { rawArgs: argv })
  } catch (error) {
    // Print the message only; the stack is noise for a user-facing error. DEBUG=1 shows it.
    const message = error instanceof Error ? error.message : String(error)
    console.error(`\n${pc.red('✖')} ${message}`)
    if (process.env.DEBUG && error instanceof Error) console.error(error.stack)
    process.exitCode = 1
  }
}
