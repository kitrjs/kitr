---
title: Overview
description: Animate components and page changes, and respect the visitor's reduced-motion setting.
order: 0
---

# Animation

## What it is

`@kitr/animation` is Motion for React with shared timings. `transitions` and `presets` keep durations consistent, `<Reveal>` shows content as it scrolls in, and `pageTransitions()` animates route changes. When a visitor asks for less motion, movement turns off everywhere.

Runs in the browser on every kitr platform. For scenes with a camera, use [3d](/packages/3d).

## Install

```sh
kitr add animation
```

Adds `@kitr/animation` with Motion, its provider and `config/animation.ts`. [Every change](/packages/animation/guide#install).

## Quick start

A toast that rises in when an invoice is sent and falls away when it closes:

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

The toast fades in while rising, and fades out before it leaves the DOM. With reduced motion on, both happen instantly. Next in the guide: [Animate your first component](/packages/animation/guide#animate-your-first-component).

## Built on

On top, kitr adds:

| What kitr adds | Why |
| --- | --- |
| `animationProvider` and `config/animation.ts` | One place for the app's durations, easings and the reduced-motion policy. |
| `transitions` and `presets` | Named timings (`fast`, `normal`, `slow`) and enter/exit presets, shared by every component. |
| `<Reveal>` | Content that appears as it scrolls into view, with the reduced-motion rule applied. |
| `pageTransitions()` | Animated route changes through the browser's [View Transitions API](https://developer.mozilla.org/docs/Web/API/View_Transition_API), wired to [router](/packages/router). |
| `prefersReducedMotion()` | The same check the provider uses, for your own code. |

kitr adds the provider, the shared timings, `<Reveal>`, page transitions and the reduced-motion switch.

## Problems it solves

- **Timings that differ on every screen.** [Use the shared timings](/packages/animation/guide#use-the-shared-timings).
- **Reinventing enter and exit animations.** [Enter and exit with presets](/packages/animation/guide#enter-and-exit-with-presets).
- **Page changes that jump.** [Animate page changes](/packages/animation/guide#animate-page-changes).
- **A card that should become its page.** [Morph a card into its page](/packages/animation/guide#morph-a-card-into-its-page).
- **Motion that makes some visitors ill.** [Respect reduced motion in your own code](/packages/animation/guide#respect-reduced-motion-in-your-own-code).
- **Lists and layouts that reflow abruptly.** [Animate layout changes](/packages/animation/guide#animate-layout-changes).

## Further reading

- [Guide](/packages/animation/guide).
- [API reference](/packages/animation/api).
- [Motion for React](https://motion.dev/docs/react).
- [View Transitions API on MDN](https://developer.mozilla.org/docs/Web/API/View_Transition_API).
- [Router](/packages/router).
- [3D](/packages/3d).
