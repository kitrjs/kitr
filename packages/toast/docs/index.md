---
title: Toast
description: Show short messages like "Saved" or "Could not send" from anywhere in your app, even outside React.
order: 1
---

# Toast

A toast is a short message that appears for a few seconds and then goes away: "Invoice saved", "Could not send", "You are offline". `@kitr/toast` gives you one `toast()` function to call from anywhere in the app, and a provider that draws the messages with [sonner](https://sonner.emilkowal.ski).

> [!SUMMARY]
> One `toast()` function to call from anywhere, drawn by sonner and following the theme. Add it with `kitr add toast`; the overview is at [/packages/toast](/packages/toast).

`toast` itself imports nothing. Until the provider boots, and in any place without one, such as a test or a script, every call goes to the console instead. That is what lets other packages and plain modules call it safely.

This guide follows Acme's dashboard at `app.acme.com`: Ada shows a toast when Grace saves an invoice, a loading toast while one is sent, and an error toast when a payment fails.

## Install

```sh
kitr add toast
```

<details>
<summary>Everything <code>kitr add</code> changes</summary>

What `kitr add` does:

- Adds [react](/packages/react) first if the project does not have it, because toast requires it.
- Installs `@kitr/toast`, which brings `sonner` with it.
- Adds `'@kitr/toast'` to `packages` and `() => import('@kitr/toast/provider')` to `providers` in `kitrrc.ts`.
- Writes `config/toast.ts` (shown under Configure).
- Adds a `toast` section to `AGENTS.md`: call `toast` from `@kitr/toast`, never render a second toaster, and keep the options in `config/toast.ts`.
- Adds no environment variables and no scripts.

`kitr add` skips `config/toast.ts` when it already exists. It asks no questions; `--no-install` skips the package manager and `--dry-run` prints the plan.

```sh
kitr add toast --dry-run
```

The `app`, `fullstack`, `saas`, `realtime`, `desktop`, `tauri` and `mobile` kits include toast. The `site`, `server` and `blank` kits do not.

`kitr remove toast` removes the provider, the `packages` entry, the dependency, `config/toast.ts` and the `AGENTS.md` section. Calls to `toast` left in your code keep compiling only while the package is installed, so remove them first.

</details>

## Configure

`kitr add toast` writes this file:

```ts
// config/toast.ts
import { defineConfig } from '@kitr/toast'

export default defineConfig({
  position: 'bottom-right',
  richColors: true,
})
```

| Option | Default | Description |
| --- | --- | --- |
| `position` | `'bottom-right'` | Where toasts appear: `'top-left'`, `'top-center'`, `'top-right'`, `'bottom-left'`, `'bottom-center'` or `'bottom-right'`. |
| `richColors` | `true` | Green success, red error, blue info and yellow warning toasts. `false` draws them all in the neutral colours. |
| `duration` | `4000` | How long a toast stays, in milliseconds. |
| `closeButton` | `false` | Show a close button on every toast. |

The config is read once, when the app is created. Each call can still pass its own `duration`, as shown below.

## Show a toast

`toast` takes a message. Its methods pick the kind:

```tsx
// app/components/invoices/save-invoice-button.tsx
import { toast } from '@kitr/toast'

export function SaveInvoiceButton({ id }: { id: string }) {
  async function save() {
    await fetch(`/api/invoices/${id}`, { method: 'PUT' })
    toast.success(`Invoice ${id} saved`)
  }
  return (
    <button type="button" onClick={save}>
      Save
    </button>
  )
}
```

| Call | Shows |
| --- | --- |
| `toast(message, options?)` | A plain toast. |
| `toast.success(message, options?)` | A green toast with a check mark. |
| `toast.info(message, options?)` | A blue toast. |
| `toast.warning(message, options?)` | A yellow toast. |
| `toast.error(message, options?)` | A red toast. |
| `toast.promise(promise, { loading, success, error })` | A loading toast that turns into success or error when the promise settles. |
| `toastError(error, fallback?)` | `toast.error` with the error's message. |

`options` go straight to sonner. The ones you will use most are a second line and a longer stay:

```ts
// app/lib/invoices/notify.ts
import { toast } from '@kitr/toast'

export function invoiceOverdue(id: string, days: number) {
  toast.warning(`Invoice ${id} is overdue`, {
    description: `Grace has not paid for ${days} days.`,
    duration: 10_000,
  })
}
```

## Write messages people can act on

A toast is read in a second, often out of the corner of the eye. Say what happened to what, in a few words, and put any detail in `description`. Name the thing ("Invoice INV-1042 sent"), not the action ("Success"). For an error, say what the person can do next, not what went wrong inside the app:

```ts
// Good: names the invoice, and the error says what to do
toast.success('Invoice INV-1042 sent')
toast.error('Could not send INV-1042', { description: 'Check the email address and try again.' })

// Hard to use: no subject, and an error nobody can act on
toast.success('Done!')
toast.error('Error 500: ECONNRESET')
```

Toasts are announced to screen readers as they appear, so the same rule helps people who never see them.

## Show progress with a promise

`toast.promise` shows a loading toast while a slow request runs, then swaps it for the result. It returns the same promise, so you can still await it:

```ts
// app/lib/invoices/send-invoice.ts
import { toast } from '@kitr/toast'

export function sendInvoice(id: string) {
  return toast.promise(fetch(`/api/invoices/${id}/send`, { method: 'POST' }), {
    loading: `Sending ${id} to grace@acme.com…`,
    success: `Invoice ${id} sent`,
    error: `Could not send ${id}`,
  })
}
```

```tsx
// app/components/invoices/send-button.tsx
import { sendInvoice } from '#app/lib/invoices/send-invoice'

export function SendButton({ id }: { id: string }) {
  return (
    <button type="button" onClick={() => sendInvoice(id)}>
      Send
    </button>
  )
}
```

## Show an error

`toastError` takes anything you caught and shows its `message`. Errors from kitr packages carry a message written for people, so this is usually all a catch block needs:

```ts
// app/lib/payments/charge.ts
import { toast, toastError } from '@kitr/toast'

export async function charge(invoiceId: string) {
  try {
    await fetch(`/api/invoices/${invoiceId}/charge`, { method: 'POST' }).then((r) => {
      if (!r.ok) throw new Error('Payment declined')
    })
    toast.success('Payment received')
  } catch (error) {
    toastError(error)
  }
}
```

When the thrown value has no `message`, such as a string, it shows the fallback instead: `'Something went wrong'`, or the one you pass.

```ts
toastError('timeout', 'The bank did not answer. Try again in a minute.')
```

## Add an action button

A toast can carry one button, such as an undo after a delete. Pass `action` with a label and what to do on click. The toast closes when the button is pressed:

```ts
// app/lib/invoices/archive.ts
import { toast } from '@kitr/toast'

export async function archiveInvoice(id: string) {
  await fetch(`/api/invoices/${id}/archive`, { method: 'POST' })
  toast(`Invoice ${id} archived`, {
    action: {
      label: 'Undo',
      onClick: () => fetch(`/api/invoices/${id}/unarchive`, { method: 'POST' }),
    },
  })
}
```

Keep the action short and safe to skip: toasts go away by themselves, so anyone who looks away a moment too long misses it. For a choice that matters, use a dialog instead.

## Update a toast in place

Give two calls the same `id` and the second replaces the first instead of stacking a new toast. This suits a long upload that reports its own progress:

```ts
// app/lib/files/upload-report.ts
import { toast } from '@kitr/toast'

export async function uploadReport(file: File) {
  toast(`Uploading ${file.name}…`, { id: 'report-upload', duration: Infinity })
  await fetch('/api/reports', { method: 'POST', body: file })
  toast.success(`${file.name} uploaded`, { id: 'report-upload', duration: 4000 })
}
```

`toast.promise` does the same for you when all you need is loading, done and failed. Reach for `id` when there are more steps in between, or when the same event can fire twice and should only show once, such as "You are offline".

## Show toasts outside React

`toast` is a plain function, so it works where hooks do not: a mutation callback, a store action, a router loader or another package.

```ts
// app/stores/cart.ts
import { create } from 'zustand'
import { toast } from '@kitr/toast'

export const useCart = create<{ items: string[]; add: (item: string) => void }>()((set) => ({
  items: [],
  add: (item) => {
    set((s) => ({ items: [...s.items, item] }))
    toast(`${item} added to the cart`)
  },
}))
```

With [query](/packages/query), show the result of a mutation from its callbacks:

```ts
// app/lib/orders/ship.ts
import { useMutation } from '@kitr/query'
import { toast, toastError } from '@kitr/toast'

export function useShipOrder() {
  return useMutation('orders.ship', {
    onSuccess: () => toast.success('Shipped'),
    onError: (error) => toastError(error),
  })
}
```

Until the provider has booted, such as in a script or a server-rendered pass, calls go to the console:

```ts
import { toast, toastError } from '@kitr/toast'

toast('Draft saved') // console.info('[toast] Draft saved')
toast.warning('Invoice inv_2 is overdue') // console.warn('[toast:warning] Invoice inv_2 is overdue')
toastError(new Error('Payment declined')) // console.error('[toast:error] Payment declined')
```

## Follow the theme

The toaster follows `data-theme` on `<html>`, which [theme](/packages/theme) sets. When Ada switches to dark mode, open toasts and new ones turn dark too. Without theme, toasts follow the operating system.

## Send toasts somewhere else

`setToastImplementation` replaces what `toast` calls. Give it a function with `success`, `error`, `info`, `warning` and `promise` methods. Do this to show toasts in your own component, or in a native notification on desktop:

```ts
// app/providers/notify-provider.ts
import { defineProvider } from '@kitr/kitr/app'
import { setToastImplementation } from '@kitr/toast'
import { notify } from '#app/components/notify'

export default defineProvider({
  name: 'notify',
  boot() {
    setToastImplementation(
      Object.assign((message: string) => notify({ tone: 'neutral', message }), {
        success: (message: string) => notify({ tone: 'success', message }),
        error: (message: string) => notify({ tone: 'danger', message }),
        info: (message: string) => notify({ tone: 'neutral', message }),
        warning: (message: string) => notify({ tone: 'warning', message }),
        promise: <T>(promise: Promise<T>) => promise,
      }),
    )
  },
})
```

List it after `@kitr/toast/provider` in `kitrrc.ts`, so it boots last and wins. `setToastImplementation(null)` goes back to the console.

## Errors

`toast` never throws, so a failing toast cannot break the code that called it. What can go wrong is where the message ends up:

| Symptom | Why | What to do |
| --- | --- | --- |
| Toasts show in the console, not on screen | The provider is not in `kitrrc.ts`, or the call ran before the app booted. | Run `kitr add toast`, or check `() => import('@kitr/toast/provider')` is listed in `providers`. |
| Two toasts appear for every call | A second `<Toaster />` from sonner is mounted by hand. | Remove it: the provider already mounts one. |
| Toasts stay light in dark mode | Something other than `data-theme` on `<html>` marks the theme. | Use [theme](/packages/theme), or set `data-theme="dark"` yourself. |

## Testing

Without the provider, toasts go to the console, so a test can spy on it. To assert on what was shown, set your own implementation and reset it after each test:

```ts
// app/lib/payments/charge.test.ts
import { setToastImplementation } from '@kitr/toast'
import { afterEach, expect, it, vi } from 'vitest'
import { charge } from './charge'

afterEach(() => setToastImplementation(null))

it('shows the error from a declined payment', async () => {
  const shown = Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    promise: vi.fn(),
  })
  setToastImplementation(shown)
  globalThis.fetch = vi.fn(async () => new Response(null, { status: 402 }))

  await charge('INV-1042')

  expect(shown.error).toHaveBeenCalledWith('Payment declined', undefined)
})
```

To see real toasts in a component test, boot an app with the provider and look for the text:

```tsx
// app/components/invoices/save-invoice-button.test.tsx
import toastProvider from '@kitr/toast/provider'
import { createTestApp, renderWithKitr } from '@kitr/testing/react'
import { act } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { SaveInvoiceButton } from './save-invoice-button'

it('tells Ada the invoice was saved', async () => {
  globalThis.fetch = vi.fn(async () => new Response(null))
  const app = await createTestApp({ providers: [toastProvider] })
  const screen = renderWithKitr(<SaveInvoiceButton id="INV-1042" />, { app })

  await act(async () => screen.getByRole('button', { name: 'Save' }).click())

  expect(await screen.findByText('Invoice INV-1042 saved')).toBeTruthy()
})
```

## Next steps

- [API reference](/packages/toast/api): every export of `@kitr/toast` and `@kitr/toast/provider`.
- [Theme](/packages/theme): dark mode the toaster follows.
- [sonner](https://sonner.emilkowal.ski): every toast option, such as `action` and `id`.
