---
title: API reference
description: Every export of kitr/devtools, with its signature.
order: 2
---

# API reference

Every export of `kitr/devtools`, `kitr/devtools/provider`, `kitr/devtools/ui`, read from the published type definitions. The [guide](/packages/devtools) shows them in use.

## kitr/devtools

### createDevtoolsHub

```ts
function createDevtoolsHub(options?: {
  maxEntries?: number;
}): DevtoolsHub$1;
```

The event bus and panel registry behind the overlay. The provider binds one per app in development;
create your own in tests to assert on what code logs. Keeps `maxEntries` (default 500) per channel.

### definePanel

```ts
function definePanel(panel: DevtoolsPanel$1): DevtoolsPanel$1;
```

Returns the panel unchanged, typed as a `DevtoolsPanel`. Use it in the module a provider's `devtools()` method imports.

### getDevtools

```ts
function getDevtools(app: KitrApp): DevtoolsHub | null;
```

The hub when devtools are active (development, client, `@kitr/devtools` added), else null.

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
  /** Runs when the button or palette entry is chosen. */
  run: (app: KitrApp) => MaybePromise<void>;
}
```

The devtools contract. Core only defines the shape; `@kitr/devtools` renders it.
Any provider can contribute by adding a `devtools(app)` method that returns panels.
Nothing here runs in production: the hub is only bound in development on the client.

### DevtoolsConfig

```ts
interface DevtoolsConfig {
  /** Default: development on the client. Set false to disable without removing the package. */
  enabled?: boolean;
  /** Where the trigger button sits. Default `bottom-left`. */
  position?: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';
  /** Keyboard shortcut, as `key` with ctrl/cmd+shift. Default `k`. */
  shortcutKey?: string;
  /** Entries kept per channel. Default 500. */
  maxEntries?: number;
  /** Open on first load. Default false. */
  openByDefault?: boolean;
}
```

Options for `config/devtools.ts`: whether the overlay is on, where its button sits, its shortcut and log size.

### DevtoolsEntry

```ts
interface DevtoolsEntry {
  /** Increasing id, unique for the page's lifetime. */
  id: number;
  /** The channel it was logged under, such as `http`, `analytics` or `logs`. */
  channel: string;
  /** `Date.now()` when it was logged. */
  time: number;
  /** Severity; the log view colours and filters by it. */
  level: 'debug' | 'info' | 'warn' | 'error';
  /** One-line summary shown in the list. */
  label: string;
  /** Anything extra, shown expanded under the line. */
  data?: unknown;
}
```

One line in the devtools log, recorded with `hub.log()`.

### DevtoolsHub

```ts
interface DevtoolsHub {
  /** Every registered panel, in tab order. */
  readonly panels: DevtoolsPanel[];
  /** Add a panel at runtime (providers normally use the `devtools()` method instead). */
  register(panel: DevtoolsPanel): () => void;
  /** Record an event (an HTTP request, an analytics call, a log line) under a channel. */
  log(channel: string, label: string, data?: unknown, level?: DevtoolsEntry['level']): void;
  /** Logged entries, oldest first; pass a channel to filter. */
  entries(channel?: string): DevtoolsEntry[];
  /** Empty the log, or one channel of it. */
  clear(channel?: string): void;
  /** Notified on new entries, panel changes and `notify()`; the overlay re-renders. */
  subscribe(listener: () => void): () => void;
  /** Tell the overlay that something it shows (session, cache) changed. */
  notify(): void;
}
```

The devtools service bound as `devtools` in development on the client: panels plus a shared event log.

### DevtoolsPanel

```ts
interface DevtoolsPanel {
  /** Unique id; registering another panel with the same id replaces this one. */
  id: string;
  /** Tab label. */
  label: string;
  /** Text or count shown next to the tab label. Re-read on every render. */
  badge?: (app: KitrApp) => string | number | null | undefined;
  /** The panel body. Return a React node; devtools re-renders it when the hub changes. */
  render: (app: KitrApp) => KitrNode;
  /** Buttons in the panel header and entries in the command palette. */
  actions?: DevtoolsAction[];
}
```

A tab in the devtools window, contributed by a provider's `devtools(app)` method or `hub.register()`.

## kitr/devtools/provider

### devtoolsProvider

```ts
const devtoolsProvider: import("@kitr/core").KitrProvider;
```

Development only. Binds the `devtools` hub, collects every provider's `devtools()` panels
and mounts the overlay. In production `register`/`wrap` are no-ops, and the kitr Vite plugin
aliases this module away entirely so nothing of it ships.

## kitr/devtools/ui

### Badge

```ts
function Badge({ children, tone }: {
  children: ReactNode;
  tone?: 'ok' | 'warn' | 'error' | 'muted' | 'info';
}): import("react").JSX.Element;
```

A small pill for counts and states. `tone` picks the colour: ok, warn, error, muted or info.

### Button

```ts
function Button({ children, onClick, title }: {
  children: ReactNode;
  onClick: () => void;
  title?: string;
}): import("react").JSX.Element;
```

A small button in the overlay's style.

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
function LogList({ entries, empty }: {
  entries: DevtoolsEntry[];
  empty?: string;
}): import("react").JSX.Element;
```

A list of hub entries, newest last, with the data expandable.

### Toolbar

```ts
function Toolbar({ children }: {
  children: ReactNode;
}): import("react").JSX.Element;
```

A row of buttons, spaced like a panel's action bar.

### styles

