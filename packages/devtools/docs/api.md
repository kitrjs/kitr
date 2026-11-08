---
title: API reference
description: Every export of @kitr/devtools, with its signature.
order: 2
---

# API reference

Every export of `@kitr/devtools`, `@kitr/devtools/provider`, `@kitr/devtools/ui`, read from the published type definitions. The [guide](/packages/devtools/guide) shows them in use.

## @kitr/devtools

### createDevtoolsHub

```ts
function createDevtoolsHub(options?: {
  maxEntries?: number;
}): DevtoolsHub$1;
```

The event bus and panel registry behind the overlay. The provider binds one per app in development;
create your own in tests to assert on what code logs. Keeps `maxEntries` (default 500) per channel
and folds bursts of identical entries (same channel, level, label and data within 50ms) into one with a `count`.

### definePanel

```ts
function definePanel(panel: DevtoolsPanel$1): DevtoolsPanel$1;
```

Returns the panel unchanged, typed as a `DevtoolsPanel`. Use it in the module a provider's `devtools()` method imports.

### getDevtools

```ts
function getDevtools(app: KitrApp): DevtoolsHub | null;
```

The hub when devtools are active (`@kitr/devtools` added and enabled, on the client), else null.

### defineConfig

```ts
const defineConfig: <const C extends DevtoolsConfig>(config: C) => C;
```

Types the default export of `config/devtools.ts`.

### DevtoolsAction

```ts
interface DevtoolsAction {
  /** Unique id, used as the React key and in the command palette. */
  id: string;
  /** Button text and command palette label. */
  label: string;
  /** Short secondary text shown next to the label in menus and the command palette. */
  hint?: string;
  /** An icon for the button and palette entry. Typed `unknown` so core does not depend on an icon library; `@kitr/devtools` narrows it. */
  icon?: unknown;
  /** Destructive: shown in the error colour in menus and the palette. */
  danger?: boolean;
  /** Return false to hide the action for now. Re-read on every render. */
  when?: (app: KitrApp) => boolean;
  /** Runs when the button or palette entry is chosen. A returned string is logged as the result. */
  run: (app: KitrApp) => MaybePromise<void | string>;
}
```

An entry in a panel's ⋯ menu and the command palette: a label, an optional hint and a `run` function.

### DevtoolsConfig

```ts
interface DevtoolsConfig {
  /**
   * Show the overlay. Default: in development only. Set `true` to ship it in production too,
   * or `false` to turn it off without removing the package.
   */
  enabled?: boolean;
  /**
   * The trigger button. `auto` shows it; `hover` shows it only
   * while the pointer is near its corner; `hidden` removes it (use the shortcut, gesture or URL flag).
   * Default `auto`.
   */
  trigger?: 'auto' | 'hover' | 'hidden';
  /** Where the trigger button starts; it can be dragged afterwards. Default `bottom-left`. */
  position?: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';
  /** Which edge the window docks to on desktop. Default `bottom`. */
  dock?: 'bottom' | 'right';
  /** Colour scheme. `auto` follows `data-theme` on `<html>` when set, else the system. Default `auto`. */
  theme?: 'auto' | 'light' | 'dark';
  /**
   * Keyboard shortcut that toggles the overlay. A single string is the key with Ctrl/Cmd+Shift
   * (`'k'`). An array is the full combination, where `'Meta'` means Ctrl or Cmd
   * (`['Meta', 'Shift', 'K']`). Default `'k'`.
   */
  shortcut?: string | string[];
  /** Open with a three-finger long press on touch screens. Default true. */
  touchGesture?: boolean;
  /** Query parameter that opens the overlay even when the trigger is hidden, or `false` to disable. Default `'kitr-devtools'`. */
  urlFlag?: string | false;
  /** Entries kept per channel. Default 500. */
  maxEntries?: number;
  /** Open on first load. Default false. */
  openByDefault?: boolean;
}
```

Options for `config/devtools.ts`: whether the overlay is on, how it is opened, where it sits and how much it keeps.

### DevtoolsEntry

