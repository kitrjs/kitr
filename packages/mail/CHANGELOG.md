# @kitr/mail

## 0.4.0

### Patch Changes

- @kitr/core@0.4.0

## 0.3.2

### Patch Changes

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
- 3edf81d: `createDiscardTransport()` lets a production build boot without a mail provider: it drops every message and logs only the recipients and subject. The generated `config/mail.ts` picks it when `MAIL_TRANSPORT=discard`. The saas kit's `config/auth.ts` loads the typed API client lazily, so the plain-Node API server no longer crashes on `import.meta.env` at start.

### Patch Changes

- Updated dependencies [1206461]
- Updated dependencies [c7e8330]
- Updated dependencies [3edf81d]
  - @kitr/core@0.2.0
