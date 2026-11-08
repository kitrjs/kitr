---
'@kitr/uploads': minor
'@kitr/auth': minor
---

`mountUploads` and `uploads.mount()` serve a file as the type its bytes show (magic-byte sniffing for PNG, JPEG, GIF, WebP, AVIF, PDF, audio, video, ZIP and more), not the type the uploader declared. Without a signature, the declared type is used only if it is in the new `allowTypes` list (default `text/plain`, `text/csv`, `application/json`); everything else is `application/octet-stream`. Responses always carry `X-Content-Type-Options: nosniff`, and `Content-Disposition: attachment` unless the type is safe inline. New: `uploads.signedUrl(key, { expiresIn })` and `signedUrl()` / `verifySignedUrl()` (HMAC-SHA-256 through Web Crypto, `secret` in the config), `requireSigned`, an `authorize(access, file)` hook, `sniffType()`, `resolveServedType()`, and a `data` option on `servedFileHeaders()`. Files served through a link or an `authorize` check are `Cache-Control: private`. `@kitr/auth`: `createSessionController` takes `onSessionsRevoked(userId)`, called after sign-out-everywhere and password reset.
