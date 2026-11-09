---
title: Animation
description: Animate components and page changes, and respect the visitor's reduced-motion setting.
order: 1
---

# Animation

Small movements, like a toast sliding in or a dialog growing out of its button, tell people what just changed. `@kitr/animation` gives every component the same timings, turns movement off for visitors who ask for less of it, and animates page changes like a native app.

> [!SUMMARY]
> Animate components and page changes, and respect the visitor's reduced-motion setting. Add it with `kitr add animation`; the overview is at [/packages/animation](/packages/animation).

It is [Motion](https://motion.dev/docs/react) for React, re-exported unchanged. kitr adds:

- A provider that applies `config/animation.ts` to the whole app.
- `transitions` and `presets`, so durations and easings are shared.
- `<Reveal>` for content that appears as it scrolls into view.
- `pageTransitions()` for animated route changes through the View Transitions API.

Motion animates DOM and SVG elements. For 3D scenes, use [3d](/packages/3d).

The examples animate Acme's project dashboard at `app.acme.com`.

## Install

```sh
kitr add animation
```

<details>
<summary>Everything kitr add changes</summary>

What `kitr add` does:

- Adds `@kitr/animation` and `motion` to `dependencies` and installs them. Pass `--no-install` to skip the install.
- Adds `'@kitr/animation/provider'` to `providers` in `kitrrc.ts`.
- Writes `config/animation.ts`, shown under [Configure](#configure). An existing file is left alone.
- Adds a `## kitr: animation` section to `AGENTS.md`: import from `@kitr/animation`, never `framer-motion` or `motion/react` directly; spread `presets` for enter and exit; use `<Reveal>` for scroll-in sections and `pageTransitions()` for page changes; leave reduced motion to the config.

It asks no questions. It adds the [react](/packages/react) package first when the project has none, and refuses in a server-only project.

`kitr remove animation` takes the provider out of `kitrrc.ts`, removes both dependencies and the `AGENTS.md` section, then lists files that still import `@kitr/animation`. It leaves `config/animation.ts` in place.

</details>

`kitr doctor` flags imports from `motion/react` and `framer-motion`, so every component goes through the same provider.

## Configure

`kitr add` writes this file:

```ts
// config/animation.ts
import { defineConfig, transitions } from '@kitr/animation'

export default defineConfig({
  // 'user' follows the visitor's "reduce motion" setting: movement stops, fades still run.
  reducedMotion: 'user',
  // Every motion element uses this unless it sets its own transition.
  transition: transitions.base,
  // Animations finish instantly under Vitest. Set true for screenshot tests too.
  // skipAnimations: true,
})
```

The provider passes it to Motion's [`MotionConfig`](https://motion.dev/docs/react-motion-config) around the app.

| Option | Default | Description |
| --- | --- | --- |
| `reducedMotion` | `'user'` | `'user'` follows the system's reduce-motion setting, `'always'` always reduces, `'never'` ignores it. Reduced motion keeps fades and drops movement. |
| `transition` | `transitions.base` | The transition for any `motion` element that sets none: 0.25 seconds on a decelerating curve. |
| `skipAnimations` | `true` under Vitest, `false` elsewhere | Jump every animation straight to its final values. Exit animations still finish, so elements still leave the DOM. |
| `nonce` | none | A Content Security Policy nonce for the `<style>` tags Motion adds for layout and exit animations. |


## Animate your first component

A toast that rises in and falls away when closed. Wrap it in `AnimatePresence` so Motion can run the exit animation before React removes it:

```tsx
// app/components/invoice-sent-toast.tsx
import { AnimatePresence, motion, presets } from '@kitr/animation'

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

Render it with `<InvoiceSentToast invoice={sent} onClose={() => setSent(null)} />`.

When `invoice` is set, the toast fades in while rising 12 pixels. When it becomes `null`, it fades out and only then leaves the DOM. The `key` makes a second invoice replace the first with its own exit and entry.

`presets.fadeUp` is plain data: `{ initial, animate, exit, transition }`. A prop written after the spread wins.

## Use the shared timings

Every duration comes from `transitions`, so a change of feel is one edit:

```tsx
// app/components/project-card.tsx
import { motion, transitions } from '@kitr/animation'

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

Durations are in seconds.

> [!WARNING]
> Don't write `transition={{ duration: 0.3 }}` in a component. Pick the closest name so timings stay in one place.

## Enter and exit with presets

Each preset is a set of props to spread on a `motion` element:

| Preset | Enters as | Use it for |
| --- | --- | --- |
| `fade` | Opacity 0 to 1 | Anything; nothing moves, so it is safe under reduced motion |
| `fadeUp` | Rises 12px while fading in | List items, cards, bottom toasts |
| `fadeDown` | Drops 12px while fading in | Menus, top toasts |
| `scale` | Grows from 95% while fading in | Dialogs, popovers, image previews |
| `slideLeft` | Slides 24px from the right | Drawers and detail panels on the right |
| `slideRight` | Slides 24px from the left | Navigation drawers |
| `collapse` | Opens from zero height to its content's height | Accordions, expanding rows |

Each exits the way it came in. A dialog that grows in from the centre:

```tsx
// app/components/new-project-dialog.tsx
import { AnimatePresence, motion, presets } from '@kitr/animation'

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

Override one part after the spread. A toast that waits a moment:

```tsx
<motion.div {...presets.fadeUp} transition={{ ...presets.fadeUp.transition, delay: 0.3 }} />
```

## Expand and collapse a section

`presets.collapse` animates `height` to `'auto'`, which CSS transitions cannot do:

```tsx
// app/components/project-row.tsx
import { AnimatePresence, motion, presets } from '@kitr/animation'
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

`initial={false}` stops rows that start open from animating on first render. Keep padding on an element inside the collapsing one; padding on the animated element shows at zero height.

## Reveal content as it scrolls into view

`<Reveal>` animates its content the first time it scrolls into view:

```tsx
// app/pages/home.tsx
import { Reveal } from '@kitr/animation'

export function Features() {
  return (
    <Reveal as="section" preset="fadeUp">
      <h2>Invoices that send themselves</h2>
      <p>Acme bills your clients on the first of every month.</p>
    </Reveal>
  )
}
```

To bring items in one after another, set `stagger` (seconds between items) and wrap each in `<RevealItem>`:

```tsx
// app/components/project-grid.tsx
import { Reveal, RevealItem } from '@kitr/animation'

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

With `stagger`, the container stays still and each item plays the preset in turn. A `<RevealItem>` outside a staggered `<Reveal>` does not animate.

| Prop | Default | Description |
| --- | --- | --- |
| `as` | `'div'` | The element to render: `div`, `section`, `article`, `aside`, `header`, `footer`, `main`, `figure`, `ul`, `ol`, `li`, `p` or `span` |
| `preset` | `'fadeUp'` | Any name from `presets` |
| `once` | `true` | Animate the first time only; `false` hides it again when it scrolls out |
| `amount` | `0.2` | How much must be visible: a fraction, `'some'` or `'all'` |
| `delay` | `0` | Seconds to wait once it is in view; with `stagger`, the wait before the first item |
| `stagger` | none | Seconds between `<RevealItem>` children |

Every other `motion.div` prop, such as `className`, passes through.

> [!WARNING] Hidden until JavaScript runs
> `<Reveal>` content starts hidden in the server HTML. Don't wrap the first screen, the main heading or anything a search engine must see without JavaScript.

## Animate page changes

`pageTransitions()` animates route changes with the browser's [View Transitions API](https://developer.mozilla.org/docs/Web/API/View_Transition_API); the back button slides the other way. Pass it to the router as `defaultViewTransition` and import the stylesheet once:

```tsx
// app/router.tsx
import { pageTransitions } from '@kitr/animation'
import '@kitr/animation/page-transitions.css'
import { createKitrRouter } from '@kitr/router'
import { app } from './app'
import { routes } from './routes'

export function getRouter() {
  return createKitrRouter({
    routes,
    app,
    defaultViewTransition: pageTransitions(),
  })
}
```

The direction comes from the router's history index, so opening `/projects/42` slides forward and the back button, a swipe back or `history.back()` slides back.

| Option | Default | Description |
| --- | --- | --- |
| `style` | `'slide'` | `'slide'` moves pages sideways like a native app; `'fade'` cross-fades them |
| `reducedMotion` | `'user'` | `'user'` changes pages instantly for visitors who ask for less motion. `'always'` turns page animations off; `'never'` keeps them |
| `onSearchChange` | `false` | Also animate when only the search or hash changes, such as the next page of a table |

Browsers without view transitions change pages instantly. Chromium, Electron, Android WebView and Safari 18 support them. Pass `viewTransition` to a single link to animate it differently, or `viewTransition={false}` for one that should never animate.

### Keep the header in place

Parts every page shares, such as the header or a docs sidebar, look better standing still while the page under them changes. Mark them with `data-kitr-keep`:

```tsx
// app/components/site-header.tsx
<header data-kitr-keep className="sticky top-0">
  …
</header>
```

A kept part is shown live from the first frame: it doesn't fade or move, so the current link just switches. A kept part that only one of the two pages has (a sidebar on docs pages but not the home page) fades with the page. While a modal dialog is open nothing is kept, so a navigation started from a dialog changes the whole view as one picture.

## Keep the header still during page changes

By default the whole page slides. Give the header and navigation their own `view-transition-name` and they stay in place:

```tsx
// app/pages/app-layout.tsx
import { Outlet } from '@kitr/router'

export default function AppLayout() {
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

> [!WARNING]
> Each `view-transition-name` must be unique on the page. Two elements with the same name abort the transition.

## Morph a card into its page

Give the same name to an element on two pages and the browser moves and resizes it between them:

```tsx
// app/components/project-cover.tsx
export function ProjectCover({ id, src }: { id: string; src: string }) {
  return <img src={src} alt="" style={{ viewTransitionName: `project-cover-${id}` }} />
}
```

Use `<ProjectCover>` in both the list and the project page. The id is part of the name because only one element per name may be on screen.

## Animate layout changes

When a list is re-sorted, filtered or loses an item, `layout` animates every item to its new position:

```tsx
// app/components/sorted-projects.tsx
import { AnimatePresence, motion, presets, transitions } from '@kitr/animation'

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

Use `transitions.snappy` for layout so items settle without bouncing. Under reduced motion the list updates in place.

## Respect reduced motion in your own code

The provider handles `motion` elements. For anything else that moves, such as an autoplaying video, read the setting with `useReducedMotionConfig()`, which follows `config/animation.ts`:

```tsx
// app/components/hero-video.tsx
import { useReducedMotionConfig } from '@kitr/animation'

export function HeroVideo() {
  const reduce = useReducedMotionConfig()
  return <video src="/videos/acme-tour.mp4" autoPlay={!reduce} muted loop playsInline controls={reduce ?? false} />
}
```

It returns `true` when movement should stop. Outside the provider, `prefersReducedMotion()` reads the operating system setting directly.

## Testing

Under Vitest every animation jumps to its end and exits remove their element at once, so tests need no timers. Render with `createTestApp` and `renderWithKitr` from [testing](/packages/testing):

```tsx
// app/components/invoice-sent-toast.test.tsx
import { animationProvider } from '@kitr/animation/provider'
import { createTestApp } from '@kitr/testing'
import { renderWithKitr } from '@kitr/testing/react'
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

`<Reveal>` needs an `IntersectionObserver`; happy-dom's never fires, so stub one that reports every element as visible:

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

For page transitions, call the function with two history indexes:

```ts
// app/router.test.ts
import { pageTransitions } from '@kitr/animation'
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

In Playwright, pass `reducedMotion: 'reduce'` to the browser context to check that path, and set `skipAnimations: true` for stable screenshots.

## Next steps

- [API reference](/packages/animation/api): every export of `@kitr/animation`.
- [Motion for React](https://motion.dev/docs/react): gestures, scroll-linked and layout animation.
- [Router](/packages/router): `createKitrRouter` and the `viewTransition` option on links.
