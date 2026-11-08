---
'@kitr/auth': minor
---

Cookie sessions with a server. `createCookieSession` (HttpOnly, SameSite=Lax, Secure in production, HMAC-signed, sliding expiry, id rotation, revoke one or all), a `SessionStore` interface with memory, `@kitr/storage` and Redis stores, `hashPassword` and `verifyPassword` (scrypt, with a PBKDF2 fallback), the `UserProvider` contract, `createSessionController` (session, sign-in, sign-up, sign-out, email verification, password reset, CSRF) and `sessionMiddleware`. In the browser, `sessionAdapter` reads `GET /api/auth/session` through the query cache, and `ensureSession` makes `requireAuth()` and `can()` work in `beforeLoad` while a page renders on the server. The `auth` binding is now scoped so a request never sees another's session. `kitr add auth` asks `--provider token|session|better-auth` (default `token`, unchanged) and `--no-emails`.
