---
title: API
description: Every export of @kitr/animation, with its signature.
order: 2
---

# API

Every export of `@kitr/animation`, `@kitr/animation/provider`, read from the published type definitions. The [guide](/packages/animation) shows them in use.

## @kitr/animation

Re-exports `framer-motion`, `motion`, `motion-dom`, `motion-utils` unchanged, plus the following.

### pageTransitions

```ts
function pageTransitions(options?: PageTransitionOptions): PageTransitionsValue;
```

Animated page changes for `createKitrRouter`, through the browser's View Transitions API:
`defaultViewTransition: pageTransitions()`. Each navigation gets the types
`kitr-<style>` and `kitr-forward` or `kitr-back` (from the history index, so the browser's
back button slides the other way), which `@kitr/animation/page-transitions.css` animates.
Browsers without view transitions change pages instantly.

### prefersReducedMotion

```ts
function prefersReducedMotion(): boolean;
```

Did the visitor ask the operating system for less motion? False where it cannot be asked.

### presetVariants

```ts
function presetVariants(name: PresetName): Variants;
```

The `hidden` and `visible` variants of a preset, for parents that drive their children by label.

### Reveal

```ts
function Reveal({ as, preset, once, amount, delay, stagger, children, ...rest }: RevealProps): import("react").JSX.Element;
```

Animates its content in when it scrolls into view: sections of a landing page, cards in a
grid, rows of a list with `stagger`. Uses Motion's `whileInView`, so it runs on an
IntersectionObserver and costs nothing while off screen.

### RevealItem

```ts
function RevealItem({ as, children, ...rest }: RevealItemProps): import("react").JSX.Element;
```

One child of a `<Reveal stagger>`: it takes the parent's preset and animates in its turn.
Outside a staggered `<Reveal>` it renders its element without animating.

### defineConfig

```ts
const defineConfig: <const C extends AnimationConfig>(config: C) => C;
```

Types the default export of `config/animation.ts`: reduced motion, the default transition and test mode.

### presets

```ts
const presets: {
  fade: Preset;
  fadeUp: Preset;
  fadeDown: Preset;
  scale: Preset;
  slideLeft: Preset;
  slideRight: Preset;
  collapse: Preset;
};
```

Enter and exit animations for the common cases. Spread one on a `motion` element:
`<motion.li {...presets.fadeUp} />`. Inside `<AnimatePresence>`, the `exit` half runs when the
element is removed.

### transitions

```ts
const transitions: {
  fast: {
    duration: number;
    ease: readonly [
      0.05,
      0.7,
      0.1,
      1
    ];
  };
  base: {
    duration: number;
    ease: readonly [
      0.05,
      0.7,
      0.1,
      1
    ];
  };
  slow: {
    duration: number;
    ease: readonly [
      0.05,
      0.7,
      0.1,
      1
    ];
  };
  exit: {
    duration: number;
    ease: readonly [
      0.3,
      0,
      0.8,
      0.15
    ];
  };
  snappy: {
    type: "spring";
    visualDuration: number;
    bounce: number;
  };
  bouncy: {
    type: "spring";
    visualDuration: number;
    bounce: number;
  };
};
```

Named timings shared by the whole app, so a list, a dialog and a toast move with the same
rhythm. Durations are in seconds, as Motion expects.

### AnimationConfig

```ts
interface AnimationConfig {
  /**
   * What to do when the visitor asks for less motion. With `'user'` (the default), movement
   * (`x`, `y`, `scale`, `rotate`, layout) is switched off for them while fades still run.
   */
  reducedMotion?: ReducedMotion;
  /** The transition every `motion` element uses unless it sets its own. Default `transitions.base`. */
  transition?: Transition;
  /**
   * Jump every animation straight to its end. Default: on under Vitest, so tests never wait for
   * an animation, and off everywhere else. Turn it on for screenshot tests.
   */
  skipAnimations?: boolean;
  /** A CSP nonce for the `<style>` tags Motion adds for layout and exit animations. */
  nonce?: string;
}
```

