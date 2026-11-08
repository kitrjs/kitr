---
title: Overview
description: Show short messages like "Saved" or "Could not send" from anywhere in your app, even outside React.
order: 0
---

# Toast

## What it is

`@kitr/toast` shows short messages that pop up and go away on their own: "Invoice saved", "Could not send". Call `toast()` from a component, an event handler or any plain module.

Runs in the browser. Outside a browser, or before the app has booted, every call goes to the console, so a package can call `toast` without depending on a UI.

## Install

```sh
kitr add toast
```

Adds `@kitr/toast`, its provider and `config/toast.ts`. Adds [react](/packages/react) first if missing. [Every change](/packages/toast/guide#install).

## Quick start

```tsx
// app/components/save-button.tsx
import { toast } from '@kitr/toast'

export function SaveButton() {
  return (
    <button type="button" onClick={() => toast.success('Invoice saved')}>
      Save
    </button>
  )
}
```

Click it and a green "Invoice saved" slides in at the bottom right, then fades out after four seconds. You don't mount anything: the provider does. Next in the guide: [Show a toast](/packages/toast/guide#show-a-toast).

## Built on

| Built on | Role |
| --- | --- |
| [sonner](https://sonner.emilkowal.ski) | Draws the toasts. |

kitr adds the provider that mounts the toaster, a `toast` you can call before React has rendered, `toastError` for caught errors, and dark mode that follows [theme](/packages/theme).

## Problems it solves

- **A different toast library in every project.** [Show a toast](/packages/toast/guide#show-a-toast).
- **Toasts only from inside components.** [Show toasts outside React](/packages/toast/guide#show-toasts-outside-react).
- **The same try/catch toast everywhere.** [Show an error](/packages/toast/guide#show-an-error).

## Further reading

- [Guide](/packages/toast/guide).
- [API reference](/packages/toast/api).
- [sonner](https://sonner.emilkowal.ski).
