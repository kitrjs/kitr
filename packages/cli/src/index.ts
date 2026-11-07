import { runMain as cittyRunMain, defineCommand, runCommand } from 'citty'
import pc from 'picocolors'
import { add, remove } from './commands/add'
import { apiSync, routesList } from './commands/api'
import { cssTypes } from './commands/css-types'
import { doctor } from './commands/doctor'
import { eject } from './commands/eject'
import {
  makeChannel,
  makeComponent,
  makeController,
  makeException,
  makeForm,
  makeHook,
  makeJob,
  makeMail,
  makeMiddleware,
  makeMutation,
  makeProvider,
  makeQueries,
  makeQuery,
  makeRoute,
  makeService,
  makeStore,
  makeTest,
  makeValidator,
} from './commands/make'
import { newCommand } from './commands/new'
import { packageCheck } from './commands/package-check'
import { build, config, dev, platforms, start } from './commands/platforms'
import { serve } from './commands/serve'
import { types } from './commands/types'
import { ui } from './commands/ui'
import { upgrade } from './commands/upgrade'
import { createContext } from './context'

export { Codemods } from './codemods'
export type { Finding } from './commands/doctor'
export { runChecks } from './commands/doctor'
export { addComponents, DEFAULT_REGISTRY } from './commands/ui'
export type { ProjectContext, RcInfo } from './context'
export { createContext, findProjectRoot, readRcInfo } from './context'
export { kits } from './kits'
export {
  addPlatform,
  createPlatformContext,
  loadPlatforms,
  platformTypes,
  runPlatforms,
} from './platforms'
export type { Recipe } from './recipes'
export { recipeNames, recipes, resolveRecipes } from './recipes'
export type { StubFn } from './stubs'
export { naming, renderStub, stubs } from './stubs'
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
    'make:query': makeQuery,
    'make:mutation': makeMutation,
    'make:controller': makeController,
    'make:middleware': makeMiddleware,
    'make:channel': makeChannel,
    'make:store': makeStore,
    'make:form': makeForm,
    'make:queries': makeQueries,
    'make:provider': makeProvider,
    'make:job': makeJob,
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
    types,
    doctor,
    'package:check': packageCheck,
    eject,
    upgrade,
    info,
  },
})

export async function runMain(argv = process.argv.slice(2)) {
  if (
    argv.includes('--help') ||
    argv.includes('-h') ||
    (argv.length === 1 && argv[0] === '--version')
  )
    return cittyRunMain(main, { rawArgs: argv })
  try {
    await runCommand(main, { rawArgs: argv })
  } catch (error) {
    // Print the message only; the stack is noise for a user-facing error. DEBUG=1 shows it.
    const message = error instanceof Error ? error.message : String(error)
    console.error(`\n${pc.red('✖')} ${message}`)
    if (process.env.DEBUG && error instanceof Error) console.error(error.stack)
    process.exitCode = 1
  }
}
