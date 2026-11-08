---
title: Ship one app to the web, phones and desktops
description: One kitr project that builds a web app, an iPhone and Android app and a desktop app from one route table, with per-platform pages, layouts and behaviour where they differ.
packages: platform, router, mobile, desktop, web
platforms: web, mobile, desktop
time: 35 min
preview: true
---

# Ship one app to the web, phones and desktops

[Build a phone app](/guides/mobile-app) and [Build a desktop app](/guides/desktop-app) made two projects that share four files by copy and paste. That works until the invoice type changes and one copy doesn't. Acme Billing is one product, so this guide makes it one project: a web platform for `app.acme.com`, a mobile platform for the stores and a desktop platform for the back office, all built from the same `app/` folder and the same route table.

Most of the app should not know where it runs. Pages, queries, forms and storage are written once. kitr gives you a small set of tools for the places that do differ, and each works at a different time:

| Need | Tool | Decided |
| --- | --- | --- |
| A page that exists on some platforms only | `platforms` on the page | when the route tree is built |
| A different implementation per platform | `forPlatform()` from `@kitr/platform` | once, from the build's platform |
| A different implementation per operating system | `perPlatform()` from `@kitr/platform` | at run time |
| A piece of UI on some platforms or screen sizes | `<Only>`, `<Except>`, `useFormFactor()` | at render |
| Code that must not be in a bundle at all | `import.meta.env.KITR_PLATFORM` | by the bundler |

> **Preview**
> The mobile and desktop platforms are previews. `@kitr/mobile`, `@kitr/desktop` and `@kitr/platform` are not on npm yet. The commands below need `--preview` and a kitr checkout. The API may still change before the release.

## Before you start

Work through [Build a phone app](/guides/mobile-app) first. This guide starts from its project, `acme-billing`, which already has two platforms, `site` and `phone`, and adds the desktop. You need the same toolchains as the two platform guides: Xcode or Android Studio for the phone, and nothing extra for Electron. The invoices API from [Build an API server without React](/guides/api-server) runs on port 3001.

## Add the desktop platform

A platform is a named entry in `kitrrc.ts`. Add a desktop platform called `desk` to the phone project:

```sh
cd examples/acme-billing
kitr add desktop desk --preview --title "Acme Billing" --appId com.acme.billing
```

```ts
// kitrrc.ts
platforms: {
  site: web({ mode: 'spa', pwa: true }),
  phone: mobile({ appId: 'com.acme.billing', appName: 'Acme Billing', scheme: 'acme' }),
  desk: desktop({ title: 'Acme Billing', appId: 'com.acme.billing' }),
},
```

`kitr add` installed Electron, registered `@kitr/desktop/provider` next to the mobile one, and wrote `platforms/desk/` and `app/ipc.ts`. Each provider registers its native drivers only inside its own shell, so the phone bundle runs the Capacitor drivers, the desktop window runs the Electron ones, and the browser runs neither. Move the export command and the menu from the desktop guide into `platforms/desk/ipc.ts` and `platforms/desk/main.ts`; nothing else from that project is needed, because the data layer is already here.

Then type the platform names:

```sh
kitr types
```

`kitr types` writes `.kitr/platforms.d.ts` from `kitrrc.ts`. From now on `'site' | 'phone' | 'desk'` is a union type for platform names, so `platforms: ['sitee']` on a page or `<Only platform="phon">` is a compile error that suggests the right name:

```ts
// .kitr/platforms.d.ts (generated)
declare global {
  interface ImportMetaEnv {
    readonly KITR_PLATFORM: 'desk' | 'phone' | 'site'
    readonly KITR_PLATFORM_TYPE: 'desktop' | 'mobile' | 'web'
  }
}
```

## Run all three

`kitr dev` with no name starts every platform side by side, each on its own port:

```sh
kitr dev
# site:  http://localhost:3000
# phone: http://192.168.1.20:3100, the ios app loads it live
# desk:  http://localhost:3200, the Electron window loads it
```

Name one or two to start only those: `kitr dev site desk`. Each build sets `KITR_PLATFORM` to its name, which is how the rest of this guide tells them apart. A change to a page shows up in the browser, the simulator and the window at once.

## Keep a page to some platforms

The web app should have a download page linking to the stores and installers. In the phone and desktop apps that page makes no sense. `platforms` on the page lists the builds that ship it:

```ts
// app/routes.ts
export const routes = defineRoutes([router], (r) =>
  r
    .root({ head, component: RootDocument })
    .page('/download', { platforms: ['site'], lazy: () => import('./pages/download') })
    .page('/sign-in', { /* ...as in the phone guide */ })
    .layout('_tabs', { beforeLoad: requireAuth(), lazy: () => import('./pages/tabs') }, (tabs) =>
      tabs, // ...the invoices and account pages, on every platform
    ),
)
```

The other builds leave `/download` out of their route tree, so in the phone app it is a 404 like any unknown path. Its chunk is still in their bundles, unused; the section on keeping code out of a bundle covers code that must not ship at all. `<Link to="/download">` still type-checks everywhere, because the type of the table is the same on every platform; render such a link only where the page exists, as the next sections show. A layout whose pages are all left out is left out too.