`config/animation.ts`: the defaults every animation in the app starts from.

### LocationChange

```ts
interface LocationChange {
  fromLocation?: LocationLike;
  toLocation: LocationLike;
  pathChanged: boolean;
  hrefChanged: boolean;
}
```

What TanStack Router passes to a view transition's `types` function on every navigation.

### PageTransitionOptions

```ts
interface PageTransitionOptions {
  /** How pages change. Default `'slide'`. */
  style?: PageTransitionStyle;
  /** With `'user'` (the default) there is no page animation for visitors who ask for less motion. */
  reducedMotion?: ReducedMotion;
  /** Also animate when only the search or hash changes, such as a new page of a table. Default `false`. */
  onSearchChange?: boolean;
}
```

Options of `pageTransitions()`.

### PageTransitionsValue

```ts
interface PageTransitionsValue {
  types: (change: LocationChange) => string[] | false;
}
```

The value for TanStack Router's `defaultViewTransition` option.

### Preset

```ts
interface Preset {
  initial: TargetAndTransition;
  animate: TargetAndTransition;
  exit: TargetAndTransition;
  transition: Transition;
}
```

Props to spread on a `motion` element so it animates in on mount and out on exit:
`initial`, `animate`, `exit` and `transition`. Spread order lets you override any of them.

### RevealItemProps

```ts
interface RevealItemProps extends Omit<HTMLMotionProps<'div'>, 'variants'> {
  /** The element to render. Default `'div'`; use `'li'` inside `<Reveal as="ul">`. */
  as?: RevealElement;
  children?: ReactNode;
}
```

Props of `<RevealItem>`: every `motion.div` prop, plus the element to render.

### RevealProps

```ts
interface RevealProps extends Omit<HTMLMotionProps<'div'>, 'initial' | 'whileInView' | 'variants'> {
  /** The element to render. Default `'div'`. */
  as?: RevealElement;
  /** How the content appears. Default `'fadeUp'`. */
  preset?: PresetName;
  /** Animate the first time it scrolls into view only (default), or every time. */
  once?: boolean;
  /** How much of the element must be visible before it animates: a fraction, `'some'` or `'all'`. Default `0.2`. */
  amount?: number | 'some' | 'all';
  /** Seconds to wait after it comes into view. Default `0`. */
  delay?: number;
  /**
   * Seconds between each `<RevealItem>` inside. When set, the items animate one after another
   * and the container itself stays still.
   */
  stagger?: number;
  children?: ReactNode;
}
```

Props of `<Reveal>`: every `motion.div` prop, plus when and how the content appears.

### PageTransitionStyle

```ts
type PageTransitionStyle = 'slide' | 'fade';
```

The look of a page change. `'slide'` pushes pages sideways like a native app; `'fade'` cross-fades.

### PresetName

```ts
type PresetName = keyof typeof presets;
```

A preset name from `presets`.

### ReducedMotion

```ts
type ReducedMotion = 'user' | 'always' | 'never';
```

How the app treats the visitor's "reduce motion" setting: `'user'` follows it, `'always'`
behaves as if it were on for everyone, `'never'` ignores it.

### RevealElement

```ts
type RevealElement = 'div' | 'section' | 'article' | 'aside' | 'header' | 'footer' | 'main' | 'figure' | 'ul' | 'ol' | 'li' | 'p' | 'span';
```

The elements `<Reveal as>` and `<RevealItem as>` can render.

### TransitionName

```ts
type TransitionName = keyof typeof transitions;
```

A transition name from `transitions`.

## @kitr/animation/provider

### animationProvider

```ts
const animationProvider: import("@kitr/core").KitrProvider;
```

Wraps the app in Motion's `MotionConfig` from `config/animation.ts`: reduced motion follows
the visitor's setting, every element shares the app's default transition, and under Vitest
animations finish instantly so tests never wait for them.

<!-- GENERATED by scripts/api-docs.mjs from the type definitions. Do not edit. -->
