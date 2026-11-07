import { runMain as cittyRunMain, defineCommand } from 'citty'
import { add, remove } from './commands/add'
import { apiSync, routesList } from './commands/api'
import { cssTypes } from './commands/css-types'
import { doctor } from './commands/doctor'
import { eject } from './commands/eject'
import {
  makeAction,
  makeChannel,
  makeController,
  makeForm,
  makeMiddleware,
  makeProvider,
  makeQueries,
  makeRoute,
  makeStore,
} from './commands/make'
import { newCommand } from './commands/new'
import { serve } from './commands/serve'
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
    ui,
    'api:sync': apiSync,
    'routes:list': routesList,
    serve,
    'css:types': cssTypes,
    doctor,
    eject,
    upgrade,
    info,
  },
})

export function runMain(argv = process.argv.slice(2)) {
  return cittyRunMain(main, { rawArgs: argv })
}
