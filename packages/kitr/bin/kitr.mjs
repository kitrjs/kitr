#!/usr/bin/env node
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

/**
 * `kitr` can be installed globally. Inside a project that has its own `kitr` dependency,
 * this global entry hands over to that copy (like `ng` or `nx`), so the CLI that edits
 * your files is always the one your package.json pins. Set KITR_GLOBAL=1 to skip the handover.
 */
const local = process.env.KITR_GLOBAL ? undefined : findLocalCli()
const { runMain } = local ? await import(pathToFileURL(local).href) : await import('@kitr/cli')

runMain()

function findLocalCli() {
  const require = createRequire(resolve(process.cwd(), 'package.json'))
  let pkgPath
  try {
    pkgPath = require.resolve('kitr/package.json')
  } catch {
    return undefined
  }
  const localRoot = dirname(pkgPath)
  const thisRoot = resolve(dirname(new URL(import.meta.url).pathname), '..')
  if (localRoot === thisRoot) return undefined
  try {
    return createRequire(pkgPath).resolve('@kitr/cli')
  } catch {
    return undefined
  }
}
