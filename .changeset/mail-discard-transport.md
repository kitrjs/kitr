---
'@kitr/mail': minor
'@kitr/kit-saas': patch
---

`createDiscardTransport()` lets a production build boot without a mail provider: it drops every message and logs only the recipients and subject. The generated `config/mail.ts` picks it when `MAIL_TRANSPORT=discard`. The saas kit's `config/auth.ts` loads the typed API client lazily, so the plain-Node API server no longer crashes on `import.meta.env` at start.
