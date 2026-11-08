---
title: Tauri
description: Ship the same app to Windows, macOS and Linux as a small Tauri binary on the operating system's webview.
order: 1
---

# Tauri

Some desktop apps have to be small: a download of a few megabytes, a window that starts fast and idles on little memory. `@kitr/tauri` is a desktop platform for Windows, macOS and Linux built on [Tauri 2](https://v2.tauri.app/). It wraps the same `app/` you ship to the browser in a small Rust binary around the webview the operating system already has, with typed calls from your components to Rust functions.

> [!SUMMARY]
> A small desktop app for Windows, macOS and Linux from the same `app/` as your web app. Add it with `kitr add tauri app`; the overview is at [/packages/tauri](/packages/tauri).

Tauri renders with the OS webview (WebView2 on Windows, WKWebView on macOS, WebKitGTK on Linux); native code is Rust. kitr adds `kitr dev` and `kitr build`, `defineCommands` to type every `#[tauri::command]`, `commandQuery` and `commandMutation` for [Query](/packages/query), and a provider that moves [platform](/packages/platform) and [storage](/packages/storage) to their Tauri drivers. The client helpers and provider stand aside in a plain browser.

The examples ship the Acme orders app to the desktop: Ada's warehouse team lists orders, exports invoices to disk and watches order sync progress.

## When to use it

Use `@kitr/tauri` when download size, start-up time and memory matter more than identical rendering everywhere: an internal tool on old laptops, a tray utility, an app on slow connections. Installers are a few megabytes because the browser engine is not inside them.

For most other apps use [Desktop](/packages/desktop) (Electron). It ships its own browser, so every user sees the page you tested; Tauri's webviews differ between systems. Your app code stays the same either way.

## Install

Building needs Rust and the system libraries Tauri uses. Follow [Tauri's prerequisites](https://v2.tauri.app/start/prerequisites/) for your OS first.

Then add a Tauri platform named `app`:

```sh
kitr add tauri app
```

`tauri` is the platform type and `app` is the name you address it by (`kitr dev app`). A name is letters, digits, `-` and `_`, starting with a letter. Without one, kitr uses `app`.

Platform options are flags on the same command:

```sh
kitr add tauri app --title "Acme Orders" --width 1280 --height 860 --appId com.acme.orders
```

| Flag | Default | Effect |
| --- | --- | --- |
| `--port` | `3200` | Dev server port the window loads from. |
| `--title` | the package name | Window title and product name. |
| `--width`, `--height` | `1200`, `800` | Initial window size. |
| `--minWidth`, `--minHeight` | | Smallest window size. |
| `--appId` | `com.example.<app>` | Reverse-DNS bundle identifier. |
| `--no-devtools` | | Don't open the webview inspector when `kitr dev` starts the window. |
| `--no-scaffold` | | Register the platform without writing `platforms/app/` or `app/commands.ts`. |
| `--no-install` | | Edit `package.json` without running the package manager. |
| `--dry-run` | | Print what would change. |

<details>
<summary>Everything kitr add changes</summary>

- Installs `@kitr/tauri` and adds it to `packages` in `kitrrc.ts`, with its provider.
- Adds the packages the platform needs when missing, each with its own setup: [Router](/packages/router) (and [React](/packages/react)), [Platform](/packages/platform) and [Storage](/packages/storage).
- Installs `@tauri-apps/api` and `@tauri-apps/plugin-store`, and `@tauri-apps/cli` as a dev dependency.
- Writes `app: tauri({...})` into `platforms` in `kitrrc.ts` with your flags.
- Sets the `dev`, `build` and `start` scripts to `kitr dev`, `kitr build` and `kitr start`.
- Writes the Rust project in `platforms/app/src-tauri/` (`tauri.conf.json`, `Cargo.toml`, `build.rs`, `src/main.rs`, `src/lib.rs` with a `greet` command, `capabilities/default.json`, `icons/README.md`). Existing files are kept.
- Writes `app/commands.ts`, the typed mirror of the Rust commands.
- Adds a `kitr: platform app` section to `AGENTS.md`.

It asks no questions. `kitr platforms remove app` takes the platform out of `kitrrc.ts` (and, for the last Tauri platform, the import and provider) but leaves `platforms/app/` for you to delete. `kitr remove tauri` does that for every Tauri platform and removes `@kitr/tauri`; the `@tauri-apps/*` packages stay.

</details>
The `tauri` kit has an `app` Tauri platform next to a `site` web platform, with a home page that calls a Rust command and listens to an event:

```sh
kitr new acme-orders --kit tauri
```

## Configure

`@kitr/tauri` has no config file in `config/`. Its options live on the `tauri()` call in `kitrrc.ts`:

```ts
// kitrrc.ts
import { defineKitrConfig } from '@kitr/kitr/app'
import { tauri } from '@kitr/tauri'
import { web } from '@kitr/web'

export default defineKitrConfig({
  packages: ['@kitr/react', '@kitr/router', '@kitr/platform', '@kitr/storage', '@kitr/web', '@kitr/tauri'],
  providers: [
    () => import('@kitr/platform/provider'),
    () => import('@kitr/storage/provider'),
    () => import('@kitr/web/provider'),
    () => import('@kitr/tauri/provider'),
  ],
  platforms: {
    site: web({ mode: 'spa' }),
    app: tauri({ title: 'Acme Orders', width: 1280, height: 860, appId: 'com.acme.orders' }),
  },
})
```

| Option | Default | Description |
| --- | --- | --- |
| `port` | `3200` | Port of the Vite dev server, and `build.devUrl` in `tauri.conf.json`. |
| `title` | the package name | Window title and `productName`. `acme-orders` becomes `Acme Orders`. Also names the Rust crate: `acme_orders`. |
| `width` | `1200` | Initial window width in pixels. |
| `height` | `800` | Initial window height in pixels. |
| `minWidth` | | Smallest width the user can resize to. |
| `minHeight` | | Smallest height the user can resize to. |
| `appId` | `com.example.<app>` | `identifier` in `tauri.conf.json`. The default lower-cases the title and keeps letters and digits: `Acme Orders` gives `com.example.acmeorders`. |
| `devtools` | `true` | Open the webview inspector in `kitr dev`. Never in release builds. |

> [!WARNING] Options are written once
> Options are written into the scaffolded files, and the Tauri CLI reads those files, not `kitrrc.ts`. Changing an option later does not rewrite them: edit `tauri.conf.json`, or delete it and run `kitr platforms scaffold app`. If you change `port`, change `build.devUrl` too.

With `title: 'Acme Orders'` and `appId: 'com.acme.orders'` in a project whose `package.json` has version `0.1.0`, the platform writes:

```json
// platforms/app/src-tauri/tauri.conf.json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "Acme Orders",
  "version": "0.1.0",
  "identifier": "com.acme.orders",
  "build": {
    "frontendDist": "../../../dist/app/client",
    "devUrl": "http://localhost:3200"
  },
  "app": {
    "windows": [
      {
        "title": "Acme Orders",
        "width": 1280,
        "height": 860
      }
    ],
    "security": {
      "csp": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' asset: http://asset.localhost data: blob: https:; font-src 'self' data:; connect-src 'self' ipc: http://ipc.localhost https: wss:"
    }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ]
  }
}
```

`frontendDist` points at this platform's client build; every other key is [Tauri's configuration](https://v2.tauri.app/reference/config/). The content security policy allows the app's own files and `https:` and `wss:` APIs; widen `connect-src` or `img-src` for other sources.

| Variable | Used for |
| --- | --- |
| `KITR_APP_<OPTION>` | Overrides one option for one run of the CLI: `KITR_APP_PORT=3300 kitr dev app`. The platform name is upper-cased. |
| `KITR_PLATFORM` | Set to `app` by `kitr dev` and `kitr build`, so the Vite plugin builds this platform into `dist/app`. |
| `TAURI_ENV_*` | Set by Tauri and readable in the app: `import.meta.env.TAURI_ENV_PLATFORM`. |

Read or change one option with `kitr config app` (lists every option), `kitr config app minWidth 960` or `kitr config app minWidth --unset`. [Platforms](/docs/platforms) lists the platform types side by side.

## Open your first window

Tauri needs the icons listed in `tauri.conf.json` before it compiles. When they are missing, `kitr dev app` and `kitr build app` write a placeholder and run `tauri icon` on it. Replace it with your own 1024×1024 PNG whenever you like:

```sh
cd platforms/app
pnpm exec tauri icon ../../design/acme-orders-icon.png
cd ../..
```

The icons land in `platforms/app/src-tauri/icons/`. Run the platform:

```sh
kitr dev app
```

kitr starts Vite on port 3200, then opens the Tauri window on it (`--port 3300` changes the port). The first run compiles Rust for a few minutes; later runs take seconds. After editing `src-tauri`, restart `kitr dev app`.

The scaffold wrote one Rust command and its typed mirror:

```rust
// platforms/app/src-tauri/src/lib.rs
/// Called from the app as `commands.greet({ name })` (app/commands.ts).
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {name}!")
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

```ts
// app/commands.ts
import { defineCommands } from '@kitr/tauri/client'

/** Mirrors the `#[tauri::command]` functions in platforms/app/src-tauri/src/lib.rs. */
export type Commands = {
  greet: (args: { name: string }) => string
}

/** `await commands.greet({ name })`: typed. Guard with `isTauri()` for web builds. */
export const commands = defineCommands<Commands>()
```

Call it from a component:

```tsx
// app/components/welcome.tsx
import { isTauri } from '@kitr/tauri/client'
import { useEffect, useState } from 'react'
import { commands } from '#app/commands'

export function Welcome() {
  const [greeting, setGreeting] = useState('Welcome to Acme Orders')
  useEffect(() => {
    if (isTauri()) void commands.greet({ name: 'Ada' }).then(setGreeting)
  }, [])
  return <h1>{greeting}</h1>
}
```

In the Tauri window the heading reads `Hello, Ada!`, computed in Rust. In the browser (`kitr dev site`) it stays `Welcome to Acme Orders`.

## Add a Rust command

A command is a Rust function marked `#[tauri::command]` and listed in `generate_handler!`. It takes named arguments and returns anything [serde](https://serde.rs/) can serialise:

```rust
// platforms/app/src-tauri/src/lib.rs
use serde::Serialize;

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct Order {
    id: String,
    customer: String,
    total_cents: u32,
    status: String,
}

#[tauri::command]
fn list_orders(status: String) -> Vec<Order> {
    vec![
        Order { id: "ord_1042".into(), customer: "Ada".into(), total_cents: 12000, status: "paid".into() },
        Order { id: "ord_1043".into(), customer: "Grace".into(), total_cents: 8000, status: "open".into() },
    ]
    .into_iter()
    .filter(|order| order.status == status)
    .collect()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![list_orders])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

Then declare it in `app/commands.ts` with the same name and the TypeScript shape of its arguments and result:

```ts
// app/commands.ts
import { defineCommands } from '@kitr/tauri/client'

export interface Order {
  id: string
  customer: string
  totalCents: number
  status: 'open' | 'paid' | 'shipped'
}

/** Mirrors the `#[tauri::command]` functions in platforms/app/src-tauri/src/lib.rs. */
export type Commands = {
  list_orders: (args: { status: Order['status'] }) => Order[]
  export_invoice: (args: { invoiceId: string; path: string }) => string
  ship_order: (args: { id: string; carrier: string }) => Order
  sync_orders: () => void
}

export const commands = defineCommands<Commands>()
```

`await commands.list_orders({ status: 'paid' })` resolves to `[{ id: 'ord_1042', customer: 'Ada', totalCents: 12000, status: 'paid' }]`. Three naming rules come from Tauri:

- The command name is the Rust function name, snake_case: `list_orders`.
- Argument keys are the Rust parameter names in camelCase: `invoice_id` is `{ invoiceId }`.
- Result fields are what serde writes. Add `#[serde(rename_all = "camelCase")]` to get `totalCents`.

A command with no arguments is declared `() => T`.

> [!WARNING] Keep both files in step
> The type in `app/commands.ts` is a promise you make by hand: TypeScript cannot read Rust, so a renamed Rust parameter compiles on both sides and fails at run time. Change both in the same commit.

## Return an error from Rust

Return `Result<T, String>` (or any error type that implements `Serialize`) and the promise in the window rejects with the error value. Async commands run off the main thread, which suits file and network work, and take owned arguments (`String`, not `&str`):

```rust
// platforms/app/src-tauri/src/lib.rs
#[tauri::command]
async fn export_invoice(invoice_id: String, path: String) -> Result<String, String> {
    let url = format!("https://app.acme.com/api/invoices/{invoice_id}.pdf");
    let bytes = reqwest::get(&url)
        .await
        .map_err(|e| e.to_string())?
        .bytes()
        .await
        .map_err(|e| e.to_string())?;
    let file = std::path::Path::new(&path).join(format!("{invoice_id}.pdf"));
    std::fs::write(&file, &bytes).map_err(|e| format!("Could not save {invoice_id}: {e}"))?;
    Ok(file.display().to_string())
}
```

This example uses [reqwest](https://docs.rs/reqwest) (`cargo add reqwest` in `platforms/app/src-tauri`). In the window, catch the rejection like any other:

```ts
// app/lib/invoices/export.ts
import { commands } from '#app/commands'

export async function exportInvoice(invoiceId: string, folder: string) {
  try {
    return { ok: true as const, path: await commands.export_invoice({ invoiceId, path: folder }) }
  } catch (error) {
    return { ok: false as const, message: String(error) }
  }
}
// exportInvoice('inv_2041', '/Users/ada/Documents') => { ok: true, path: '/Users/ada/Documents/inv_2041.pdf' }
// exportInvoice('inv_2041', '/Volumes/ReadOnly') => { ok: false, message: 'Could not save inv_2041: Read-only file system (os error 30)' }
```

The rejected value is the Rust error as serialised, a plain string here, so read it with `String(error)`, not `error.message`.

## Read a command with a query

To cache a command's result, share it between components and refresh it after a change, wrap it with `commandQuery(command, name)` and pass it to `queryFrom` from [Query](/packages/query):

```ts
// app/queries/orders.ts
import { queryFrom } from '@kitr/query'
import { commandQuery } from '@kitr/tauri/client'
import { commands } from '#app/commands'

export const ordersByStatus = queryFrom(commandQuery(commands.list_orders, 'list_orders'))
```

```ts
// app/routes.ts
r.page('/orders', { lazy: () => import('./pages/orders') })
```

```tsx
// app/pages/orders.tsx
import { useQuery } from '@kitr/query'
import { ordersByStatus } from '#app/queries/orders'

export default function OrdersPage() {
  const { data: orders, isPending, error } = useQuery(ordersByStatus.options({ status: 'paid' }))
  if (isPending) return <p>Loading orders…</p>
  if (error) return <p role="alert">{error.message}</p>
  return (
    <ul>
      {orders.map((order) => (
        <li key={order.id}>
          {order.customer}: ${(order.totalCents / 100).toFixed(2)}
        </li>
      ))}
    </ul>
  )
}
```

The page lists `Ada: $120.00`. The cache key is `['tauri', name, input]`. Pass the Rust name as the second argument, because a function from `defineCommands` does not know its own name.

## Change data with a mutation

`commandMutation(command, { effects })` does the same for commands that change something. The Rust command:

```rust
// platforms/app/src-tauri/src/lib.rs
#[tauri::command]
fn ship_order(id: String, carrier: String) -> Result<Order, String> {
    if carrier.is_empty() {
        return Err(format!("Pick a carrier before shipping {id}"));
    }
    // ... update the order in your local database or call https://app.acme.com/api
    Ok(Order { id, customer: "Ada".into(), total_cents: 12000, status: "shipped".into() })
}
```

Then wrap it. The effects name the cached queries to refresh on success:

```ts
// app/lib/orders/mutations.ts
import { mutationFrom } from '@kitr/query'
import { commandMutation } from '@kitr/tauri/client'
import { commands } from '#app/commands'

export const shipOrder = mutationFrom(
  commandMutation(commands.ship_order, {
    effects: { invalidate: [['tauri', 'list_orders']] },
  }),
)
```

```tsx
// app/components/orders/ship-button.tsx
import { useMutation } from '@kitr/query'
import { shipOrder } from '#app/lib/orders/mutations'

export function ShipButton({ id }: { id: string }) {
  const ship = useMutation(shipOrder)
  return (
    <button type="button" disabled={ship.isPending} onClick={() => ship.mutate({ id, carrier: 'UPS' })}>
      {ship.isPending ? 'Shipping…' : 'Ship order'}
    </button>
  )
}
```

When `ship_order` resolves, every `list_orders` query refetches, because invalidation matches the key prefix. `effects` also takes a function of the result and input, as in Query's [mutation effects](/packages/query). When Rust returns `Err`, `ship.error` holds it as a `KitrError` and nothing is invalidated.

## Listen to events from Rust

Rust pushes events to the window with `emit`, for progress, background results or menu clicks. Event names may contain letters, digits, `-`, `/`, `:` and `_`:

```rust
// platforms/app/src-tauri/src/lib.rs
use tauri::{AppHandle, Emitter};

#[tauri::command]
async fn sync_orders(app: AppHandle) -> Result<(), String> {
    for batch in 1..=4u32 {
        // ... upload one batch of orders to https://app.acme.com/api/orders/sync
        app.emit("orders-sync-progress", batch * 25).map_err(|e| e.to_string())?;
    }
    Ok(())
}
```

In a component, `useTauriEvent(event, handler)` subscribes while the component is mounted:

```tsx
// app/components/orders/sync-progress.tsx
import { useTauriEvent } from '@kitr/tauri/client'
import { useCallback, useState } from 'react'
import { commands } from '#app/commands'

export function SyncProgress() {
  const [percent, setPercent] = useState(0)
  useTauriEvent<number>('orders-sync-progress', useCallback((value: number) => setPercent(value), []))
  return (
    <div>
      <button type="button" onClick={() => void commands.sync_orders()}>Sync orders</button>
      <progress max={100} value={percent}>{percent}%</progress>
    </div>
  )
}
```

Clicking "Sync orders" moves the bar to 25, 50, 75 and 100. Outside Tauri the hook does nothing.

> [!WARNING] Pass a stable handler
> Wrap the handler in `useCallback` or define it outside the component. An inline arrow function resubscribes on every render and can miss events.

## Send events to Rust

`emitTauri(event, payload)` sends an event to the Rust side and every window, for things the window reports and does not wait on. In a plain browser it does nothing.

```ts
// app/lib/orders/opened.ts
import { emitTauri } from '@kitr/tauri/client'

export function reportOrderOpened(orderId: string) {
  return emitTauri('order-opened', { orderId })
}
// await reportOrderOpened('ord_1042') => undefined
```

Listen in Rust from the builder's `setup` hook. The payload arrives as a JSON string:

```rust
// platforms/app/src-tauri/src/lib.rs
use tauri::Listener;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            app.listen("order-opened", |event| {
                println!("[acme] order opened: {}", event.payload());
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![list_orders, export_invoice, ship_order, sync_orders])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
// reportOrderOpened('ord_1042') => prints [acme] order opened: {"orderId":"ord_1042"}
```

When the window needs an answer, use a command: `emitTauri` returns nothing from Rust.

## Keep the web build working

The same `app/` ships to the browser, where there is no Tauri runtime. `isTauri()` is `true` only inside a Tauri webview. In a browser:

| Call | Outside Tauri |
| --- | --- |
| `isTauri()` | `false` |
| `commands.<name>()` | Rejects, because `@tauri-apps/api` finds no Tauri runtime. |
| `useTauriEvent()` | Does nothing. |
| `emitTauri()` | Resolves to `undefined` and sends nothing. |
| The provider | Registers no drivers; the web defaults stay. |

Guard command calls, and offer the web alternative next to them:

```tsx
// app/components/invoices/export-button.tsx
import { isTauri } from '@kitr/tauri/client'
import { exportInvoice } from '#app/lib/invoices/export'

export function ExportButton({ invoiceId }: { invoiceId: string }) {
  if (!isTauri()) return <a href={`/api/invoices/${invoiceId}.pdf`} download>Download invoice</a>
  return (
    <button type="button" onClick={() => void exportInvoice(invoiceId, '/Users/ada/Documents')}>
      Export invoice
    </button>
  )
}
```

For behaviour that differs per platform but is not Tauri-specific, such as opening links or reading the app version, use the [platform service](/packages/platform). Don't import `@tauri-apps/api` at the top of shared modules: `@kitr/tauri/client` loads it lazily.

## Grant the window permissions

Tauri denies every plugin command the window has not been granted. Grants live in `platforms/app/src-tauri/capabilities/`; the scaffold writes one for the main window:

```json
// platforms/app/src-tauri/capabilities/default.json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Capabilities for the main window",
  "windows": ["main"],
  "permissions": ["core:default", "store:default", "opener:default"]
}
```

`core:default`, `store:default` and `opener:default` cover what the provider uses. Your own `#[tauri::command]` functions need no entry. A plugin call without permission rejects with a message naming the permission to add. See the [capabilities guide](https://v2.tauri.app/security/capabilities/).

> [!WARNING] Set a CSP before shipping
> The scaffold sets `"csp": null` in `tauri.conf.json`, which turns off Tauri's content security policy for development. Before you ship, set a [CSP](https://v2.tauri.app/security/csp/) that allows only your own origin and `https://app.acme.com`, and grant only the permissions the app uses. Every permission is reachable from any script in the window.

## Add a Tauri plugin

Native features beyond the scaffold (dialogs, notifications, the file system, global shortcuts) come as [Tauri plugins](https://v2.tauri.app/plugin/). The Tauri CLI adds the crate, registers it in `lib.rs`, installs the JavaScript package and adds the default permission:

```sh
cd platforms/app
pnpm exec tauri add dialog
cd ../..
```

Then call the plugin's JavaScript API, guarded like any Tauri call:

```ts
// app/lib/invoices/pick-folder.ts
import { isTauri } from '@kitr/tauri/client'

export async function pickExportFolder(): Promise<string | null> {
  if (!isTauri()) return null
  const { open } = await import('@tauri-apps/plugin-dialog')
  const folder = await open({ directory: true, title: 'Export invoices to…' })
  return typeof folder === 'string' ? folder : null
}
```

Import the plugin lazily, as above, so the web build never loads it. If `tauri add` cannot edit `lib.rs` because you changed its shape, it prints the line to add by hand.

## Run the device packages in Tauri

[Secure storage](/packages/secure-storage), [Notifications](/packages/notifications), [Files](/packages/files), [Updater](/packages/updater) and [Native](/packages/native) each have a Tauri driver built on the official plugins. The scaffold installs, registers and permits all of them, so you only call the kitr service:

| Package | Plugin (JavaScript and Rust) | Permissions in `capabilities/default.json` |
| --- | --- | --- |
| `secure-storage` | `@tauri-apps/plugin-stronghold`, `tauri-plugin-stronghold`; `keyring` and `rand` for the vault password | `stronghold:default` |
| `notifications` | `@tauri-apps/plugin-notification`, `tauri-plugin-notification` | `notification:default` |
| `files` | `@tauri-apps/plugin-dialog` and `plugin-fs`, `tauri-plugin-dialog` and `tauri-plugin-fs`; `plugin-opener` for `reveal()` | `dialog:default`, `fs:allow-read-file`, `fs:allow-write-file`, `fs:allow-stat`, `fs:allow-read-dir`, `opener:allow-open-path` (scoped to `$HOME/**`) |
| `updater` | `@tauri-apps/plugin-updater` and `plugin-process`, `tauri-plugin-updater` and `tauri-plugin-process` | `updater:default`, `process:default` |
| `native` | `@tauri-apps/plugin-clipboard-manager`, `plugin-os` and `plugin-opener`, with the matching crates | `clipboard-manager:allow-read-text`, `clipboard-manager:allow-write-text`, `os:default`, `opener:default` |

Each driver loads its plugin on first use. A missing package rejects with `E_DRIVER_UNAVAILABLE`, and a missing permission with Tauri's own error.

<details>
<summary>Design choices behind the drivers</summary>

- **Secure storage uses Stronghold, not the store plugin.** The store plugin keeps plain JSON, which is what `@kitr/storage` uses. Stronghold is an encrypted snapshot opened with a random secret that the scaffolded `kitr_vault_key` command keeps in the OS keyring. Every script in the window can call that command, so keep a strict `csp`.
- **Files stay inside what the person picked.** The scaffold grants read, write, stat and list on the fs plugin without a static scope; the dialog plugin adds each chosen path for the session.
- **The updater plugin is registered only when `tauri.conf.json` has `plugins.updater`.** It refuses to start without a public key, so `lib.rs` checks first. Add the key and endpoints (see [Updater](/packages/updater#use-it-in-electron-and-tauri)) and restart.

</details>

## Keep data on the user's machine

Items you declare with [Storage](/packages/storage) persist through Tauri's [store plugin](https://v2.tauri.app/plugin/store/) in `kitr.json` in the app's data folder, not the webview's `localStorage`, which some OSes clear. You declare and read them as on the web:

```ts
// app/storage.ts
import { defineStorage } from '@kitr/storage'

export const ordersView = defineStorage('orders-view', {
  default: { status: 'open' as 'open' | 'paid' | 'shipped', pageSize: 25 },
})
```

The provider's `tauriStoreDriver()` loads every value at boot and saves each change in the background. Without `tauri_plugin_store` in `lib.rs` or the `store:default` grant (the scaffold has both), values live in memory only and every write logs `[@kitr/storage] tauri:store:`.

On macOS, with `identifier: 'com.acme.orders'`, the file is `~/Library/Application Support/com.acme.orders/kitr.json`. To keep kitr's items in another file, register the driver yourself with a provider of your own:

```ts
// app/providers/orders-store.ts
import { defineProvider } from '@kitr/kitr/app'
import { isTauri } from '@kitr/tauri/client'
import { tauriStoreDriver } from '@kitr/tauri/provider'

export default defineProvider({
  name: 'orders-store',
  register(app) {
    if (isTauri()) app.drivers.register('storage', tauriStoreDriver('acme-orders.json'), { priority: 20 })
  },
})
```

The highest priority wins and the Tauri provider uses the default, so `20` wins. Add `() => import('#app/providers/orders-store')` to `providers` in `kitrrc.ts`.

## Use the platform service in Tauri

The provider also registers a driver for [Platform](/packages/platform), so platform-service code works in Tauri without an `isTauri()` check:

| Member | In Tauri |
| --- | --- |
| `type` | `'desktop'`, the same as Electron |
| `native`, `standalone` | `true` |
| `os` | `'macos'`, `'windows'`, `'linux'` or `'unknown'`, from the user agent |
| `appVersion()` | `version` from `tauri.conf.json`, through `@tauri-apps/api/app` |
| `openExternal(url)` | Opens the system browser through `@tauri-apps/plugin-opener`; falls back to `window.open()` when that package is missing |
| `exit()` | Exits through `@tauri-apps/plugin-process`; falls back to `window.close()` when that package is missing |
| `onAppState(fn)` | `true` when the page is visible, `false` when the window is minimised or hidden |

`kitr add` installs neither JavaScript package. For links that open in the system browser, install the opener plugin's JavaScript half: `pnpm add @tauri-apps/plugin-opener`. For `exit()`, run `pnpm exec tauri add process` in `platforms/app`. Then:

```tsx
// app/components/help-menu.tsx
import { usePlatform } from '@kitr/platform/react'

export function HelpMenu() {
  const platform = usePlatform()
  return (
    <nav>
      <button type="button" onClick={() => void platform.openExternal('https://status.acme.com')}>
        Service status
      </button>
      {platform.is('desktop') ? (
        <button type="button" onClick={() => void platform.exit()}>Quit Acme Orders</button>
      ) : null}
    </nav>
  )
}
```

In Tauri, "Service status" opens Ada's default browser and "Quit Acme Orders" ends the process. In the browser the first opens a new tab and the second is not rendered.

## Build installers

`kitr build app` builds the client, then the Rust binary and the installers for the machine you run it on:

```sh
kitr build app
```

It runs `vite build` (client into `dist/app/client`), then `tauri build` in `platforms/app`. With `"targets": "all"`, `src-tauri/target/release/bundle` holds `msi/` and `nsis/` on Windows, `macos/` and `dmg/` on macOS, and `deb/`, `rpm/` and `appimage/` on Linux. The version is `version` in `tauri.conf.json`, copied from `package.json` at `kitr add`; keep the two in step.

For a faster build with debug symbols and the webview inspector:

```sh
kitr build app --debug
```

Debug bundles land in `target/debug/bundle`, although kitr's closing log line names `release` either way.

`kitr build app` passes only `--debug` to the Tauri CLI. For one bundle format or another target, build the client with kitr and run the Tauri CLI yourself:

```sh
KITR_PLATFORM=app pnpm exec vite build
cd platforms/app && pnpm exec tauri build --bundles dmg
```

Tauri builds for the OS it runs on. Use a CI runner per OS for the others, as [Tauri's distribution guide](https://v2.tauri.app/distribute/) describes.

## Run the production build locally

`kitr start app` only logs where the binary is. Run it from `platforms/app/src-tauri/target/release`, or install the bundle:

```sh
kitr build app
open "platforms/app/src-tauri/target/release/bundle/macos/Acme Orders.app"
```

That is the app your users get: the client embedded in the binary, no dev server.

## Sign the installers

Unsigned apps trigger Gatekeeper on macOS and SmartScreen on Windows. The Tauri CLI signs during `tauri build` when it finds signing settings, and `kitr build` passes your environment through. On macOS that is a certificate identity in the keychain:

```sh
export APPLE_SIGNING_IDENTITY="Developer ID Application: Acme Inc (TEAMID1234)"
kitr build app
```

Notarization, Windows certificates and Linux signing have their own settings; see Tauri's [macOS](https://v2.tauri.app/distribute/sign/macos/), [Windows](https://v2.tauri.app/distribute/sign/windows/) and [Linux](https://v2.tauri.app/distribute/sign/linux/) guides.

> [!WARNING] Keep certificates secret
> Never commit certificates, private keys or their passwords. Keep them in your CI's secret store and set them only on the job that builds releases.

## Switch to Electron

The app code does not change between the two desktop platforms: both serve the same client build and register the same `platform` and `storage` drivers. Rust commands become IPC handlers in `platforms/app/main.ts`, and `commands.<name>()` calls become `ipc.invoke('<area>.<verb>')` from `@kitr/desktop/client`:

```sh
kitr platforms remove app
kitr add desktop app
```

Port each command to a handler as the [Desktop](/packages/desktop) guide shows. Storage values do not move: Tauri's `kitr.json` and Electron's `kitr-storage.json` are separate files.

## Commands

The Tauri platform answers these commands:

| Command | What it does |
| --- | --- |
| `kitr add tauri <name>` | Adds a Tauri platform: installs the Tauri packages, writes `platforms.<name>`, adds router, platform and storage, scaffolds `platforms/<name>/src-tauri/` and `app/commands.ts`. |
| `kitr dev <name>` | Starts Vite on `port` and runs `tauri dev --no-watch` in `platforms/<name>`. |
| `kitr build <name>` | Runs `vite build`, then `tauri build`. Flag: `--debug`. |
| `kitr start <name>` | Logs where the built binary is. Tauri has no start step. |
| `kitr config <name> [option] [value]` | Reads or sets an option in `kitrrc.ts`. `--unset` removes one. |
| `kitr platforms` | Lists every platform with its options. |
| `kitr platforms scaffold <name>` | Writes the scaffolded files that are missing. Existing files are kept. |
| `kitr platforms remove <name>` | Takes the platform out of `kitrrc.ts`, with its import and provider when it was the last Tauri platform. |

The Tauri CLI handles the rest from `platforms/app`: `pnpm exec tauri icon`, `pnpm exec tauri add <plugin>`, and `pnpm exec tauri info` (toolchain and webview versions, system libraries).

`kitr doctor` reports an error for each missing package (`@tauri-apps/api`, `cli`, `plugin-store`, `plugin-opener`, `plugin-process`; fix with `pnpm add <package>`), for a missing `tauri.conf.json` (`kitr platforms scaffold app`), and when `cargo` is not on `PATH` (install Rust from [rustup.rs](https://rustup.rs)).

## Errors

| Message | When | What to do |
| --- | --- | --- |
| The Rust error value, such as `Could not save inv_2041: ...` | A command returned `Err`. The promise rejects with that value. | Handle it where you call the command; read it with `String(error)`. |
| A message naming a plugin command and the permissions that allow it | The window called a plugin command its capability does not grant. | Add one of the named permissions to `capabilities/default.json`. |
| `@kitr/<package> has no tauri driver: @tauri-apps/plugin-<name> is not installed` (`E_DRIVER_UNAVAILABLE`) | A device package called a plugin whose JavaScript package is not in `package.json`. | Run the `npm install` line in the message; also add the crate, the `.plugin()` call and the permission. |
| A `TypeError` from `@tauri-apps/api` | A command ran outside Tauri, in a browser or a test without mocks. | Guard with `isTauri()`. In tests, use `mockIPC()`. |
| `Platform name "<name>" must be a short identifier (site, api, app, phone...)` | `kitr add tauri` got a name with spaces or symbols. | Use letters, digits, `-` and `_`. |
| `tauri has no option "<flag>" (options: port, title, width, height, minWidth, minHeight, appId, devtools)` | `kitr add tauri` got an unknown flag. | Use one of the listed options; names are camelCase. |
| `tauri dev --no-watch exited with code 1` | The Rust build failed or the window could not start. kitr logs it and keeps Vite running. | Read Cargo's output above it. A missing icon or system library is the usual cause; `pnpm exec tauri info` checks the toolchain. |
| `tauri build exited with code 1` | Compiling or bundling failed. | Read the output above it; generate icons with `tauri icon` if they are missing. |

## Testing

Unit tests run in Node or `happy-dom`, where there is no Tauri runtime. Tauri's `mockIPC()` from [`@tauri-apps/api/mocks`](https://v2.tauri.app/develop/tests/mocking/) installs a fake runtime on `window`, routes every command to a function you write, and with `shouldMockEvents` delivers events too. `isTauri()` is `true` while it is installed.

This test checks a command, its query, an event reaching a component, and the platform driver:

```tsx
// test/tauri.test.tsx
import { act, cleanup, renderHook } from '@testing-library/react'
import { clearMocks, mockIPC } from '@tauri-apps/api/mocks'
import { emit } from '@tauri-apps/api/event'
import { platformProvider } from '@kitr/platform/provider'
import { isTauri, useTauriEvent } from '@kitr/tauri/client'
import { tauriProvider } from '@kitr/tauri/provider'
import { createTestApp } from '@kitr/testing'
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { commands, type Order } from '#app/commands'
import { ordersByStatus } from '#app/queries/orders'

const orders: Order[] = [
  { id: 'ord_1042', customer: 'Ada', totalCents: 12000, status: 'paid' },
  { id: 'ord_1043', customer: 'Grace', totalCents: 8000, status: 'open' },
]

function fakeRust() {
  mockIPC(
    (cmd, args) => {
      if (cmd === 'list_orders') return orders.filter((o) => o.status === (args as { status: string }).status)
      if (cmd === 'plugin:app|version') return '2.4.0'
      throw new Error(`unexpected command ${cmd}`)
    },
    { shouldMockEvents: true },
  )
}

const onProgress = (set: (n: number) => void) => (n: number) => set(n)

afterEach(() => {
  cleanup()
  clearMocks()
  delete (window as any).__TAURI_INTERNALS__
})

describe('Acme Orders in Tauri', () => {
  it('calls list_orders and caches it under a tauri key', async () => {
    fakeRust()
    expect(isTauri()).toBe(true)
    expect(await commands.list_orders({ status: 'paid' })).toEqual([orders[0]])
    expect(ordersByStatus.key({ status: 'open' })).toEqual(['tauri', 'list_orders', { status: 'open' }])
    expect(await ordersByStatus.fetch({ status: 'open' })).toEqual([orders[1]])
  })

  it('delivers sync progress events to a component', async () => {
    fakeRust()
    const { result } = renderHook(() => {
      const [percent, setPercent] = useState(0)
      const [handler] = useState(() => onProgress(setPercent))
      useTauriEvent<number>('orders-sync-progress', handler)
      return percent
    })
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
      await emit('orders-sync-progress', 50)
    })
    expect(result.current).toBe(50)
  })

  it('answers the platform service as a desktop app', async () => {
    fakeRust()
    const app = await createTestApp({ providers: [tauriProvider, platformProvider] })
    const platform = app.container.use('platform')
    expect(platform.type).toBe('desktop')
    expect(platform.native).toBe(true)
    expect(await platform.appVersion()).toBe('2.4.0')
  })

  it('stays out of the way in a browser', () => {
    expect(isTauri()).toBe(false)
  })
})
```

Install the fake before the code under test runs. After each test, call `cleanup()`, `clearMocks()`, then delete `window.__TAURI_INTERNALS__`. Test the Rust side with `cargo test` in `platforms/app/src-tauri`.

## Next steps

- [API reference](/packages/tauri/api): every export with its signature.
- [Desktop](/packages/desktop): the Electron platform, with Chromium in the app.
- [Query](/packages/query): cache and refresh command results.
