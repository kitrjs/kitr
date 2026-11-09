#!/usr/bin/env node
// Prefer the project's own kitr: a global `kitr` (npm i -g @kitr/kitr) hands off to the version
// in the nearest node_modules, so every teammate and CI run the CLI the project pins.
// KITR_NO_LOCAL=1 skips the hand-off.
import { realpathSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = realpathSync(dirname(dirname(fileURLToPath(import.meta.url))))
let cli
if (!process.env.KITR_NO_LOCAL) {
  try {
    const fromProject = createRequire(join(process.cwd(), 'noop.js'))
    const local = realpathSync(dirname(fromProject.resolve('@kitr/kitr/package.json')))
    if (local !== here) {
      const fromLocal = createRequire(join(local, 'package.json'))
      cli = await import(pathToFileURL(fromLocal.resolve('@kitr/cli')).href)
    }
  } catch {
    // No local kitr: use this one.
  }
}
cli ??= await import('@kitr/cli')
cli.runMain()
