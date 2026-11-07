import type { MarkName } from '#app/components/creator-marks'

/** A project a kitr package is built on: its name, its site and, when there is one, its mark. */
export type Upstream = { name: string; url?: string; mark?: MarkName }

// Keys are the strings packages list under `kitr.builtOn` in package.json.
const upstreams: Record<string, Upstream> = {
  '@tanstack/react-query': {
    name: 'TanStack Query',
    url: 'https://tanstack.com/query',
    mark: 'tanstack',
  },
  'TanStack Query': { name: 'TanStack Query', url: 'https://tanstack.com/query', mark: 'tanstack' },
  '@tanstack/react-router': {
    name: 'TanStack Router',
    url: 'https://tanstack.com/router',
    mark: 'tanstack',
  },
  '@tanstack/react-table': {
    name: 'TanStack Table',
    url: 'https://tanstack.com/table',
    mark: 'tanstack',
  },
  '@tanstack/react-start': {
    name: 'TanStack Start',
    url: 'https://tanstack.com/start',
    mark: 'tanstack',
  },
  'TanStack Start': { name: 'TanStack Start', url: 'https://tanstack.com/start', mark: 'tanstack' },
  h3: { name: 'H3', url: 'https://h3.dev', mark: 'h3' },
  crossws: { name: 'crossws', url: 'https://crossws.h3.dev', mark: 'unjs' },
  partysocket: {
    name: 'PartySocket',
    url: 'https://github.com/partykit/partykit/tree/main/packages/partysocket',
  },
  'socket.io': { name: 'Socket.IO', url: 'https://socket.io', mark: 'socketdotio' },
  'Tauri 2': { name: 'Tauri', url: 'https://tauri.app', mark: 'tauri' },
  'electron-vite': { name: 'electron-vite', url: 'https://electron-vite.org', mark: 'electron' },
  Capacitor: { name: 'Capacitor', url: 'https://capacitorjs.com', mark: 'capacitor' },
  'Google Analytics': {
    name: 'Google Analytics',
    url: 'https://marketingplatform.google.com/about/analytics/',
    mark: 'googleanalytics',
  },
  Plausible: { name: 'Plausible', url: 'https://plausible.io', mark: 'plausibleanalytics' },
  PostHog: { name: 'PostHog', url: 'https://posthog.com', mark: 'posthog' },
  OpenFeature: { name: 'OpenFeature', url: 'https://openfeature.dev' },
  'react-hook-form': {
    name: 'React Hook Form',
    url: 'https://react-hook-form.com',
    mark: 'reacthookform',
  },
  ky: { name: 'Ky', url: 'https://github.com/sindresorhus/ky' },
  'react-i18next': { name: 'react-i18next', url: 'https://react.i18next.com', mark: 'i18next' },
  'React Email': { name: 'React Email', url: 'https://react.email' },
  msw: { name: 'Mock Service Worker', url: 'https://mswjs.io', mark: 'mockserviceworker' },
  Sentry: { name: 'Sentry', url: 'https://sentry.io', mark: 'sentry' },
  react: { name: 'React', url: 'https://react.dev', mark: 'react' },
  zustand: { name: 'Zustand', url: 'https://zustand.docs.pmnd.rs' },
  tailwindcss: { name: 'Tailwind CSS', url: 'https://tailwindcss.com', mark: 'tailwindcss' },
  vitest: { name: 'Vitest', url: 'https://vitest.dev', mark: 'vitest' },
  '@testing-library/react': {
    name: 'Testing Library',
    url: 'https://testing-library.com',
    mark: 'testinglibrary',
  },
  'shadcn/ui': { name: 'shadcn/ui', url: 'https://ui.shadcn.com', mark: 'shadcnui' },
  sonner: { name: 'Sonner', url: 'https://sonner.emilkowal.ski' },
  Vite: { name: 'Vite', url: 'https://vite.dev', mark: 'vite' },
  'vite-plugin-pwa': { name: 'Vite PWA', url: 'https://vite-pwa-org.netlify.app', mark: 'pwa' },
}

export const upstream = (key: string): Upstream => upstreams[key] ?? { name: key }

const kitr: Upstream = { name: 'kitr', mark: 'kitr' }

/**
 * Who to credit on a package tile: the projects it is built on (one entry per mark), or kitr
 * itself when the package is original. A package with three or more upstreams is kitr's own
 * layer over interchangeable adapters, so it is credited to kitr too.
 */
export function creditsFor(builtOn: string[] | undefined): Upstream[] {
  if (!builtOn?.length || builtOn.length > 2) return [kitr]
  const seen = new Set<string>()
  const out: Upstream[] = []
  for (const key of builtOn) {
    const u = upstream(key)
    const id = u.mark ?? u.name
    if (seen.has(id)) continue
    seen.add(id)
    out.push(u)
  }
  return out
}