When the guard should depend on more than the build, such as the operating system or whether the app runs in a native shell, use `onlyPlatform()` from `@kitr/router` as the page's `beforeLoad` instead. Its keys can be platform names, types, operating systems or `native`, and it can redirect instead of rendering not-found: `beforeLoad: onlyPlatform(['site', 'desk'], { to: '/' })` keeps a page off phones and sends them home.

## Pick an implementation per platform

Sharing an invoice opens the share sheet on a phone and copies the link everywhere else. `forPlatform()` picks the implementation once, from the platform the bundle was built for, so components call `shareInvoice()` without asking where they are:

```ts
// app/features/invoices/share-invoice.ts
import { forPlatform } from '@kitr/platform'
import type { Invoice } from './queries'

const linkTo = (invoice: Invoice) => `https://app.acme.com/invoices/${invoice.id}`

/** Picked once, from the build: the phone opens the share sheet, every other build copies the link. */
export const shareInvoice = forPlatform<(invoice: Invoice) => Promise<'shared' | 'copied'>>({
  phone: async (invoice) => {
    const { Share } = await import('@capacitor/share')
    await Share.share({ title: `Invoice ${invoice.id}`, url: linkTo(invoice) })
    return 'shared'
  },
  default: async (invoice) => {
    await navigator.clipboard.writeText(linkTo(invoice))
    return 'copied'
  },
})
```

`forPlatform()` looks up the build's platform name first, then its type, then `default`. Import a native plugin inside its branch, as above, so the web and desktop builds never evaluate it. Because it needs no app instance, `forPlatform()` also works at module scope and in config files: [Auth](/packages/auth) uses it to pick a cookie session for the web build and a bearer token for the shells.

When the answer depends on the device rather than the build, such as iOS against Android inside the same phone build, use `perPlatform()` at run time with the platform service:

```ts
// app/features/invoices/payment-link.ts
import { perPlatform } from '@kitr/platform'
import { app } from '#app/app'

export function paymentHint() {
  return perPlatform(app.container.use('platform'), {
    ios: () => 'Pay with Apple Pay from the link',
    android: () => 'Pay with Google Pay from the link',
    default: () => 'Pay by card from the link',
  })
}
```

The most specific key wins: the platform name, then the operating system, then the type, then `native`, then `default`.

## Show pieces on some platforms

`<Only>` renders its children where its props match. The Account page links to the download page on the web build only, and the iPhone build gets a hint the others don't:

```tsx
// app/components/account-extras.tsx
import { Only } from '@kitr/platform/react'
import { Link } from '@kitr/router'

export function AccountExtras() {
  return (
    <>
      <Only platform="site">
        <Link to="/download">Get the phone and desktop apps</Link>
      </Only>
      <Only native os="ios">
        <p>Turn on Face ID in Settings to skip the password.</p>
      </Only>
    </>
  )
}
```

Props are platform names, types (`web`, `mobile`, `desktop`), operating systems, `native`, and the form-factor axes `width`, `input` and `orientation`; several props must all match. `<Except>` is the inverse, and `usePlatformMatch()` returns the same answer for code that isn't JSX.

## Fit the layout to the window

A phone wants a tab bar at the bottom. A desktop window, or a browser on a laptop, has room for a sidebar. That is a question of screen size, not platform: an iPad runs the phone build, and a narrow desktop window should behave like a phone. `useFormFactor()` reads the width, the input and the orientation, and re-renders when they change. The tabs layout from the phone guide becomes:

```tsx
// app/pages/tabs.tsx
import { Only, useFormFactor } from '@kitr/platform/react'
import { StackTabs } from '@kitr/router/stack'
import { DeepLinks } from '#app/components/deep-links'
import { MenuCommands } from '#app/components/menu-commands'

const tabs = [
  { id: 'invoices', to: '/', label: 'Invoices', match: ['/', '/invoices'] },
  { id: 'account', to: '/account', label: 'Account' },
]

