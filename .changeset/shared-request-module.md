---
'@kitr/core': minor
'@kitr/http': patch
'@kitr/api': patch
'@kitr/actions': patch
'@kitr/realtime': patch
---

New `@kitr/core/request` entry: the error envelope (`toEnvelope`, `fromEnvelope`), the query key factory (`keyFor`), abort plumbing (`linkSignals`, `timeoutSignal`) and header injection (`applyRequestHeaders`: bearer token, `kitr-csrf` echo, request id), shared by `http`, `api`, `actions` and `realtime` instead of four copies. Their public APIs are unchanged; `api` now also reads `{ error: { message } }` and `{ errors: [...] }` bodies from other backends, as `http` did. `definePackage` gains `generate`, a command `kitr generate` runs after the type generators.
