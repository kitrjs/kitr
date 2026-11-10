# @kitr/kit-saas

## 0.9.2

### Patch Changes

- @kitr/core@0.9.2

## 0.9.1

### Patch Changes

- @kitr/core@0.9.1

## 0.9.0

### Patch Changes

- Updated dependencies [a69b7b0]
  - @kitr/core@0.9.0

## 0.8.0

### Patch Changes

- @kitr/core@0.8.0

## 0.7.0

### Patch Changes

- ff8f972: A kit's `kitr` block can carry a `kit` object: who the kit is for, three to five highlights, the preset's base kit, where its example output lives, the file to read first and the commands to run. `kitr package:check` validates it and `KitrKitInfo` types it. Every official kit now describes itself this way, and its homepage is its page on kitr.dev/kits.
- @kitr/core@0.7.0

## 0.6.0

### Patch Changes

- @kitr/core@0.6.0

## 0.5.0

### Patch Changes

- @kitr/core@0.5.0

## 0.4.0

### Patch Changes

- @kitr/core@0.4.0

## 0.3.2

### Patch Changes

- 7b49b7f: `kitr add` no longer writes demo values into real files. `kitr add storage` writes `app/storage.ts` with only `localeCookie` and a commented `defineStorage` example. `kitr add analytics` writes an empty `AppEvents` in `app/analytics.ts` with two events as a comment, and `config/analytics.ts` now templates the cookieless Plausible adapter first (`VITE_PLAUSIBLE_DOMAIN`, optional `VITE_PLAUSIBLE_HOST`) and Google Analytics second (`VITE_GA_MEASUREMENT_ID`), all three declared in `app/env.ts`. With the consent package installed, the config says analytics is held until the visitor accepts. The `saas` kit declares the events its pages track.
- 3b07461: `kitr add testing` writes a real first test. With the starter home page, `test/home.test.tsx` renders it with `renderWithKitr` inside the app's providers and checks its heading. A React project without that page gets a test that boots the app, and a server-only project keeps the `/api/health` test. The `saas` and `site` kits, which replace the starter page, drop the starter's test with it.
- Updated dependencies [8904b74]
  - @kitr/core@0.3.2

## 0.3.1

### Patch Changes

- @kitr/core@0.3.1

## 0.3.0

### Patch Changes

- @kitr/core@0.3.0

## 0.2.1

### Patch Changes

- @kitr/core@0.2.1

## 0.2.0

### Minor Changes

- c7e8330: Initial release: the kitr framework, CLI, component registry and example kits.

### Patch Changes

- 3edf81d: `createDiscardTransport()` lets a production build boot without a mail provider: it drops every message and logs only the recipients and subject. The generated `config/mail.ts` picks it when `MAIL_TRANSPORT=discard`. The saas kit's `config/auth.ts` loads the typed API client lazily, so the plain-Node API server no longer crashes on `import.meta.env` at start.
- Updated dependencies [1206461]
- Updated dependencies [c7e8330]
- Updated dependencies [3edf81d]
  - @kitr/core@0.2.0