export default function TabsLayout() {
  const { width } = useFormFactor()
  const sidebar = width !== 'compact'

  return (
    <div className={sidebar ? 'grid h-dvh grid-cols-[14rem_1fr]' : 'h-dvh'}>
      <Only type="mobile">
        <DeepLinks />
      </Only>
      <Only platform="desk">
        <MenuCommands />
      </Only>
      <StackTabs tabs={tabs} placement={sidebar ? 'top' : 'bottom'} className={sidebar ? 'col-start-2' : undefined}>
        {({ tabs, current, select }) => (
          <nav
            aria-label="Tabs"
            className={
              sidebar
                ? 'fixed inset-y-0 left-0 flex w-56 flex-col gap-1 border-r border-border p-3'
                : 'flex border-t border-border bg-background pb-[env(safe-area-inset-bottom)]'
            }
          >
            {tabs.map((tab) => (
              <button
                type="button"
                key={tab.id}
                aria-current={current?.id === tab.id ? 'page' : undefined}
                className={sidebar ? 'rounded-md px-3 py-2 text-left aria-[current=page]:bg-muted' : 'flex-1 py-3 text-sm aria-[current=page]:font-semibold'}
                onClick={() => select(tab)}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        )}
      </StackTabs>
    </div>
  )
}
```

`width` is `compact` below 768 pixels, `medium` up to 1024 and `expanded` above. Before the window is measured, on the server and in the first render, the hook guesses from the platform: desktop shells start `expanded`, everything else `compact`, so the first paint matches what the server sent. The deep-link handler only matters inside the phone shell and the menu handler only in the desktop window, so each is wrapped in `<Only>`.

## Keep code out of a bundle

`forPlatform()` and `<Only>` choose from values that are fixed per build, but the code for every branch is still in every bundle. For code that must not ship at all, such as a receipt-printer tool that only the back office uses, compare `import.meta.env.KITR_PLATFORM` directly. The kitr Vite plugin replaces it with the build's platform name, so the bundler folds the comparison to a constant and drops the branch, with its imports, where it is false:

```tsx
// app/components/desk-only-tools.tsx
import { lazy, Suspense } from 'react'

// A constant in each build: the site and phone bundles fold this to null and drop the import.
const ReceiptPrinter = import.meta.env.KITR_PLATFORM === 'desk' ? lazy(() => import('./receipt-printer')) : null

export function DeskOnlyTools() {
  if (!ReceiptPrinter) return null
  return (
    <Suspense fallback={null}>
      <ReceiptPrinter />
    </Suspense>
  )
}
```

After `kitr build`, `dist/desk/client` has a `receipt-printer` chunk and `dist/site/client` has none. Keep the import inside the condition: a `lazy(() => import(...))` at the top of the file is a chunk in every build, even when nothing renders it. The same goes for pages: `platforms` takes a page out of a build's route tree, but its chunk is still emitted, so put code that must not ship behind `KITR_PLATFORM`.

## Render public pages on the server

The web platform is a single-page app here, which suits a signed-in tool. If the web build also carries public pages that search engines should read, switch it to `mode: 'ssr'` and decide per page. `ssrRoute()` from [SEO](/packages/seo) takes a table that resolves by platform name, then type, then `default`, so the web build renders the download page on the server while the shells, which have no server, render it in the window:

```ts
// app/routes.ts
import { ssrRoute } from '@kitr/seo'

r.page('/download', {
  platforms: ['site'],
  ...ssrRoute({ site: true, default: false }),
  lazy: () => import('./pages/download'),
})
```

Keep `ssrRoute(false)` on the signed-in layout in that case: its pages read the token from storage, which only exists in the browser.

## Test the route table per platform

`createKitrRouter()` takes the platform to build the tree for, so one test checks which pages each app ships:

```ts
// test/platforms.test.ts
import { createKitrRouter, createMemoryHistory } from '@kitr/router'
import { createTestApp } from '@kitr/testing'
import { describe, expect, it } from 'vitest'
import { routes } from '#app/routes'

async function pathsFor(platform: 'site' | 'phone' | 'desk') {
  const app = await createTestApp({})
  const router = createKitrRouter({ routes, app, platform, history: createMemoryHistory() })
  return Object.keys(router.routesByPath)
}

describe('one route table, three apps', () => {
  it('ships the download page on the web only', async () => {
    expect(await pathsFor('site')).toContain('/download')
    expect(await pathsFor('phone')).not.toContain('/download')
    expect(await pathsFor('desk')).not.toContain('/download')
  })

  it('ships the invoices everywhere', async () => {
    for (const platform of ['site', 'phone', 'desk'] as const)
      expect(await pathsFor(platform)).toContain('/invoices/$id')
  })
})
```

The tests from the two platform guides keep working unchanged: the fake `Capacitor` global and the fake Electron objects each select one shell's drivers.

## Build everything

`kitr build` with no name builds every platform, one after another, and stops at the first failure:

```sh
VITE_API_URL=https://api.acme.com/api kitr build
```

The web app lands in `dist/site/client`, the phone bundle in `dist/phone/client`, synced into the Xcode and Android Studio projects, and the desktop installers in `dist/desk/release`. Each has its own folder, so the web deploy, the store uploads and the installer release are separate jobs in CI. `kitr build site` builds one, and `kitr doctor` checks all three toolchains in one run.

## Split into apps when they drift

One project is right while the three apps are the same product. When they grow apart, such as a marketing site with its own release schedule or a phone app maintained by another team, split them into separate kitr projects in one repository, as [Keep several apps in one repository](/guides/monorepo) shows, and share the data layer as a workspace package. A `kitr.workspace.ts` at the root lets the CLI run across them:

```ts
// kitr.workspace.ts
import { defineWorkspace } from 'kitr'

export default defineWorkspace({
  apps: { web: 'apps/web', phone: 'apps/phone', desk: 'apps/desk' },
})
```

## Next steps

- [Platform](/packages/platform): every hook, `perPlatform()`, `forPlatform()` and the form factor in detail.
- [Router](/packages/router): page `platforms`, `onlyPlatform()`, stacks and tabs.
- [Platforms](/docs/platforms): every platform type and the commands they share.
- [Keep several apps in one repository](/guides/monorepo): when one project becomes several.
