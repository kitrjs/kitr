---
title: API reference
description: Every export of kitr/shield, with its signature.
order: 2
---

# API reference

Every export of `kitr/shield`, `kitr/shield/provider`, read from the published type definitions. The [guide](/packages/shield) shows them in use.

## kitr/shield

### cors

```ts
function cors(options?: CorsOptions): Middleware;
```

Middleware that answers CORS preflights with 204 and adds `Access-Control-Allow-*` headers for allowed origins. Throws at once for `origin: '*'` with credentials.

### createMemoryRateLimitStore

```ts
function createMemoryRateLimitStore(): RateLimitStore;
```

The default rate-limit store: counters in this process, pruned past 10,000 keys. Each instance counts on its own.

### createRedisRateLimitStore

```ts
function createRedisRateLimitStore(redis: RedisRateLimitClient, options?: {
  prefix?: string;
}): RateLimitStore;
```

A rate-limit store over Redis, so every instance counts against the same limit. Each window
is one key that Redis expires itself, so nothing needs sweeping:

```ts
rateLimit: { store: createRedisRateLimitStore(new Redis(process.env.REDIS_URL)) }
```
Keys live under `prefix` (default `kitr:rl:`).

### csrf

```ts
function csrf(options?: CsrfOptions): Middleware;
```

Double-submit cookie CSRF: a readable cookie carries a token the browser must echo in a header
(`fetch` from another origin cannot read the cookie, so it cannot forge the header). kitr/http
sends the header automatically.

### rateLimit

```ts
function rateLimit(options?: RateLimitOptions): Middleware;
```

Fixed-window rate limit with `RateLimit-*` headers and a 429 when exceeded.

### securityHeaders

```ts
function securityHeaders(options?: HeadersOptions): Middleware;
```

Middleware that sets nosniff, frame, referrer, permissions, CSP and (in production) HSTS headers on every response, errors included.

### shield

```ts
function shield<S extends {
  use(middleware: Middleware): unknown;
  app?: {
    config: any;
    isProduction: boolean;
  };
}>(server: S, config?: ShieldConfig): S;
```

Attach the shield to a kitr server (or any object with `use(middleware)`), reading
`config/shield.ts`. Production (HSTS, Secure cookies) follows the app's mode, so a Workers or
Deno deployment that never sets `NODE_ENV` still gets production defaults from the build.

### shieldMiddlewares

```ts
function shieldMiddlewares(config?: ShieldConfig): Middleware[];
```

The middlewares `config/shield.ts` asks for, in the right order.

### DEFAULT_CSP

```ts
const DEFAULT_CSP = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' ws: wss:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'";
```

The Content-Security-Policy `securityHeaders()` sends when you don't set one: same-origin everything, inline scripts and styles allowed, no framing.

### defineConfig

```ts
const defineConfig: <const C extends ShieldConfig>(config: C) => C;
```

Type the default export of `config/shield.ts`. Returns its argument unchanged.

### CorsOptions

```ts
interface CorsOptions {
  /** `'*'`, a list of origins, or a predicate. Default: same-origin only (no header). */
  origin?: '*' | string[] | ((origin: string) => boolean);
  /** Methods a preflight allows. Default GET, POST, PUT, PATCH, DELETE, OPTIONS. */
  methods?: string[];
  /** Request headers a preflight allows. Default Content-Type, Authorization, X-CSRF-Token, X-Requested-With. */
  headers?: string[];
  /** Let the browser send cookies cross-origin. Refused together with `origin: '*'`. Default false. */
  credentials?: boolean;
  /** Seconds a preflight answer may be cached. Default 600. */
  maxAge?: number;
}
```

Options for `cors()` and the `cors` key of `config/shield.ts`.

### CsrfOptions

```ts
interface CsrfOptions {
  /** Cookie that carries the token. Default `kitr-csrf`. */
  cookie?: string;
  /** Header the client sends it back in. Default `x-csrf-token`. */
  header?: string;
  /** Methods that need a token. Default POST, PUT, PATCH and DELETE. */
  methods?: string[];
  /** Paths that never need a token (webhooks). Prefix match. */
  ignore?: string[];
  /** Add `Secure` to the cookie. Default: `production`. */
  secure?: boolean;
  /** Whether this is a production process. `shield(server)` fills it from the app's mode; standalone, `inProduction()` from `@kitr/core` decides. */
  production?: boolean;
}
```

