import { readFileSync, writeFileSync } from 'node:fs'

/** Replace `from` with `to` in a file; fails loudly when the kit no longer has the text to anchor on. */
export function replaceIn(file, from, to) {
  const src = readFileSync(file, 'utf8')
  if (!src.includes(from)) throw new Error(`prepare: ${file} has no ${JSON.stringify(from)}`)
  writeFileSync(file, src.replace(from, to))
}

/** Put `text` at the top of a file. */
export function prependTo(file, text) {
  writeFileSync(file, `${text}${readFileSync(file, 'utf8')}`)
}

/** The page every kit ships, after which fixture pages are linked the way `kitr make:page` appends them. */
export const aboutPage = ".page('/about', { lazy: () => import('./pages/about') })"