```ts
const styles = "\n.kitr-dt{position:fixed;z-index:2147483000;font:12px/1.4 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:#e5e7eb}\n.kitr-dt *{box-sizing:border-box}\n.kitr-dt-trigger{position:fixed;z-index:2147483000;width:36px;height:36px;border-radius:999px;border:1px solid #374151;background:#111827;color:#a5b4fc;font:700 12px ui-monospace,monospace;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center}\n.kitr-dt-trigger:hover{background:#1f2937}\n.kitr-dt-trigger-badge{position:absolute;top:-4px;right:-4px;background:#ef4444;color:#fff;border-radius:999px;font-size:10px;min-width:16px;height:16px;padding:0 4px;display:flex;align-items:center;justify-content:center}\n.kitr-dt-panel{position:fixed;left:0;right:0;bottom:0;height:var(--kitr-dt-height,45vh);background:#0b1020;border-top:1px solid #1f2937;display:flex;flex-direction:column;box-shadow:0 -4px 24px rgba(0,0,0,.5)}\n.kitr-dt-resize{height:4px;cursor:ns-resize;background:transparent}\n.kitr-dt-resize:hover{background:#4f46e5}\n.kitr-dt-tabs{display:flex;align-items:center;gap:2px;padding:4px 8px;border-bottom:1px solid #1f2937;overflow-x:auto}\n.kitr-dt-tab{background:transparent;border:0;color:#9ca3af;padding:4px 10px;border-radius:6px;cursor:pointer;font:inherit;white-space:nowrap;display:flex;gap:6px;align-items:center}\n.kitr-dt-tab:hover{color:#e5e7eb;background:#111827}\n.kitr-dt-tab-active{color:#fff;background:#1f2937}\n.kitr-dt-spacer{flex:1}\n.kitr-dt-body{flex:1;overflow:auto;padding:10px 12px}\n.kitr-dt-stack{display:flex;flex-direction:column;gap:14px}\n.kitr-dt-h{margin:0 0 6px;font-size:12px;color:#c7d2fe;text-transform:uppercase;letter-spacing:.04em}\n.kitr-dt-muted{color:#6b7280}\n.kitr-dt-table{border-collapse:collapse;width:100%}\n.kitr-dt-table td{padding:3px 8px 3px 0;vertical-align:top;border-bottom:1px solid #111827}\n.kitr-dt-key{color:#93c5fd;white-space:nowrap}\n.kitr-dt-table td.kitr-dt-key{width:1%;padding-right:16px}\n.kitr-dt-string{color:#86efac}.kitr-dt-number{color:#fcd34d}.kitr-dt-boolean{color:#f0abfc}.kitr-dt-undefined,.kitr-dt-object{color:#9ca3af}.kitr-dt-error{color:#fca5a5}\n.kitr-dt-toggle{background:none;border:0;color:#9ca3af;cursor:pointer;font:inherit;padding:0;display:inline-flex;align-items:center;gap:2px}\n.kitr-dt-indent{padding-left:14px;border-left:1px solid #1f2937;margin-left:3px}\n.kitr-dt-pre{margin:0;white-space:pre-wrap;word-break:break-all;max-height:120px;overflow:auto;color:#d1d5db}\n.kitr-dt-btn{background:#1f2937;border:1px solid #374151;color:#e5e7eb;border-radius:5px;padding:2px 8px;cursor:pointer;font:inherit;display:inline-flex;align-items:center;gap:4px}\n.kitr-dt-btn:hover{background:#374151}\n.kitr-dt-toolbar{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:8px}\n.kitr-dt-input{background:#111827;border:1px solid #374151;color:#e5e7eb;border-radius:5px;padding:2px 8px;font:inherit;min-width:160px}\n.kitr-dt-badge{display:inline-block;border-radius:999px;padding:0 6px;font-size:10px;line-height:16px;background:#374151;color:#e5e7eb}\n.kitr-dt-badge-ok{background:#065f46;color:#d1fae5}.kitr-dt-badge-warn{background:#78350f;color:#fef3c7}.kitr-dt-badge-error{background:#7f1d1d;color:#fee2e2}.kitr-dt-badge-info{background:#1e3a8a;color:#dbeafe}\n.kitr-dt-log{display:flex;flex-direction:column}\n.kitr-dt-row{display:grid;grid-template-columns:90px 90px 1fr;gap:8px;padding:2px 0;border-bottom:1px solid #111827;align-items:start}\n.kitr-dt-row .kitr-dt-data{grid-column:3;padding-left:12px}\n.kitr-dt-time{color:#6b7280}.kitr-dt-channel{color:#a5b4fc}\n.kitr-dt-level-warn .kitr-dt-label{color:#fcd34d}.kitr-dt-level-error .kitr-dt-label{color:#fca5a5}.kitr-dt-level-debug .kitr-dt-label{color:#9ca3af}\n.kitr-dt-palette{position:fixed;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:flex-start;justify-content:center;padding-top:12vh;z-index:2147483001}\n.kitr-dt-palette-box{width:min(560px,90vw);background:#0b1020;border:1px solid #374151;border-radius:10px;overflow:hidden;color:#e5e7eb;font:13px ui-monospace,monospace}\n.kitr-dt-palette-box input{width:100%;background:#111827;border:0;border-bottom:1px solid #374151;color:#fff;padding:10px 12px;font:inherit;outline:none}\n.kitr-dt-palette-item{padding:8px 12px;cursor:pointer;display:flex;justify-content:space-between}\n.kitr-dt-palette-item:hover,.kitr-dt-palette-item-active{background:#1f2937}\n";
```

The overlay's stylesheet as a string. The overlay injects it; panel bodies can use its `kitr-dt-*` classes.

<!-- GENERATED by scripts/api-docs.mjs from the type definitions. Do not edit. -->
