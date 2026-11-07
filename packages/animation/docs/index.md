---
title: Animation
description: Animate components and page changes, and respect the visitor's reduced-motion setting.
order: 1
---

# Animation

A toast slides in when Ada sends an invoice, a dialog grows out of the button that opened it, and the project list fills in row by row. Small movements like these tell people what just changed. `kitr/animation` gives every component in the app the same timings, turns movement off for visitors who ask their operating system for less of it, and animates page changes like a native app, with the back button sliding the other way.

It is [Motion](https://motion.dev/docs/react) for React, re-exported unchanged, so `motion.div`, `AnimatePresence`, `useScroll`, layout animations and gestures work exactly as Motion documents them. On top it adds a provider that applies `config/animation.ts` to the whole app, `transitions` and `presets` so durations and easings are shared instead of guessed, `<Reveal>` for content that appears as it scrolls into view, and `pageTransitions()` for animated route changes through the browser's View Transitions API.

It runs in the browser, inside React, on every kitr platform: the web, desktop (Electron and Tauri) and mobile (Capacitor) builds all use the same code. For a spinning 3D product or a scene with a camera, use [3d](/packages/3d) instead; Motion animates DOM and SVG elements.

The examples on this page animate Acme's project dashboard at `app.acme.com`: a list of projects, a dialog to create one, a toast when an invoice is sent and the page for each project.

## Install

```sh
kitr add animation
```

What `kitr add` does:

- Adds `@kitr/animation` and `motion` to `dependencies` and installs them. Pass `--no-install` to skip the install.
- Adds `'@kitr/animation/provider'` to `providers` in `kitrrc.ts`.
- Writes `config/animation.ts`, shown under [Configure](#configure). An existing file is left alone.
- Adds a `## kitr: animation` section to `AGENTS.md`: import from `kitr/animation`, never `framer-motion` or `motion/react` directly; spread `presets` for enter and exit; use `<Reveal>` for scroll-in sections and `pageTransitions()` for page changes; leave reduced motion to the config.

It adds no env variables or scripts and asks no questions. Animation needs React, so `kitr add` adds the [react](/packages/react) package first when the project has none, and refuses in a server-only project. No kit includes it; add it to any kit that has a client.

`kitr remove animation` takes the provider out of `kitrrc.ts`, removes both dependencies and the `AGENTS.md` section, then lists files that still import `kitr/animation`. It leaves `config/animation.ts` in place.

`kitr doctor` flags imports from `motion/react` and `framer-motion` and suggests `kitr/animation`, so every component goes through the same provider.

## Configure

`kitr add` writes this file:

```ts
// config/animation.ts
import { defineConfig, transitions } from 'kitr/animation'

export default defineConfig({
  // 'user' follows the visitor's "reduce motion" setting: movement stops, fades still run.
  reducedMotion: 'user',
  // Every motion element uses this unless it sets its own transition.
  transition: transitions.base,
  // Animations finish instantly under Vitest. Set true for screenshot tests too.
  // skipAnimations: true,
})
```

The provider passes it to Motion's [`MotionConfig`](https://motion.dev/docs/react-motion-config) around the whole app, so every `motion` element below reads it.

| Option | Default | Description |
| --- | --- | --- |
| `reducedMotion` | `'user'` | `'user'` follows the operating system's reduce-motion setting. `'always'` behaves as if every visitor had it on. `'never'` ignores it. When it applies, Motion skips movement (`x`, `y`, `scale`, `rotate` and layout) and keeps opacity and colour changes. |
| `transition` | `transitions.base` | The transition for any `motion` element that sets none: 0.25 seconds on a decelerating curve. |
| `skipAnimations` | `true` under Vitest, `false` elsewhere | Jump every animation straight to its final values. Exit animations still finish, so elements still leave the DOM. |
| `nonce` | none | A Content Security Policy nonce for the `<style>` tags Motion adds for layout and exit animations. |

There are no env variables. A project without the file gets the same defaults.

## Animate your first component

A toast that rises in when Ada sends an invoice and falls away when it closes. Wrap the element in `AnimatePresence` so Motion can run its exit animation before React removes it:

```tsx
// app/components/invoice-sent-toast.tsx
import { AnimatePresence, motion, presets } from 'kitr/animation'

export function InvoiceSentToast({ invoice, onClose }: { invoice: string | null; onClose: () => void }) {
  return (
    <AnimatePresence>
      {invoice && (
        <motion.div key={invoice} role="status" className="toast" {...presets.fadeUp}>
          Invoice {invoice} sent to grace@acme.com
          <button type="button" onClick={onClose}>
            Close
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
```

Render it from the invoices page:

```tsx
<InvoiceSentToast invoice={sent} onClose={() => setSent(null)} />
```

When `invoice` becomes `'INV-1042'`, the toast fades in while rising 12 pixels over 0.25 seconds. When it becomes `null`, it fades out while dropping back, over 0.2 seconds, and only then leaves the DOM. The `key` makes a second invoice replace the first with its own exit and entry instead of changing the text in place.

`presets.fadeUp` is plain data: `{ initial, animate, exit, transition }`. Spreading it is the same as writing the four props by hand, and a prop written after the spread wins.

## Use the shared timings

Every duration in the app comes from `transitions`, so a menu, a dialog and a toast move with the same rhythm and a change of feel is one edit:

```tsx
// app/components/project-card.tsx
import { motion, transitions } from 'kitr/animation'

export function ProjectCard({ name }: { name: string }) {
  return (
    <motion.article whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }} transition={transitions.fast}>
      <h3>{name}</h3>
    </motion.article>
  )
}
```

| Name | Value | Use it for |
| --- | --- | --- |
| `fast` | 0.15s, decelerating | Hover, press and small state changes |
| `base` | 0.25s, decelerating | Things entering the screen. The app default |
| `slow` | 0.4s, decelerating | Sheets, drawers and large panels |
| `exit` | 0.2s, accelerating | Things leaving the screen |
| `snappy` | spring, no overshoot | Dragging, reordering, layout changes |
| `bouncy` | spring, slight overshoot | Likes, badges and other playful confirmations |

Durations are in seconds, as Motion expects. The two springs use Motion's `visualDuration`, so they feel as long as their number says whatever the distance.

Don't write `transition={{ duration: 0.3 }}` in a component. Pick the closest name, or add one to your own module that spreads a kitr transition, so the timings stay in one place.

## Enter and exit with presets

`presets` covers the movements most interfaces need. Each one is a set of props to spread on a `motion` element:

| Preset | Enters as | Use it for |
| --- | --- | --- |
| `fade` | Opacity 0 to 1 | Anything; nothing moves, so it is safe under reduced motion |
| `fadeUp` | Rises 12px while fading in | List items, cards, bottom toasts |
| `fadeDown` | Drops 12px while fading in | Menus, top toasts |
| `scale` | Grows from 95% while fading in | Dialogs, popovers, image previews |
| `slideLeft` | Slides 24px from the right | Drawers and detail panels on the right |
| `slideRight` | Slides 24px from the left | Navigation drawers |
| `collapse` | Opens from zero height to its content's height | Accordions, expanding rows |

Each exits the way it came in, with `transitions.exit`. A dialog that grows in from the centre:

```tsx
// app/components/new-project-dialog.tsx
import { AnimatePresence, motion, presets } from 'kitr/animation'

export function NewProjectDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div key="backdrop" className="backdrop" {...presets.fade} onClick={onClose}>
          <motion.div
            role="dialog"
            aria-label="New project"
            className="dialog"
            {...presets.scale}
            onClick={(event) => event.stopPropagation()}
          >
            <h2>New project</h2>
            {/* ... */}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
```

To change one part of a preset, override it after the spread. A toast that waits a moment before it appears:

```tsx
<motion.div {...presets.fadeUp} transition={{ ...presets.fadeUp.transition, delay: 0.3 }} />
```

## Expand and collapse a section

`presets.collapse` animates `height` to `'auto'`, which CSS transitions cannot do. The invoice lines of a project open under its row:

```tsx
// app/components/project-row.tsx
import { AnimatePresence, motion, presets } from 'kitr/animation'
import { useState } from 'react'

export function ProjectRow({ name, invoices }: { name: string; invoices: string[] }) {
  const [open, setOpen] = useState(false)
  return (
    <li>
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)}>
        {name}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.ul key="invoices" {...presets.collapse}>
            {invoices.map((invoice) => (
              <li key={invoice}>{invoice}</li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </li>
  )
}
```

`initial={false}` stops rows that start open from animating on the first render. Keep padding and borders on an element inside the collapsing one; padding on the animated element itself shows at zero height.

## Reveal content as it scrolls into view

`<Reveal>` animates its content the first time it scrolls into view. Acme's marketing page at `acme.com` brings each section in as the reader reaches it:

```tsx
// app/routes/index.tsx
import { Reveal } from 'kitr/animation'

export function Features() {
  return (
    <Reveal as="section" preset="fadeUp">
      <h2>Invoices that send themselves</h2>
      <p>Acme bills your clients on the first of every month.</p>
    </Reveal>
  )
}
```

To bring a list in one item after another, set `stagger` to the seconds between items and wrap each item in `<RevealItem>`:

```tsx
// app/components/project-grid.tsx
import { Reveal, RevealItem } from 'kitr/animation'

export function ProjectGrid({ projects }: { projects: Array<{ id: string; name: string }> }) {
  return (
    <Reveal as="ul" stagger={0.05} className="grid">
      {projects.map((project) => (
        <RevealItem as="li" key={project.id}>
          {project.name}
        </RevealItem>
      ))}
    </Reveal>
  )
}
```

With `stagger`, the container stays still and each item plays the preset in turn, 0.05 seconds apart. A `<RevealItem>` outside a staggered `<Reveal>` renders its element and does not animate.

| Prop | Default | Description |
| --- | --- | --- |
| `as` | `'div'` | The element to render: `div`, `section`, `article`, `aside`, `header`, `footer`, `main`, `figure`, `ul`, `ol`, `li`, `p` or `span` |
| `preset` | `'fadeUp'` | Any name from `presets` |
| `once` | `true` | Animate the first time only; `false` hides it again when it scrolls out |
| `amount` | `0.2` | How much must be visible: a fraction, `'some'` or `'all'` |
| `delay` | `0` | Seconds to wait once it is in view; with `stagger`, the wait before the first item |
| `stagger` | none | Seconds between `<RevealItem>` children |

`<Reveal>` uses Motion's `whileInView`, which runs on one shared `IntersectionObserver`, so a page with fifty revealed sections costs nothing while they are off screen. Every other `motion.div` prop, such as `className` or `onAnimationComplete`, passes through.

Content inside `<Reveal>` starts hidden in the server-rendered HTML and appears once the page's JavaScript runs. Don't wrap the first screen of a page, its main heading or anything a search engine must see without JavaScript in `<Reveal>`.

## Animate page changes

`pageTransitions()` animates route changes with the browser's [View Transitions API](https://developer.mozilla.org/docs/Web/API/View_Transition_API): the old page slides out as the new one slides in, and the back button slides the other way. Pass it to the router as `defaultViewTransition` and import the stylesheet once:

```tsx
// app/router.tsx
import { pageTransitions } from 'kitr/animation'
import 'kitr/animation/page-transitions.css'
import { createKitrRouter } from 'kitr/router'
import { app } from './app'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  return createKitrRouter({
    routeTree,
    app,
    defaultViewTransition: pageTransitions(),
  })
}
```

On every navigation the router calls `document.startViewTransition` with two types: `kitr-slide` (or `kitr-fade`) and `kitr-forward` or `kitr-back`. The direction comes from the router's history index, so Ada opening `/projects/42` from the list slides forward, and her back button, a swipe back on a phone or `history.back()` slides back. The stylesheet animates each type.

| Option | Default | Description |
| --- | --- | --- |
| `style` | `'slide'` | `'slide'` moves pages sideways like a native app; `'fade'` cross-fades them |
| `reducedMotion` | `'user'` | `'user'` changes pages instantly for visitors who ask for less motion. `'always'` turns page animations off; `'never'` keeps them |
| `onSearchChange` | `false` | Also animate when only the search or hash changes, such as the next page of a table |

Browsers without view transitions change pages instantly, as before. Chromium-based browsers, Electron, Android WebView and Safari 18 support them, which covers the desktop and mobile builds. Browsers with view transitions but without transition types get a short cross-fade.

To animate a single link differently, pass `viewTransition` to it. A link that should never animate, such as switching tabs inside a page, takes `viewTransition={false}`.

## Keep the header still during page changes

By default the whole page slides. To keep the app's header and navigation in place, give them their own `view-transition-name`; the browser then animates them separately, and with no animation for that name they simply stay:

```tsx
// app/routes/__root.tsx
import { Outlet } from 'kitr/router'

export function RootLayout() {
  return (
    <>
      <header style={{ viewTransitionName: 'app-header' }}>Acme</header>
      <nav style={{ viewTransitionName: 'app-nav' }}>{/* ... */}</nav>
      <main>
        <Outlet />
      </main>
    </>
  )
}
```

Each `view-transition-name` must be unique on the page at any moment. Two elements with the same name abort the transition and the page changes without animating.

## Morph a card into its page

The same mechanism animates one element between two pages. Give the project's cover image in the list and on the project page the same name, and the browser moves and resizes it from one to the other:

```tsx
// app/components/project-cover.tsx
export function ProjectCover({ id, src }: { id: string; src: string }) {
  return <img src={src} alt="" style={{ viewTransitionName: `project-cover-${id}` }} />
}
```

Use `<ProjectCover>` in both the list and the project page. Only one element per name may be on screen, which is why the id is part of it.

## Animate layout changes

When the project list is re-sorted, filtered or an item is removed, `layout` animates every item to its new position instead of jumping. This is Motion's own feature, imported from `kitr/animation`:

```tsx
// app/components/sorted-projects.tsx
import { AnimatePresence, motion, presets, transitions } from 'kitr/animation'

export function SortedProjects({ projects }: { projects: Array<{ id: string; name: string }> }) {
  return (
    <ul>
      <AnimatePresence initial={false}>
        {projects.map((project) => (
          <motion.li key={project.id} layout transition={transitions.snappy} {...presets.fade}>
            {project.name}
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  )
}
```

Put `layout` after the spread when you also pass a preset, and use `transitions.snappy` for layout so items settle without bouncing. Under reduced motion, Motion skips layout movement and the list updates in place.

## Respect reduced motion in your own code

The provider handles `motion` elements. For anything else that moves, such as a video that autoplays or a parallax effect you calculate yourself, read the same setting with Motion's `useReducedMotionConfig()`, which follows `config/animation.ts` rather than only the operating system:

```tsx
// app/components/hero-video.tsx
import { useReducedMotionConfig } from 'kitr/animation'

export function HeroVideo() {
  const reduce = useReducedMotionConfig()
  return <video src="/videos/acme-tour.mp4" autoPlay={!reduce} muted loop playsInline controls={reduce ?? false} />
}
```

`useReducedMotionConfig()` returns `true` when movement should stop: with `reducedMotion: 'user'` when the visitor has the setting on, with `'always'` for everyone and with `'never'` for nobody. Outside the provider, `prefersReducedMotion()` reads the operating system setting directly.

## Testing

Under Vitest the provider sets `skipAnimations`, so every animation jumps to its end and every exit removes its element straight away. Tests assert the final state without timers. Render inside the app with `createTestApp` and `renderWithKitr` from [testing](/packages/testing):

```tsx
// app/components/invoice-sent-toast.test.tsx
import { animationProvider } from 'kitr/animation/provider'
import { createTestApp } from 'kitr/testing'
import { renderWithKitr } from 'kitr/testing/react'
import { screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { InvoiceSentToast } from './invoice-sent-toast'

describe('invoice sent toast', () => {
  it('appears fully visible and leaves when closed', async () => {
    const app = await createTestApp({ providers: [animationProvider] })
    const onClose = vi.fn()
    const { rerender } = renderWithKitr(<InvoiceSentToast invoice="INV-1042" onClose={onClose} />, { app })

    const toast = screen.getByRole('status')
    expect(toast.textContent).toContain('INV-1042')
    await waitFor(() => expect(toast.style.opacity).toBe('1'))

    rerender(<InvoiceSentToast invoice={null} onClose={onClose} />)
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull())
  })
})
```

`<Reveal>` needs an `IntersectionObserver`. happy-dom has none that ever fires, so stub one that reports every element as visible:

```ts
// tests/setup.ts
import { vi } from 'vitest'

vi.stubGlobal(
  'IntersectionObserver',
  class {
    constructor(private callback: IntersectionObserverCallback) {}
    observe(target: Element) {
      this.callback([{ target, isIntersecting: true, intersectionRatio: 1 } as IntersectionObserverEntry], this as never)
    }
    unobserve() {}
    disconnect() {}
  },
)
```

For page transitions, test the types your router will ask for by calling the function with two history indexes; the browser does the rest:

```ts
// app/router.test.ts
import { pageTransitions } from 'kitr/animation'
import { expect, it } from 'vitest'

it('slides back on the back button', () => {
  const { types } = pageTransitions()
  const at = (index: number) => ({ state: { __TSR_index: index } })
  expect(types({ fromLocation: at(4), toLocation: at(3), pathChanged: true, hrefChanged: true })).toEqual([
    'kitr-slide',
    'kitr-back',
  ])
})
```

In Playwright, pass `reducedMotion: 'reduce'` to the browser context to check the reduced-motion path, and set `skipAnimations: true` in a test build's `config/animation.ts` for stable screenshots.

## Next steps

- [API reference](/packages/animation/api): every export kitr adds to `kitr/animation`.
- [Motion for React](https://motion.dev/docs/react): gestures, scroll-linked animation, layout animation and everything else re-exported from `kitr/animation`.
- [Router](/packages/router): `createKitrRouter` and the `viewTransition` option on links.
- [3D](/packages/3d): scenes and models, with the same reduced-motion rules.
- [Testing](/packages/testing): `createTestApp` and `renderWithKitr`.
