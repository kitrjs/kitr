---
title: Overview
description: Animate components and page changes, and respect the visitor's reduced-motion setting.
order: 0
---

# Animation

A toast slides in when an invoice is sent, a dialog grows out of the button that opened it, a list fills in row by row. Small movements like these tell people what just changed. Done ad hoc, they also come with three recurring problems: every component invents its own timing, nothing respects the visitor's reduced-motion setting, and page changes stay abrupt while everything inside the page moves.

`@kitr/animation` gives the whole app one set of timings, one reduced-motion rule and animated page changes.

## What it is

`@kitr/animation` is a React animation package with a provider. The provider applies `config/animation.ts` to the whole app, so durations and easings come from `transitions` and `presets` instead of being guessed per component. `<Reveal>` shows content as it scrolls into view. `pageTransitions()` animates route changes like a native app, with the back button sliding the other way. When a visitor asks their operating system for less motion, movement is turned off everywhere at once.

It runs in the browser, inside React, on every kitr platform: the web, desktop (Electron and Tauri) and mobile (Capacitor) builds use the same code. For a spinning 3D product or a scene with a camera, use [3d](/packages/3d) instead; this package animates DOM and SVG elements.

## Built on

`@kitr/animation` is [Motion](https://motion.dev/docs/react) for React, re-exported unchanged. `motion.div`, `AnimatePresence`, `useScroll`, layout animations and gestures work exactly as Motion documents them, imported from `@kitr/animation`.

On top, kitr adds:

| What kitr adds | Why |
| --- | --- |
| `animationProvider` and `config/animation.ts` | One place for the app's durations, easings and the reduced-motion policy. |
| `transitions` and `presets` | Named timings (`fast`, `normal`, `slow`) and enter/exit presets, shared by every component. |
| `<Reveal>` | Content that appears as it scrolls into view, with the reduced-motion rule applied. |
| `pageTransitions()` | Animated route changes through the browser's [View Transitions API](https://developer.mozilla.org/docs/Web/API/View_Transition_API), wired to [router](/packages/router). |
| `prefersReducedMotion()` | The same check the provider uses, for your own code. |

## Problems it solves

- **Timings that differ on every screen.** Every component reads the same `transitions`, so a 200 ms fade is 200 ms everywhere. See [Use the shared timings](/packages/animation/guide#use-the-shared-timings).
- **Reinventing enter and exit animations.** Presets cover the common cases: fade, slide, scale and pop. See [Enter and exit with presets](/packages/animation/guide#enter-and-exit-with-presets).
- **Page changes that jump.** `pageTransitions()` slides pages in and out, keeps the header still and reverses the direction for the back button. See [Animate page changes](/packages/animation/guide#animate-page-changes).
- **A card that should become its page.** Shared element transitions morph a list card into the detail page. See [Morph a card into its page](/packages/animation/guide#morph-a-card-into-its-page).
- **Motion that makes some visitors ill.** The provider reads `prefers-reduced-motion` and turns animation off, and `prefersReducedMotion()` lets your own code follow. See [Respect reduced motion in your own code](/packages/animation/guide#respect-reduced-motion-in-your-own-code).
- **Lists and layouts that reflow abruptly.** Motion's layout animations smooth a re-sorted list or an expanding section. See [Animate layout changes](/packages/animation/guide#animate-layout-changes).

## Further reading

- [Guide](/packages/animation/guide): install, configure and every task.
- [API reference](/packages/animation/api): every export kitr adds to `@kitr/animation`.
- [Motion for React](https://motion.dev/docs/react): gestures, scroll-linked animation, layout animation and everything else re-exported here.
- [View Transitions API on MDN](https://developer.mozilla.org/docs/Web/API/View_Transition_API): what `pageTransitions()` uses and which browsers support it.
- [Router](/packages/router): `createKitrRouter` and the `viewTransition` option on links.
- [3D](/packages/3d): scenes and models, with the same reduced-motion rules.
