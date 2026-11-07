import { type CommandDef, runMain as cittyRunMain, defineCommand, runCommand } from 'citty'
import pc from 'picocolors'
import { add, describePackage, remove } from './commands/add'
import { apiSync, routesList } from './commands/api'
import { cssTypes } from './commands/css-types'
import { doctor } from './commands/doctor'
import { eject } from './commands/eject'
import {
  makeAction,
  makeChannel,
  makeComponent,
  makeController,
  makeException,
  makeForm,
  makeHook,
  makeMail,
  makeMiddleware,
  makeProvider,
  makeQueries,
  makeRoute,
  makeService,
  makeStore,
  makeTest,
  makeValidator,
  packageGenerators,
} from './commands/make'
import { newCommand } from './commands/new'
import { packageCheck } from './commands/package-check'
import { build, config, dev, platforms, start } from './commands/platforms'
import { serve } from './commands/serve'
import { ui } from './commands/ui'
import { upgrade } from './commands/upgrade'
import { createContext, findProjectRoot, findRcPath, log } from './context'
import { installedPackages } from './packages'

export { Codemods } from './codemods'
export type { Finding } from './commands/doctor'
export { runChecks } from './commands/doctor'
export { addComponents, DEFAULT_REGISTRY } from './commands/ui'
export { configurePackages } from './configure'
export type { ProjectContext, RcInfo } from './context'
export { createContext, findProjectRoot, readRcInfo } from './context'
export { kits } from './kits'
export { installedPackages, loadPackage, resolvePackageName } from './packages'
export { resolvePlan } from './plan'
export {
  addPlatform,
  createPlatformContext,
  loadPlatforms,
  platformTypes,
  runPlatforms,
} from './platforms'
export { describeQuestions, resolveAnswers } from './questions'
export type { Recipe } from './recipes'
export { recipeNames, recipes, resolveRecipes } from './recipes'
export type { StubFn } from './stubs'
export { naming, renderStub, stubs } from './stubs'
export { versionOf, versions } from './versions'

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
    description:
      'kitr: the React framework where everything is an add-on. Every command runs from flags alone, so agents and CI never hit a prompt.',
  },
  subCommands: {
    new: newCommand,
    add,
    remove,
    'make:route': makeRoute,
    'make:action': makeAction,
    'make:controller': makeController,
    'make:middleware': makeMiddleware,
    'make:channel': makeChannel,
    'make:store': makeStore,
    'make:form': makeForm,
    'make:queries': makeQueries,
    'make:provider': makeProvider,
    'make:mail': makeMail,
    'make:service': makeService,
    'make:validator': makeValidator,
    'make:test': makeTest,
    'make:component': makeComponent,
    'make:hook': makeHook,
    'make:exception': makeException,
    dev,
    build,
    start,
    serve,
    platforms,
    config,
    ui,
    'api:sync': apiSync,
    'routes:list': routesList,
    'css:types': cssTypes,
    doctor,
    'package:check': packageCheck,
    eject,
    upgrade,
    info,
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

export async function runMain(argv = process.argv.slice(2)) {
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
  if (wantsHelp || (argv.length === 1 && argv[0] === '--version'))
    return cittyRunMain(command, { rawArgs: argv })
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