```ts
interface DevtoolsEntry {
  /** Increasing id, unique for the page's lifetime. */
  id: number;
  /** The channel it was logged under, such as `http`, `analytics` or `logs`. */
  channel: string;
  /** `Date.now()` when it was logged; for a collapsed burst, when the last repeat arrived. */
  time: number;
  /** Severity; the log view colours and filters by it. */
  level: DevtoolsLevel;
  /** One-line summary shown in the list. */
  label: string;
  /** Anything extra, shown expanded under the line. */
  data?: unknown;
  /** `mark` for a divider added with `hub.mark()`; absent for ordinary entries. */
  kind?: 'mark';
  /** How many identical entries arrived in a burst and were collapsed into this one. Default 1. */
  count?: number;
}
```

One line in the devtools log, recorded with `hub.log()` or `hub.mark()`.

### DevtoolsHub

```ts
interface DevtoolsHub {
  /** Every registered panel, in tab order (group, then registration order). */
  readonly panels: DevtoolsPanel[];
  /** Bumps on every change (entry, panel, `notify()`); what a store hook reads to know when to re-render. */
  readonly version: number;
  /** Add a panel at runtime (providers normally use the `devtools()` method instead). */
  register(panel: DevtoolsPanel): () => void;
  /** Record an event (an HTTP request, an analytics call, a log line) under a channel. */
  log(channel: string, label: string, data?: unknown, level?: DevtoolsLevel): void;
  /** Add a divider to the log, such as "navigated /orders". Recorded as an `info` entry on the `devtools` channel. */
  mark(label: string): void;
  /** Logged entries, oldest first; pass a channel to filter. Treat the result as read-only: without a channel it is a cached view shared until the next write. */
  entries(channel?: string): DevtoolsEntry[];
  /** Every channel logged to so far, in first-seen order. */
  channels(): string[];
  /** Entries currently kept per level, cheap enough to read on every render for badges. */
  counts(): Record<DevtoolsLevel, number>;
  /** Empty the log, or one channel of it. */
  clear(channel?: string): void;
  /** Notified (without arguments) on new entries, panel changes and `notify()`; the overlay re-renders. */
  subscribe(listener: () => void): () => void;
  /** Tell the overlay that something it shows (session, cache) changed. */
  notify(): void;
}
```

The devtools service bound as `devtools` on the client when devtools is enabled: panels plus a shared event log.

### DevtoolsPanel

```ts
interface DevtoolsPanel {
  /** Unique id; registering another panel with the same id replaces this one. */
  id: string;
  /** Tab label. */
  label: string;
  /** The tab icon. Typed `unknown` so core does not depend on React or an icon library; `@kitr/devtools` accepts a hugeicons element or any React node. */
  icon?: unknown;
  /** Where the tab sits: `app`, `data`, `platform`, then `custom` (the default), each in registration order. */
  group?: 'app' | 'data' | 'platform' | 'custom';
  /** Text or count shown next to the tab label, optionally with a tone. Re-read on every render. */
  badge?: (app: KitrApp) => string | number | null | undefined | {
    value: string | number;
    tone?: DevtoolsTone;
  };
  /** The panel body. Return a React node; devtools re-renders it when the hub changes. */
  render: (app: KitrApp) => KitrNode;
  /** Buttons in the panel header and entries in the command palette. */
  actions?: DevtoolsAction[];
}
```

A tab in the devtools window, contributed by a provider's `devtools(app)` method or `hub.register()`.

### DevtoolsLevel

```ts
/** Severity of a devtools entry; the log view colours and filters by it. */
type DevtoolsLevel = 'debug' | 'info' | 'warn' | 'error';
```

Severity of a devtools entry; the log view colours and filters by it.

### DevtoolsTone

```ts
type DevtoolsTone = 'ok' | 'warn' | 'error' | 'muted' | 'info';
```

Colour intent for a badge or status chip: `ok` green, `warn` amber, `error` red, `muted` grey, `info` blue.

## @kitr/devtools/provider

### devtoolsProvider

```ts
const devtoolsProvider: import("@kitr/core").KitrProvider;
```

Binds the `devtools` hub, collects every provider's `devtools()` panels and mounts the overlay,
when `enabled` (default: development). Otherwise `register`/`wrap` are no-ops, and in a
production build the kitr Vite plugin leaves this module out unless the config enables it.

## @kitr/devtools/ui

### Badge

