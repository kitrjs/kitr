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
   * The trigger button. `auto` shows it, dimmed on hover-capable screens; `hover` shows it only
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
const styles = "\n:host,.kitr-dt{--dt-bg:#fcfcfd;--dt-surface:#f4f4f6;--dt-surface-2:#e9e9ed;--dt-border:#dcdce1;--dt-fg:#18181b;--dt-muted:#5f5f69;--dt-accent:#2368ee;--dt-accent-fg:#fff;--dt-ok:#12703a;--dt-warn:#8a5200;--dt-error:#c42323;--dt-info:#1f5fd0;--dt-string:#16703c;--dt-number:#9a4a00;--dt-boolean:#8a2fb0;--dt-null:#5f5f69;--dt-key:#1f5fd0;--dt-font-ui:system-ui,-apple-system,\"Segoe UI\",Roboto,sans-serif;--dt-font-mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;--dt-radius:8px;--dt-size:12px;--dt-hit:28px;--dt-shadow:0 8px 30px rgba(0,0,0,.18);--f:linear-gradient(90deg,#000 calc(100% - 20px),transparent)}\n[data-theme=\"dark\"]{--dt-bg:#0f0f10;--dt-surface:#18181a;--dt-surface-2:#232326;--dt-border:#2c2c30;--dt-fg:#ededf0;--dt-muted:#9b9ba5;--dt-accent:#6e9bff;--dt-accent-fg:#0b0b0c;--dt-ok:#4cc57d;--dt-warn:#e8ac45;--dt-error:#ff7070;--dt-info:#7aa6ff;--dt-string:#6fd49a;--dt-number:#e8ac45;--dt-boolean:#d79bf2;--dt-null:#9b9ba5;--dt-key:#8db4ff;--dt-shadow:0 8px 30px rgba(0,0,0,.6)}\n@media (max-width:640px),(pointer:coarse) and (max-height:500px){:host,.kitr-dt{--dt-size:13px}}\n@media (pointer:coarse){:host,.kitr-dt{--dt-hit:44px}}\n.kitr-dt{font:var(--dt-size)/1.45 var(--dt-font-ui);color:var(--dt-fg);color-scheme:light;-webkit-text-size-adjust:100%}\n.kitr-dt[data-theme=\"dark\"]{color-scheme:dark}\n.kitr-dt *{box-sizing:border-box}\n.kitr-dt button,.kitr-dt input,.kitr-dt summary{-webkit-tap-highlight-color:transparent}\n.kitr-dt :focus-visible{outline:2px solid var(--dt-accent);outline-offset:1px}\n.kitr-dt-trigger{position:fixed;z-index:2147483000;width:36px;height:36px;border-radius:999px;border:1px solid var(--dt-border);background:var(--dt-bg);color:var(--dt-accent);cursor:pointer;box-shadow:var(--dt-shadow);display:flex;align-items:center;justify-content:center;padding:0;touch-action:none;margin:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)}\n.kitr-dt-trigger:hover{background:var(--dt-surface)}\n@media (pointer:coarse){.kitr-dt-trigger{width:44px;height:44px}}\n.kitr-dt-trigger-badge{position:absolute;top:-4px;right:-4px;background:var(--dt-error);color:var(--dt-bg);border-radius:999px;font:700 10px/1 var(--dt-font-ui);min-width:16px;height:16px;padding:0 4px;display:flex;align-items:center;justify-content:center}\n.kitr-dt-panel,.kitr-dt-sheet{position:fixed;z-index:2147483000;background:var(--dt-bg);color:var(--dt-fg);display:flex;flex-direction:column;box-shadow:var(--dt-shadow);overflow:hidden;min-height:0}\n.kitr-dt-panel{left:0;right:0;bottom:0;height:var(--kitr-dt-height,45vh);border-top:1px solid var(--dt-border)}\n.kitr-dt-panel[data-dock=\"right\"]{left:auto;top:0;width:var(--kitr-dt-width,420px);height:auto;border-top:0;border-left:1px solid var(--dt-border)}\n.kitr-dt-sheet{left:0;right:0;bottom:0;height:var(--kitr-dt-height,50dvh);border:1px solid var(--dt-border);border-bottom:0;border-radius:16px 16px 0 0;padding-bottom:env(safe-area-inset-bottom);transition:height .2s ease}\n.kitr-dt-handle{flex:none;width:36px;height:5px;border-radius:99px;background:var(--dt-border);margin:8px auto 2px;touch-action:none;cursor:grab}\n.kitr-dt-resize{position:absolute;z-index:1;background:transparent;touch-action:none}\n.kitr-dt-resize:hover,.kitr-dt-resize:active{background:var(--dt-accent)}\n.kitr-dt-resize-y{left:0;right:0;top:-2px;height:5px;cursor:ns-resize}\n.kitr-dt-resize-x{top:0;bottom:0;left:-2px;width:5px;cursor:ew-resize}\n.kitr-dt-header{display:flex;align-items:center;gap:4px;padding:4px 8px;border-bottom:1px solid var(--dt-border);background:var(--dt-bg);flex:none}\n.kitr-dt-tabs{display:flex;align-items:center;gap:2px;flex:1;min-width:0;overflow-x:auto;scrollbar-width:none;-webkit-mask-image:var(--f);mask-image:var(--f)}\n.kitr-dt-tabs::-webkit-scrollbar,.kitr-dt-chips::-webkit-scrollbar{display:none}\n.kitr-dt-tab{background:transparent;border:0;color:var(--dt-muted);padding:0 10px;min-height:var(--dt-hit);border-radius:var(--dt-radius);cursor:pointer;font:inherit;white-space:nowrap;display:flex;gap:6px;align-items:center;flex:none}\n.kitr-dt-tab:hover{color:var(--dt-fg);background:var(--dt-surface)}\n.kitr-dt-tab-active{color:var(--dt-fg);background:var(--dt-surface-2);font-weight:600}\n.kitr-dt-spacer{flex:1}\n.kitr-dt-body{flex:1;min-height:0;overflow:auto;padding:10px 12px;overscroll-behavior:contain}\n.kitr-dt-stack{display:flex;flex-direction:column;gap:14px}\n.kitr-dt-h{margin:0 0 6px;font-size:.92em;font-weight:600;color:var(--dt-muted);text-transform:uppercase;letter-spacing:.05em}\n.kitr-dt-muted{color:var(--dt-muted)}\n.kitr-dt-table{border-collapse:collapse;width:100%}\n.kitr-dt-table td{padding:3px 8px 3px 0;vertical-align:top;border-bottom:1px solid var(--dt-border)}\n.kitr-dt-key{color:var(--dt-key);white-space:nowrap;font-family:var(--dt-font-mono)}\n.kitr-dt-table td.kitr-dt-key{width:1%;padding-right:16px}\n.kitr-dt-string,.kitr-dt-number,.kitr-dt-boolean,.kitr-dt-undefined,.kitr-dt-object,.kitr-dt-error,.kitr-dt-pre,.kitr-dt-time,.kitr-dt-data,.kitr-dt-preview{font-family:var(--dt-font-mono)}\n.kitr-dt-string{color:var(--dt-string)}.kitr-dt-number{color:var(--dt-number)}.kitr-dt-boolean{color:var(--dt-boolean)}.kitr-dt-undefined,.kitr-dt-object{color:var(--dt-null)}.kitr-dt-error{color:var(--dt-error)}\n.kitr-dt-toggle{background:none;border:0;color:var(--dt-muted);cursor:pointer;font:inherit;padding:0;display:inline-flex;align-items:center;gap:2px}\n@media (pointer:coarse){.kitr-dt-toggle{padding:10px 8px;margin:-10px -8px;min-height:36px}}\n.kitr-dt-indent{padding-left:14px;border-left:1px solid var(--dt-border);margin-left:5px}\n.kitr-dt-pre{margin:0;white-space:pre-wrap;word-break:break-all;max-height:160px;overflow:auto;color:var(--dt-fg)}\n.kitr-dt-btn{background:var(--dt-surface);border:1px solid var(--dt-border);color:var(--dt-fg);border-radius:6px;padding:0 10px;min-height:var(--dt-hit);cursor:pointer;font:inherit;display:inline-flex;align-items:center;justify-content:center;gap:6px}\n.kitr-dt-btn:hover:not(:disabled){background:var(--dt-surface-2)}\n.kitr-dt-btn:disabled{opacity:.5;cursor:not-allowed}\n.kitr-dt-btn-danger{color:var(--dt-error);border-color:currentColor;background:transparent}\n.kitr-dt-btn-icon{width:var(--dt-hit);padding:0}\n.kitr-dt-toolbar{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:8px}\n.kitr-dt-input{background:var(--dt-surface);border:1px solid var(--dt-border);color:var(--dt-fg);border-radius:6px;padding:0 10px;min-height:var(--dt-hit);font:inherit;min-width:160px}\n.kitr-dt-input::placeholder{color:var(--dt-muted)}\n.kitr-dt-badge,.kitr-dt-chip,.kitr-dt-stat{--t:var(--dt-muted)}\n.kitr-dt-badge-ok,.kitr-dt-chip-ok,.kitr-dt-stat-ok{--t:var(--dt-ok)}.kitr-dt-badge-warn,.kitr-dt-chip-warn,.kitr-dt-stat-warn{--t:var(--dt-warn)}.kitr-dt-badge-error,.kitr-dt-chip-error,.kitr-dt-stat-error{--t:var(--dt-error)}.kitr-dt-badge-info,.kitr-dt-chip-info,.kitr-dt-stat-info{--t:var(--dt-info)}\n.kitr-dt-badge{display:inline-block;border-radius:999px;padding:0 7px;font-size:.85em;line-height:18px;background:color-mix(in srgb,var(--t) 14%,transparent);color:var(--t);font-weight:600;white-space:nowrap}\n.kitr-dt-chips{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;padding:2px 0;margin-bottom:8px;-webkit-mask-image:var(--f);mask-image:var(--f)}\n.kitr-dt-chip{flex:none;display:inline-flex;align-items:center;gap:5px;min-height:24px;padding:0 10px;border-radius:999px;border:1px solid var(--dt-border);background:transparent;color:var(--t);font:inherit;cursor:pointer;white-space:nowrap}\n.kitr-dt-chip:hover{background:var(--dt-surface)}\n.kitr-dt-chip-on{background:color-mix(in srgb,var(--t) 14%,transparent);border-color:var(--t);font-weight:600}\n.kitr-dt-chip:not(.kitr-dt-chip-ok):not(.kitr-dt-chip-warn):not(.kitr-dt-chip-error):not(.kitr-dt-chip-info){color:var(--dt-fg)}\n.kitr-dt-chip-count{color:var(--dt-muted);font-variant-numeric:tabular-nums}\n.kitr-dt-stats{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px}\n.kitr-dt-stat{background:var(--dt-surface);border:1px solid var(--dt-border);border-radius:var(--dt-radius);padding:8px 10px;display:flex;flex-direction:column;gap:2px;min-width:0}\n.kitr-dt-stat>span:first-child{color:var(--dt-muted);font-size:.9em}\n.kitr-dt-stat>span:last-child{font-size:1.5em;font-weight:600;line-height:1.2;font-variant-numeric:tabular-nums;overflow:hidden;text-overflow:ellipsis}\n.kitr-dt-stat-ok>span:last-child,.kitr-dt-stat-warn>span:last-child,.kitr-dt-stat-error>span:last-child,.kitr-dt-stat-info>span:last-child{color:var(--t)}\n.kitr-dt-section{border:1px solid var(--dt-border);border-radius:var(--dt-radius);background:var(--dt-surface)}\n.kitr-dt-section>summary{cursor:pointer;list-style:none;padding:0 10px;min-height:var(--dt-hit);display:flex;align-items:center;gap:6px;font-weight:600}\n.kitr-dt-section>summary::-webkit-details-marker{display:none}\n.kitr-dt-section>summary::before{content:\"\";border:4px solid transparent;border-left-color:var(--dt-muted);margin-right:2px;transition:transform .15s}\n.kitr-dt-section[open]>summary::before{transform:rotate(90deg)}\n.kitr-dt-section>div{padding:4px 10px 10px}\n.kitr-dt-empty{color:var(--dt-muted);padding:16px 4px;text-align:center}\n.kitr-dt-empty code{font-family:var(--dt-font-mono);background:var(--dt-surface-2);color:var(--dt-fg);border-radius:4px;padding:1px 5px}\n.kitr-dt-log{display:flex;flex-direction:column}\n.kitr-dt-row{border-bottom:1px solid var(--dt-border)}\n.kitr-dt-row-line{display:flex;align-items:center;gap:8px;min-width:0}\n.kitr-dt-row-line>.kitr-dt-row-head{flex:1}\n.kitr-dt-row-head{display:flex;align-items:center;gap:8px;min-height:var(--dt-hit);width:100%;background:none;border:0;color:inherit;font:inherit;text-align:left;cursor:pointer;padding:2px 0;min-width:0}\n.kitr-dt-row-head:hover{background:var(--dt-surface)}\n.kitr-dt-row-body{padding:2px 0 8px 12px;overflow-x:auto}\n.kitr-dt-time{color:var(--dt-muted);flex:none;font-variant-numeric:tabular-nums}\n.kitr-dt-channel{flex:none;border:1px solid var(--dt-border);background:var(--dt-surface);color:var(--dt-fg);border-radius:999px;padding:0 8px;font:inherit;font-size:.9em;line-height:18px}\nbutton.kitr-dt-channel{cursor:pointer}\nbutton.kitr-dt-channel:hover{background:var(--dt-surface-2)}\n.kitr-dt-label{flex:none;max-width:50%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n.kitr-dt-data{min-width:0}\n.kitr-dt-preview{color:var(--dt-muted);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n.kitr-dt-count{color:var(--dt-muted);font-variant-numeric:tabular-nums;flex:none}\n.kitr-dt-mark{display:flex;align-items:center;gap:8px;color:var(--dt-muted);font-size:.9em;padding:6px 0}\n.kitr-dt-mark::before,.kitr-dt-mark::after{content:\"\";flex:1;height:1px;background:var(--dt-border)}\n.kitr-dt-level-warn .kitr-dt-label{color:var(--dt-warn)}.kitr-dt-level-error .kitr-dt-label{color:var(--dt-error)}.kitr-dt-level-debug .kitr-dt-label{color:var(--dt-muted)}\n.kitr-dt-palette{position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:flex-start;justify-content:center;padding:12vh 8px 0;z-index:2147483001}\n.kitr-dt-palette-box{width:min(560px,100%);max-height:70dvh;display:flex;flex-direction:column;background:var(--dt-bg);border:1px solid var(--dt-border);border-radius:12px;overflow:hidden;color:var(--dt-fg);box-shadow:var(--dt-shadow)}\n.kitr-dt-palette-box input{width:100%;background:transparent;border:0;border-bottom:1px solid var(--dt-border);color:var(--dt-fg);padding:12px;font:inherit;font-size:max(16px,1em);outline:none}\n.kitr-dt-palette-section{padding:8px 12px 2px;color:var(--dt-muted);font-size:.85em;text-transform:uppercase;letter-spacing:.05em}\n.kitr-dt-palette-item{padding:0 12px;min-height:var(--dt-hit);cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:8px}\n.kitr-dt-palette-item:hover,.kitr-dt-palette-item-active{background:var(--dt-surface-2)}\n.kitr-dt-kbd{font:.85em var(--dt-font-mono);border:1px solid var(--dt-border);border-bottom-width:2px;border-radius:4px;padding:0 5px;color:var(--dt-muted);background:var(--dt-surface)}\n.kitr-dt-menu{position:absolute;z-index:2147483002;min-width:180px;background:var(--dt-bg);border:1px solid var(--dt-border);border-radius:var(--dt-radius);box-shadow:var(--dt-shadow);padding:4px}\n.kitr-dt-menu-item{display:flex;align-items:center;gap:8px;width:100%;min-height:var(--dt-hit);padding:0 10px;background:none;border:0;border-radius:6px;color:var(--dt-fg);font:inherit;text-align:left;cursor:pointer}\n.kitr-dt-menu-item:hover{background:var(--dt-surface-2)}\n.kitr-dt-masked{display:inline-flex;align-items:center;gap:6px;font-family:var(--dt-font-mono)}\n@media (prefers-reduced-motion:reduce){.kitr-dt *{transition:none!important;animation:none!important}}\n\n.kitr-dt-sticky{position:sticky;top:0;z-index:1;background:var(--dt-bg);margin:0 -12px;padding:0 12px 4px}\n.kitr-dt-sep{width:1px;height:16px;background:var(--dt-border);flex:none;margin:0 4px}\n.kitr-dt-letter{display:inline-flex;align-items:center;justify-content:center;width:14px;height:14px;border-radius:4px;background:var(--dt-surface-2);color:var(--dt-muted);font:600 9px/1 var(--dt-font-ui);flex:none}\n@media (max-width:640px),(pointer:coarse) and (max-height:500px){\n.kitr-dt-ms{display:none}\n.kitr-dt-row-line{flex-wrap:wrap}\n.kitr-dt-row-line>.kitr-dt-row-head{flex-basis:100%;padding-left:0}\n.kitr-dt-label{white-space:normal;word-break:break-word}\n.kitr-dt-header .kitr-dt-btn-icon{width:36px}\n.kitr-dt-tab{padding:0 8px}\n.kitr-dt-tab:not(.kitr-dt-tab-active) .kitr-dt-tab-label{display:none}\n}\n";
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
