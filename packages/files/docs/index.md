---
title: Files
description: Let people open, save and pick files on any platform, with a download fallback in older browsers.
order: 1
---

# Files

`files.open()`, `files.pick()` and `files.save()` show the right dialog wherever the app runs: native dialogs through the mobile and desktop packages, the File System Access API in Chromium browsers, and a file input plus a download link everywhere else. Components call one API and never check the platform.

## Install

```sh
kitr add files
```

```ts
// config/files.ts
import { defineConfig } from 'kitr/files'

export default defineConfig({
  filters: [{ name: 'Project', extensions: ['myapp'] }], // added to every dialog
})
```

## In a component

```tsx
import { useFileDialogs, useDropFiles } from 'kitr/files/react'

function Editor({ doc }: { doc: string }) {
  const { pick, save, busy } = useFileDialogs()
  const drop = useDropFiles(async ([file]) => file && load(await file.text()))
  return (
    <div {...drop} data-over={drop.over}>
      <button disabled={busy} onClick={async () => { const f = await pick({ filters: [{ name: 'Markdown', extensions: ['md'] }] }); if (f) load(await f.text()) }}>Open</button>
      <button disabled={busy} onClick={() => save(doc, { name: 'notes.md' })}>Save</button>
    </div>
  )
}
```

A cancelled dialog resolves to `[]`, `null` or `null` respectively, never rejects. `PickedFile` gives `text()`, `bytes()` and `blob()`, plus `path` on platforms that expose one.

## Drivers

Platform packages register their dialogs under the `files` capability. Tests pass `createMemoryFilesDriver(queue)` in config and read `driver.saved`.