Options for `csrf()` and the `csrf` key of `config/shield.ts`.

### HeadersOptions

```ts
interface HeadersOptions {
  /** `Content-Security-Policy`. A string, or false to leave it out. Default: a strict policy for an SPA/SSR app. */
  contentSecurityPolicy?: string | false;
  /** `Strict-Transport-Security` max-age in seconds; false to leave it out. Default one year in production. */
  hsts?: number | false;
  /** `X-Frame-Options`. Default `DENY`; false to leave it out. */
  frameOptions?: 'DENY' | 'SAMEORIGIN' | false;
  /** `Referrer-Policy`. Default `strict-origin-when-cross-origin`; false to leave it out. */
  referrerPolicy?: string | false;
  /** `Permissions-Policy`. Default `camera=(), microphone=(), geolocation=()`; false to leave it out. */
  permissionsPolicy?: string | false;
  /** Whether this is a production process, which turns HSTS on. `shield(server)` fills it from the app's mode; standalone, `inProduction()` from `@kitr/core` decides. */
  production?: boolean;
}
```

Options for `securityHeaders()` and the `headers` key of `config/shield.ts`.

### RateLimitOptions

```ts
interface RateLimitOptions {
  /** Window length in milliseconds. Default 60 000. */
  windowMs?: number;
  /** Requests per key per window. Default 100. */
  max?: number;
  /** Key a request. Default: the client IP. */
  key?: (event: H3Event) => string;
  /**
   * Read the client IP from `X-Forwarded-For` (first entry). Only turn this on behind a proxy
   * you control that overwrites the header: otherwise any client can send a new value with every
   * request and is never limited. Default false: the address of the connection.
   */
  trustProxy?: boolean;
  /** Where counters live. Default: this process, so each instance counts on its own; use `createRedisRateLimitStore` to share one limit. */
  store?: RateLimitStore;
  /** Paths that are never limited. Prefix match. */
  ignore?: string[];
}
```

Options for `rateLimit()` and the `rateLimit` key of `config/shield.ts`.

### RateLimitStore

```ts
interface RateLimitStore {
  /** Increment and return the count and when the window resets (ms epoch). */
  hit(key: string, windowMs: number): Promise<{
    count: number;
    resetAt: number;
  }>;
}
```

Where rate-limit counters live. Implement it over Redis to share limits between instances.

### RedisRateLimitClient

```ts
interface RedisRateLimitClient {
  /** `SET key value PX ms NX`: starts a window only when none is open. */
  set(key: string, value: string, px: 'PX', ms: number, nx: 'NX'): Promise<unknown>;
  /** `INCR`: keeps the key's expiry. */
  incr(key: string): Promise<number>;
  /** `PTTL`: milliseconds left on the window. */
  pttl(key: string): Promise<number>;
  /** `PEXPIRE`: repairs a counter that lost its window. */
  pexpire(key: string, ms: number): Promise<number>;
}
```

The part of an [ioredis](https://github.com/redis/ioredis) client the Redis rate-limit store
uses. An ioredis `Redis` or `Cluster` fits as it is.

### ShieldConfig

```ts
interface ShieldConfig {
  /** Security headers. On unless false. */
  headers?: HeadersOptions | false;
  /** CORS. Off unless set to an object. */
  cors?: CorsOptions | false;
  /** Double-submit cookie CSRF. On unless false. */
  csrf?: CsrfOptions | false;
  /** Fixed-window rate limit. On unless false. */
  rateLimit?: RateLimitOptions | false;
}
```

The options in `config/shield.ts`. Each key takes its middleware's options, or false to turn it off.

## kitr/shield/provider

### shieldProvider

```ts
const shieldProvider: import("@kitr/core").KitrProvider;
```

Validates `config/shield.ts` at boot (refuses `origin: '*'` with credentials); `shield(server)` in server/main.ts attaches the middleware.

<!-- GENERATED by scripts/api-docs.mjs from the type definitions. Do not edit. -->
