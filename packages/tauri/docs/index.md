---
title: Tauri
description: Ship the same app to Windows, macOS and Linux as a small Tauri binary on the operating system's webview.
order: 1
---

# Tauri

Some desktop apps have to be small: a download of a few megabytes, a window that starts fast and idles on little memory. `@kitr/tauri` is a desktop platform for Windows, macOS and Linux built on [Tauri 2](https://v2.tauri.app/). It wraps the same `app/` you ship to the browser in a small Rust binary around the webview the operating system already has, and gives you typed calls from your components to Rust functions.

Tauri renders with the OS webview: WebView2 (Chromium-based) on Windows, WKWebView (Safari's engine) on macOS and WebKitGTK on Linux. Native code is Rust. kitr adds the platform on top: `kitr dev` runs the window with hot reload, `kitr build` builds installers through the Tauri CLI, `defineCommands` types every `#[tauri::command]` from TypeScript, `commandQuery` and `commandMutation` plug those commands into [Query](/packages/query), and `@kitr/tauri/provider` moves the [platform](/packages/platform) and [storage](/packages/storage) packages to their Tauri drivers.

`@kitr/tauri/client` and the provider run in the window, and in a plain browser, where they stand aside. The Rust project runs as the app's native process. For most desktop apps we recommend [Desktop](/packages/desktop) (Electron) instead, which ships its own browser engine so the app renders the same on every OS.

The examples on this page ship the Acme orders app to the desktop: Ada's warehouse team at Acme lists orders, exports invoices to disk and watches order sync progress, with the same code the browser runs at `app.acme.com`.

## When to use it

Use `@kitr/tauri` when download size, start-up time and memory matter more than identical rendering everywhere: an internal tool on old laptops, a tray utility, an app distributed over slow connections. Installers are a few megabytes because the browser engine is not inside them. Tauri's permission system also makes you list every native capability the window may use.

Use [Desktop](/packages/desktop) (Electron) for most other apps. Electron ships Chromium with the app, so the page your team tests is the page every user runs, while Tauri's three webviews can differ in CSS support, media codecs and Web APIs. Electron's native side is Node.js, with the larger community and ecosystem, where Tauri's is Rust and needs the Rust toolchain on every build machine. Both platforms load the same client build and register the same `platform` and `storage` drivers, so the app code does not change when you switch.

## Install

Building needs Rust and the system libraries Tauri uses. Follow [Tauri's prerequisites](https://v2.tauri.app/start/prerequisites/) for your OS first: Rust through `rustup` everywhere, the Xcode command line tools on macOS, the Microsoft C++ Build Tools and WebView2 on Windows, and `webkit2gtk` with a few other packages on Linux.

Then add a Tauri platform named `app`:

```sh
kitr add tauri app
```

`tauri` is the platform type and `app` is the name you address it by (`kitr dev app`). Without a name, `kitr add tauri` logs `No name given: calling the tauri platform "app".` and uses `app`. A name must be a short identifier: letters, digits, `-` and `_`, starting with a letter.

What `kitr add tauri app` does:

- Installs `@kitr/tauri` and adds it to `packages` in `kitrrc.ts`.
- Adds the packages the platform needs when they are missing, each with its own setup: [Router](/packages/router) (and [React](/packages/react) before it), [Platform](/packages/platform), which writes `config/platform.ts`, and [Storage](/packages/storage), which writes `config/storage.ts` and `app/storage.ts`.
- Installs `@tauri-apps/api` and `@tauri-apps/plugin-store`, and `@tauri-apps/cli` as a dev dependency.
- Adds `() => import('@kitr/tauri/provider')` to `providers` in `kitrrc.ts`.
- Writes `app: tauri({...})` into `platforms` in `kitrrc.ts`, with the flags you passed as options, and adds `import { tauri } from '@kitr/tauri'`.
- Sets the `dev`, `build` and `start` scripts in `package.json` to `kitr dev`, `kitr build` and `kitr start`.
- Writes the Rust project in `platforms/app/src-tauri/`: `tauri.conf.json`, `Cargo.toml`, `build.rs`, `src/main.rs`, `src/lib.rs` with a `greet` command, `capabilities/default.json`, `.gitignore` (ignoring `/target` and `/gen/schemas`) and `icons/README.md`. Files that already exist are kept.
- Writes `app/commands.ts`, the typed mirror of the Rust commands.
- Adds a `kitr: platform app` section to `AGENTS.md`: how to run and build, how to add a command, and where permissions go.

`@kitr/tauri` asks no questions. Platform options are flags on the same command, named as in the options table under Configure:

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

The `tauri` kit already has an `app` Tauri platform next to a `site` web platform, with a home page that calls a Rust command and listens to an event. Start a new project from it:

```sh
kitr new acme-orders --kit tauri
```

`kitr platforms remove app` takes the platform out of `kitrrc.ts`, and with the last Tauri platform also the `tauri` import and the provider line. It leaves `platforms/app/` for you to delete. `kitr remove tauri` does all of that for every Tauri platform, and takes `@kitr/tauri` out of `packages` and the dependencies; the `@tauri-apps/*` packages stay, so remove those yourself.

## Configure

`@kitr/tauri` has no config file in `config/`. Its options live on the `tauri()` call in `kitrrc.ts`:

```ts
// kitrrc.ts
import { defineKitrConfig } from 'kitr/app'
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
| `devtools` | `true` | Opens the webview inspector when `kitr dev` starts the window. `kitr dev` passes it as `KITR_DEVTOOLS`, which the scaffolded `src/lib.rs` reads in debug builds. Release builds never open it. |

Every option is written into the scaffolded files when you run `kitr add`, and the Tauri CLI reads those files, not `kitrrc.ts`. Changing an option later does not rewrite them: edit `tauri.conf.json`, which is yours, or delete it and run `kitr platforms scaffold app` to write it again. This includes `port`: if you change it, change `build.devUrl` too, or the window waits on the old port.

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

`frontendDist` points at this platform's client build, so `kitr build app` and `tauri build` agree on where the bundle is. Every other key is [Tauri's configuration](https://v2.tauri.app/reference/config/). The content security policy lets the window load the app's own files, talk to Rust over Tauri's IPC, and call `https:` and `wss:` APIs; Tauri adds hashes for the inline scripts in the client build. Widen `connect-src` or `img-src` there if the app loads from elsewhere. The scaffolded Rust crate depends on `tauri`, `tauri-plugin-store`, `tauri-plugin-opener`, `tauri-plugin-process`, `serde` and `serde_json`, and the main window gets the `core:default`, `store:default`, `opener:default` and `process:default` permissions. The provider opens links through the opener plugin and quits through the process plugin, so `kitr add tauri` installs both JavaScript packages.

| Variable | Used for |
| --- | --- |
| `KITR_APP_<OPTION>` | Overrides one option for one run of the CLI: `KITR_APP_PORT=3300 kitr dev app`. The platform name is upper-cased. |
| `KITR_PLATFORM` | Set to `app` by `kitr dev` and `kitr build`, so the Vite plugin builds this platform into `dist/app`. |
| `TAURI_ENV_*` | Set by the Tauri CLI. The Vite plugin adds the prefix to `envPrefix` for Tauri platforms, so `import.meta.env.TAURI_ENV_PLATFORM` reads `darwin`, `windows` or `linux` in the window. |

Read or change one option from the command line with `kitr config app` (lists every option), `kitr config app minWidth 960` or `kitr config app minWidth --unset`. The other platform types each have their own guide: [Web](/packages/web), [Server](/packages/server), [Mobile](/packages/mobile) and [Desktop](/packages/desktop). [Platforms](/docs/platforms) lists them side by side.

## Open your first window

Tauri needs the app icons listed in `tauri.conf.json` before it compiles. When they are missing, `kitr dev app` and `kitr build app` write a placeholder `platforms/app/app-icon.png` (a rounded square) and run `tauri icon` on it. Replace it with your own 1024×1024 PNG whenever you like:

```sh
cd platforms/app
pnpm exec tauri icon ../../design/acme-orders-icon.png
cd ../..
```

The icons land in `platforms/app/src-tauri/icons/`. Run the platform:

```sh
kitr dev app
```

kitr starts Vite on port 3200, waits until it answers, then runs `tauri dev --no-watch` in `platforms/app`, pointing the window at that port. `kitr dev app --port 3300` and `KITR_APP_PORT=3300` move both Vite and the window; `devUrl` in `tauri.conf.json` is only the default. The first run compiles the Rust crate and its dependencies, which takes a few minutes; later runs take seconds. The window opens on your app and updates in place when you edit a component. With `--no-watch`, Tauri does not rebuild when Rust files change: stop and run `kitr dev app` again after editing `src-tauri`.

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

A command is a Rust function marked `#[tauri::command]` and listed in `generate_handler!`. It takes named arguments and returns anything [serde](https://serde.rs/) can serialise. Add one that lists orders by status:

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

Then declare it in `app/commands.ts`, with the same name and the TypeScript shape of its arguments and result:

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

`await commands.list_orders({ status: 'paid' })` resolves to `[{ id: 'ord_1042', customer: 'Ada', totalCents: 12000, status: 'paid' }]`. Three naming rules come from Tauri, and `defineCommands` follows them as they are:

- The command name is the Rust function name, snake_case: `list_orders`, not `listOrders`.
- Argument keys are the Rust parameter names in camelCase: `invoice_id: String` in Rust is `{ invoiceId }` in TypeScript.
- Result fields are what serde writes. Add `#[serde(rename_all = "camelCase")]` to the struct, as above, to get `totalCents` instead of `total_cents`.

A command with no arguments is declared as `() => T` and called with no argument: `commands.sync_orders()`. The type in `app/commands.ts` is a promise you make by hand: TypeScript cannot read Rust, so a renamed Rust parameter compiles on both sides and fails at run time. Change both files in the same commit.

## Return an error from Rust

Return `Result<T, String>` (or any error type that implements `Serialize`) and the promise in the window rejects with the error value. Async commands run off the main thread, which suits file and network work; they must take owned arguments (`String`, not `&str`):

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

This example uses [reqwest](https://docs.rs/reqwest), which you add with `cargo add reqwest` in `platforms/app/src-tauri`. In the window, catch the rejection like any other:

```ts
// app/features/invoices/export.ts
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

The rejected value is the Rust error as serialised, a plain string here, not an `Error` object, so read it with `String(error)` rather than `error.message`.

## Read a command with a query

To cache a command's result, share it between components and refresh it after a change, wrap it with `commandQuery(command, name)` and pass the result to `queryFrom` from [Query](/packages/query):

```ts
// app/features/orders/queries.ts
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
import { ordersByStatus } from '#app/features/orders/queries'

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

The page lists `Ada: $120.00`. `commandQuery` builds the contract: the cache key is `['tauri', name, input]` (here `['tauri', 'list_orders', { status: 'paid' }]`), `fetch` calls the command, and `source` is `'tauri'` for devtools. Pass the Rust name as the second argument, because a function from `defineCommands` does not know its own name.

## Change data with a mutation

`commandMutation(command, { effects })` does the same for commands that change something. Start with the Rust command:

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

Then wrap it. The effects say which cached queries to refresh when it succeeds:

```ts
// app/features/orders/mutations.ts
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
// app/features/orders/ship-button.tsx
import { useMutation } from '@kitr/query'
import { shipOrder } from './mutations'

export function ShipButton({ id }: { id: string }) {
  const ship = useMutation(shipOrder)
  return (
    <button type="button" disabled={ship.isPending} onClick={() => ship.mutate({ id, carrier: 'UPS' })}>
      {ship.isPending ? 'Shipping…' : 'Ship order'}
    </button>
  )
}
```

When `ship_order` resolves, every `list_orders` query refetches, because invalidation matches the key prefix `['tauri', 'list_orders']`. `effects` also takes a function of the result and input, as in Query's own [mutation effects](/packages/query). When the Rust command returns `Err`, `ship.error` holds it as a `KitrError` and nothing is invalidated.

## Listen to events from Rust

Rust pushes events to the window with `emit`, for progress, background results or menu clicks. Event names may contain letters, digits, `-`, `/`, `:` and `_`, so use `orders-sync-progress` rather than dots:

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

In a component, `useTauriEvent(event, handler)` subscribes for as long as the component is mounted and passes each event's payload to the handler:

```tsx
// app/features/orders/sync-progress.tsx
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

Clicking "Sync orders" moves the bar to 25, 50, 75 and 100. The hook re-subscribes when `event` or `handler` changes, so pass a stable handler: wrap it in `useCallback`, as above, or define it outside the component. Don't pass an inline arrow function, which unsubscribes and subscribes again on every render and can miss events in between. Outside Tauri the hook does nothing.

## Send events to Rust

`emitTauri(event, payload)` sends an event to the Rust side and to every window. Use it for things the window reports and does not wait on. In a plain browser it resolves and does nothing.

```ts
// app/features/orders/opened.ts
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

When the window needs an answer, use a command instead: `emitTauri` returns nothing from Rust.

## Keep the web build working

The same `app/` ships to the browser through your web platform, where there is no Tauri runtime. `isTauri()` returns `true` only inside a Tauri webview (it checks for `window.__TAURI_INTERNALS__`). In a browser:

| Call | Outside Tauri |
| --- | --- |
| `isTauri()` | `false` |
| `commands.<name>()` | Rejects, because `@tauri-apps/api` finds no Tauri runtime. |
| `useTauriEvent()` | Does nothing. |
| `emitTauri()` | Resolves to `undefined` and sends nothing. |
| The provider | Registers no drivers; the web defaults stay. |

So guard command calls, and offer the web alternative next to them:

```tsx
// app/features/invoices/export-button.tsx
import { isTauri } from '@kitr/tauri/client'
import { exportInvoice } from './export'

export function ExportButton({ invoiceId }: { invoiceId: string }) {
  if (!isTauri()) return <a href={`/api/invoices/${invoiceId}.pdf`} download>Download invoice</a>
  return (
    <button type="button" onClick={() => void exportInvoice(invoiceId, '/Users/ada/Documents')}>
      Export invoice
    </button>
  )
}
```

For behaviour that differs per platform but is not specific to Tauri, such as opening links or reading the app version, use the [platform service](/packages/platform) instead of `isTauri()`. It answers the same way in Electron and on phones. Don't import `@tauri-apps/api` at the top of shared modules either: `@kitr/tauri/client` loads it lazily, only when a command or event actually runs.

## Grant the window permissions

Tauri denies every plugin command the window has not been granted. Grants live in capability files in `platforms/app/src-tauri/capabilities/`; the scaffold writes one for the main window:

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

`core:default` covers events, windows and the app APIs the provider uses. `store:default` lets the storage driver read and write, and `opener:default` lets `platform.openExternal()` open web links. Your own `#[tauri::command]` functions need no entry: Tauri allows the app's commands by default. When the window calls a plugin command it was not granted, the promise rejects with a message naming the command and the permissions that would allow it; add one of those to `permissions`. The [capabilities guide](https://v2.tauri.app/security/capabilities/) covers scopes and per-window grants.

> **Warning**
> The scaffold sets `"csp": null` in `tauri.conf.json`, which turns off Tauri's content security policy so development works with any asset. Before you ship, set a [CSP](https://v2.tauri.app/security/csp/) that allows only your own origin and `https://app.acme.com`, and grant only the permissions the app uses. Every permission is reachable from any script that runs in the window.

## Add a Tauri plugin

Native features beyond the scaffold (dialogs, notifications, the file system, global shortcuts) come as [Tauri plugins](https://v2.tauri.app/plugin/). The Tauri CLI adds the Rust crate, registers it in `lib.rs`, installs the JavaScript package and adds the default permission in one step:

```sh
cd platforms/app
pnpm exec tauri add dialog
cd ../..
```

Then call the plugin's JavaScript API, guarded like any Tauri call:

```ts
// app/features/invoices/pick-folder.ts
import { isTauri } from '@kitr/tauri/client'

export async function pickExportFolder(): Promise<string | null> {
  if (!isTauri()) return null
  const { open } = await import('@tauri-apps/plugin-dialog')
  const folder = await open({ directory: true, title: 'Export invoices to…' })
  return typeof folder === 'string' ? folder : null
}
```

Import the plugin lazily, as above, so the web build never loads it. If `tauri add` cannot edit `lib.rs` because you changed its shape, it prints the line to add by hand.

## Keep data on the user's machine

Items you declare with [Storage](/packages/storage) persist through Tauri's [store plugin](https://v2.tauri.app/plugin/store/) in `kitr.json` in the app's data folder, not in the webview's `localStorage`, which some OSes clear. You declare and read them the same way as on the web:

```ts
// app/storage.ts
import { defineStorage } from '@kitr/storage'

export const ordersView = defineStorage('orders-view', {
  default: { status: 'open' as 'open' | 'paid' | 'shipped', pageSize: 25 },
})
```

The provider registers `tauriStoreDriver()`, which loads every value once at boot and saves each change to disk in the background. The scaffold already registers `tauri_plugin_store` in `lib.rs` and grants `store:default`; without either, the values live in memory only and every write logs `[@kitr/storage] tauri:store:` with the plugin's error.

On macOS, with `identifier: 'com.acme.orders'`, the file is `~/Library/Application Support/com.acme.orders/kitr.json`. Values are kept as strings; any other value another part of the app put in `kitr.json` is skipped on load. To keep kitr's items in another file, register the driver yourself with a provider of your own:

```ts
// app/providers/orders-store.ts
import { defineProvider } from 'kitr/app'
import { isTauri } from '@kitr/tauri/client'
import { tauriStoreDriver } from '@kitr/tauri/provider'

export default defineProvider({
  name: 'orders-store',
  register(app) {
    if (isTauri()) app.drivers.register('storage', tauriStoreDriver('acme-orders.json'), { priority: 20 })
  },
})
```

The registry keeps the driver with the highest priority, and the Tauri provider registers its own at the default, so priority `20` wins. Add `() => import('#app/providers/orders-store')` to `providers` in `kitrrc.ts`.

## Use the platform service in Tauri

The provider also registers a driver for [Platform](/packages/platform), so code that uses the platform service works in Tauri without an `isTauri()` check:

| Member | In Tauri |
| --- | --- |
| `type` | `'desktop'`, the same as Electron |
| `native`, `standalone` | `true` |
| `os` | `'macos'`, `'windows'`, `'linux'` or `'unknown'`, from the user agent |
| `appVersion()` | `version` from `tauri.conf.json`, through `@tauri-apps/api/app` |
| `openExternal(url)` | Opens the system browser through `@tauri-apps/plugin-opener`; falls back to `window.open()` when that package is missing |
| `exit()` | Exits through `@tauri-apps/plugin-process`; falls back to `window.close()` when that package is missing |
| `onAppState(fn)` | `true` when the page is visible, `false` when the window is minimised or hidden |

`kitr add` installs neither JavaScript package. The Rust side of the opener plugin is in the scaffold, so for links that open in the system browser install its JavaScript half:

```sh
pnpm add @tauri-apps/plugin-opener
```

For `exit()`, add the process plugin on both sides with `pnpm exec tauri add process` in `platforms/app`. Then:

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

It runs `vite build` (the client into `dist/app/client`), then `tauri build` in `platforms/app`, and logs `app: installers are in platforms/app/src-tauri/target/release/bundle`. With `"targets": "all"`, that folder holds `msi/` and `nsis/` on Windows, `macos/` (the `.app`) and `dmg/` on macOS, and `deb/`, `rpm/` and `appimage/` on Linux. The version is `version` in `tauri.conf.json`, written from `package.json` when you ran `kitr add`; keep the two in step.

For a faster build with debug symbols and the webview inspector, pass `--debug`:

```sh
kitr build app --debug
```

`tauri build --debug` puts the bundles in `target/debug/bundle` instead, although kitr's closing log line still names the `release` folder. The release build is optimised and takes longer the first time.

`kitr build app` passes only `--debug` to the Tauri CLI. For one bundle format or another target, build the client with kitr and run the Tauri CLI yourself:

```sh
KITR_PLATFORM=app pnpm exec vite build
cd platforms/app && pnpm exec tauri build --bundles dmg
```

Tauri builds for the OS it runs on. Use a CI runner per OS for the others, as [Tauri's distribution guide](https://v2.tauri.app/distribute/) describes.

## Run the production build locally

There is no `kitr start` step for Tauri. `kitr start app` logs `app: run the installed app or the binary in platforms/app/src-tauri/target/release` and exits. Run the binary from there, or install the bundle:

```sh
kitr build app
open "platforms/app/src-tauri/target/release/bundle/macos/Acme Orders.app"
```

That is the app your users get: the client from `dist/app/client` embedded in the binary, no dev server.

## Sign the installers

Unsigned apps trigger Gatekeeper on macOS and SmartScreen on Windows. The Tauri CLI signs during `tauri build` when it finds signing settings, and `kitr build` passes your environment through to it. On macOS that is the identity of a certificate in the keychain:

```sh
export APPLE_SIGNING_IDENTITY="Developer ID Application: Acme Inc (TEAMID1234)"
kitr build app
```

Notarization, Windows certificates and Linux signing have their own settings; see Tauri's [macOS](https://v2.tauri.app/distribute/sign/macos/), [Windows](https://v2.tauri.app/distribute/sign/windows/) and [Linux](https://v2.tauri.app/distribute/sign/linux/) signing guides. kitr adds no signing settings of its own.

> **Warning**
> Never commit certificates, private keys or their passwords. Keep them in your CI's secret store and set them only on the job that builds releases.

## Switch to Electron

The app code does not change between the two desktop platforms: both serve the same client build and register the same `platform` and `storage` drivers. What changes is the native side. Rust commands become IPC handlers in `platforms/app/main.ts`, and `commands.<name>()` calls become `ipc.invoke('<area>.<verb>')` from `@kitr/desktop/client`:

```sh
kitr platforms remove app
kitr add desktop app
```

Port each command to a handler as the [Desktop](/packages/desktop) guide shows, then remove `@kitr/tauri` as described under Install. Storage values do not move: Tauri's `kitr.json` and Electron's `kitr-storage.json` are separate files.

## Commands

`@kitr/tauri` adds no generators. The Tauri platform answers these commands:

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

The Tauri CLI works from `platforms/app` for everything else: `pnpm exec tauri icon`, `pnpm exec tauri add <plugin>`, `pnpm exec tauri info` (prints the toolchain and webview versions).

`kitr doctor` checks each Tauri platform and reports:

- an error for each missing package: `@tauri-apps/api`, `@tauri-apps/cli`, `@tauri-apps/plugin-store`, `@tauri-apps/plugin-opener`, `@tauri-apps/plugin-process`. Fix: `pnpm add <package>` (`-D` for the CLI).
- an error when `platforms/app/src-tauri/tauri.conf.json` is missing. Fix: `kitr platforms scaffold app`.
- an error when `cargo` is not on `PATH`: `app: the Rust toolchain (cargo) is not on PATH, and Tauri builds with it`. Fix: install Rust from [rustup.rs](https://rustup.rs) and open a new terminal.

For the system libraries and webview versions, run `pnpm exec tauri info`.

## Errors

| Message | When | What to do |
| --- | --- | --- |
| The Rust error value, such as `Could not save inv_2041: ...` | A command returned `Err`. The promise rejects with that value. | Handle it where you call the command; read it with `String(error)`. |
| A message naming a plugin command and the permissions that allow it | The window called a plugin command its capability does not grant. | Add one of the named permissions to `capabilities/default.json`. |
| A `TypeError` from `@tauri-apps/api` | A command ran outside Tauri, in a browser or a test without mocks. | Guard with `isTauri()`. In tests, use `mockIPC()`. |
| `Platform name "<name>" must be a short identifier (site, api, app, phone...)` | `kitr add tauri` got a name with spaces or symbols. | Use letters, digits, `-` and `_`. |
| `tauri has no option "<flag>" (options: port, title, width, height, minWidth, minHeight, appId, devtools)` | `kitr add tauri` got an unknown flag. | Use one of the listed options; names are camelCase. |
| `tauri dev --no-watch exited with code 1` | The Rust build failed or the window could not start. kitr logs it and keeps Vite running. | Read Cargo's output above it. A missing icon or system library is the usual cause; `pnpm exec tauri info` checks the toolchain. |
| `tauri build exited with code 1` | Compiling or bundling failed. | Read the output above it; generate icons with `tauri icon` if they are missing. |

## Testing

Unit tests run in Node or `happy-dom`, where there is no Tauri runtime. Tauri ships `mockIPC()` in [`@tauri-apps/api/mocks`](https://v2.tauri.app/develop/tests/mocking/) for this: it installs a fake runtime on `window`, routes every command to a function you write, and with `shouldMockEvents` delivers events too. `isTauri()` returns `true` while it is installed.

This test checks a command, the query built from it, an event reaching a component, and the platform driver:

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
import { ordersByStatus } from '#app/features/orders/queries'

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

Install the fake before the code under test runs. After each test, unmount components first (`cleanup()`), so `useTauriEvent` unsubscribes while the fake is still there, then call `clearMocks()`. `clearMocks()` empties `window.__TAURI_INTERNALS__` but leaves the object, so delete it too, or `isTauri()` stays `true` in the next test. The short wait inside `act` lets `useTauriEvent` finish subscribing before the event is emitted, because it loads the event API lazily. Test the Rust side with `cargo test` in `platforms/app/src-tauri`, and the real window with `kitr dev app`.

## Next steps

- [API reference](/packages/tauri/api)
- [Desktop](/packages/desktop): the recommended desktop platform, with Chromium in the app and Node.js IPC
- [Query](/packages/query): cache and refresh command results with `commandQuery` and `commandMutation`
- [Platform](/packages/platform): app version, external links, app state and exit on every platform
- [Platforms](/docs/platforms): every platform type and the commands they share
- [Tauri documentation](https://v2.tauri.app/start/)
