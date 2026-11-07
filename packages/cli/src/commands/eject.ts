import { defineCommand } from 'citty'
import { createContext } from '../context'
import { stubs } from '../stubs'

/**
 * Eject is deliberately small. kitr ships no runtime magic to eject: `kitr/*` entry points
 * re-export upstream libraries unchanged, so leaving kitr is "replace imports".
 * What you can eject are the generator stubs (to customise `make:*`) and the providers
 * (to wire the libraries by hand).
 */
export const eject = defineCommand({
  meta: {
    name: 'eject',
    description:
      'Copy kitr stubs into stubs/ (customise make:*), or print the import rewrites that leave kitr entirely.',
  },
  args: {
    what: { type: 'positional', description: 'stub <name> | stubs | all', required: true },
    name: { type: 'positional', required: false },
    force: { type: 'boolean', default: false },
  },
  run({ args }) {
    const ctx = createContext()
    const dir = ctx.readRc().directories.stubs ?? 'stubs'
    const writeStub = (name: string) => {
      const fn = stubs[name]
      if (!fn)
        return ctx.log.error(`Unknown stub "${name}". Known: ${Object.keys(stubs).join(', ')}`)
      const body = `/** Ejected kitr stub for \`kitr make:${name}\`. Receives the template vars and returns the file source. */\nexport default ${fn.toString()}\n`
      ctx.write(`${dir}/${name}.ts`, body, { overwrite: args.force })
    }
    if (args.what === 'stub') {
      if (!args.name) return ctx.log.error('Usage: kitr eject stub <name>')
      writeStub(args.name)
    } else if (args.what === 'stubs') {
      for (const name of Object.keys(stubs)) writeStub(name)
    } else if (args.what === 'all') {
      for (const name of Object.keys(stubs)) writeStub(name)
      ctx.log.title('Leaving kitr altogether')
      ctx.log.plain(
        'kitr adds nothing at runtime that you cannot replace with the upstream library. Rewrite imports:',
      )
      for (const [from, to] of Object.entries(REWRITES))
        ctx.log.plain(`  ${from.padEnd(18)} → ${to}`)
      ctx.log.plain(
        'Then inline the providers from kitrrc.ts into your own bootstrap and delete kitrrc.ts, config/, and the `kitr` dependency.',
      )
    } else ctx.log.error(`Unknown target "${args.what}". Use: stub <name> | stubs | all`)
    ctx.log.success(`Stubs in ${dir}/ override the built-in ones for make:*`)
  },
})

export const REWRITES: Record<string, string> = {
  'kitr/router': '@tanstack/react-router (+ your own context/guards)',
  'kitr/query': '@tanstack/react-query (+ queryOptions helpers)',
  'kitr/actions': '@tanstack/react-start (createServerFn)',
  'kitr/forms': 'react-hook-form + @hookform/resolvers',
  'kitr/table': '@tanstack/react-table',
  'kitr/state': 'zustand',
  'kitr/http': 'ky',
  'kitr/server': 'h3 + srvx',
  'kitr/realtime': 'partysocket + crossws (or socket.io, or EventSource)',
  'kitr/tailwind': 'clsx + tailwind-merge',
  'kitr/theme': 'a theme context + CSS variables',
  'kitr/seo': 'meta tags in head()',
  'kitr/i18n': 'react-i18next',
  'kitr/mocks': 'msw',
  'kitr/analytics': 'gtag / plausible / posthog-js called directly',
  'kitr/monitoring': '@sentry/react (or @sentry/node) called directly',
  'kitr/web': 'vite + @tanstack/react-start + vite-plugin-pwa',
  'kitr/desktop': 'electron ipcMain/ipcRenderer + contextBridge, or @tauri-apps/api',
  'kitr/mobile': '@capacitor/core + @capacitor/app + @capacitor/preferences',
  'kitr/platform': 'navigator.onLine, visibilitychange, the shell SDKs',
  'kitr/storage': 'localStorage / document.cookie (+ a cookie parser)',
  'kitr/devtools': 'nothing; development only',
}