```ts
function Badge({ children, tone }: {
  children: ReactNode;
  tone?: Tone;
}): import("react").JSX.Element;
```

A small pill for counts and states. `tone` picks the colour: ok, warn, error, info or muted.

### Button

```ts
function Button({ children, onClick, title, danger, icon, disabled, 'aria-label': ariaLabel }: {
  children?: ReactNode;
  onClick: () => void;
  title?: string;
  danger?: boolean;
  icon?: IconSvgElement;
  disabled?: boolean;
  'aria-label'?: string;
}): import("react").JSX.Element;
```

A button in the overlay's style; with `icon` and no children it is a square icon button.

### Chip

```ts
function Chip({ children, on, onClick, tone, count, icon }: {
  children: ReactNode;
  on?: boolean;
  onClick?: () => void;
  tone?: Tone;
  count?: number;
  icon?: IconSvgElement;
}): import("react").JSX.Element;
```

A filter chip that toggles with `on`; `count` adds a muted number and `tone` colours it.

### Chips

```ts
function Chips({ children }: {
  children: ReactNode;
}): import("react").JSX.Element;
```

A horizontally scrolling row of `Chip`s with a fade at the edge.

### Empty

```ts
function Empty({ children, code }: {
  children: ReactNode;
  code?: string;
}): import("react").JSX.Element;
```

One short empty-state line; pass `code` to show a command or snippet chip after it.

### JsonView

```ts
function JsonView({ value, depth, open }: {
  value: unknown;
  depth?: number;
  open?: boolean;
}): import("react").JSX.Element;
```

Any value as an expandable tree, styled like the built-in panels. `open` expands the first level.

### KeyValue

```ts
function KeyValue({ rows }: {
  rows: Array<[
    string,
    unknown
  ]>;
}): import("react").JSX.Element;
```

A two-column table of `[key, value]` rows; each value renders as a `JsonView`.

### LogList

```ts
function LogList({ entries, empty, relative, onChannel }: {
  entries: DevtoolsEntry[];
  empty?: string;
  relative?: boolean;
  onChannel?: (channel: string) => void;
}): import("react").JSX.Element;
```

A list of hub entries, newest last, one line each: time, channel, label and a data preview that
expands to a full tree on click. `relative` shows deltas from the first entry; `onChannel` makes
the channel chip a filter button.

### Masked

```ts
function Masked({ value }: {
  value: string;
}): import("react").JSX.Element;
```

A sensitive value shown as dots until the reader presses the reveal button.

### preview

```ts
function preview(value: unknown, max?: number): string;
```

Compact one-line JSON of any value, cut to `max` characters with an ellipsis.

### Row

```ts
function Row({ head, children, open }: {
  head: ReactNode;
  children?: ReactNode;
  open?: boolean;
}): import("react").JSX.Element;
```

An expandable list row: `head` is always one line, `children` show when it is open.

### Section

```ts
function Section({ title, children, open, count }: {
  title: ReactNode;
  children: ReactNode;
  open?: boolean;
  count?: number;
}): import("react").JSX.Element;
```

A collapsible group built on `<details>`, with an optional count badge in the title.

### Stat

```ts
function Stat({ label, value, tone }: {
  label: string;
  value: ReactNode;
  tone?: Tone;
}): import("react").JSX.Element;
```

A metric card: small label over a large value, tinted by `tone`.

### Stats

```ts
function Stats({ children }: {
  children: ReactNode;
}): import("react").JSX.Element;
```

A grid of `Stat` cards.

### Toolbar

```ts
function Toolbar({ children }: {
  children: ReactNode;
}): import("react").JSX.Element;
```

A row of buttons, spaced like a panel's action bar.

### styles

```ts
const styles: string;
```

The overlay's stylesheet. It is injected inside a shadow root, so the variables live on `:host`
and the root element, and the theme is picked by `data-theme` on that root element.
Contributed panels can use every `kitr-dt-*` class and the `--dt-*` variables.

### tones

```ts
const tones: readonly [
  "ok",
  "warn",
  "error",
  "info",
  "muted"
];
```

The five tones shared by badges, chips and stats.

### Tone

```ts
type Tone = (typeof tones)[number];
```

One of `tones`.

<!-- GENERATED by scripts/api-docs.mjs from the type definitions. Do not edit. -->
