---
title: API reference
description: Every export of kitr/monitoring, with its signature.
order: 2
---

# API reference

Every export of `kitr/monitoring`, `kitr/monitoring/provider`, `kitr/monitoring/server`, read from the published type definitions. The [guide](/packages/monitoring/guide) shows them in use.

## kitr/monitoring

### consoleReporter

```ts
function consoleReporter(): Reporter;
```

Prints exceptions and messages to the console; ignores breadcrumbs and users. The provider's default in development.

### createMonitoring

```ts
function createMonitoring(config?: MonitoringConfig): Monitoring;
```

Create the monitoring service without the provider: for server-only apps, scripts and tests.
Unlike the provider it adds no console reporter and no `environment` tag.

### defaultShouldReport

```ts
function defaultShouldReport(error: unknown): boolean;
```

The default `shouldReport`: drops kitr errors below 500 (client mistakes) and `AbortError`s; reports everything else.

### devtoolsReporter

```ts
function devtoolsReporter(hub: {
  log(channel: string, label: string, data?: unknown, level?: 'debug' | 'info' | 'warn' | 'error'): void;
}): Reporter;
```

Mirrors reports into the kitr devtools (channel "errors"). Added automatically in development.

### installGlobalHandlers

```ts
function installGlobalHandlers(monitoring: Monitoring): () => void;
```

Report uncaught errors and unhandled rejections in the browser (`source: 'window'`). Returns a function that removes the handlers.

### memoryReporter

```ts
function memoryReporter(): Reporter & {
  exceptions: Array<{
    error: unknown;
    context?: CaptureContext;
  }>;
  messages: string[];
  user: MonitoringUser | null;
};
```

Keeps exceptions, message texts and the last user in arrays, for tests. Ignores breadcrumbs and tags.

### sentry

```ts
function sentry(Sentry: SentryLike, options: {
  dsn: string;
  environment?: string;
  release?: string;
  tracesSampleRate?: number;
  [key: string]: unknown;
}): Reporter;
```

Sentry reporter. Pass the SDK module so the right one (react, browser, node) is bundled
for the environment: `sentry(Sentry, { dsn })`.

### defineConfig

```ts
const defineConfig: <const C extends MonitoringConfig>(config: C) => C;
```

Types `config/monitoring.ts`. Returns its argument unchanged.

### Breadcrumb

```ts
interface Breadcrumb {
  /** A group, such as `import`, `navigation` or `api`. */
  category?: string;
  /** What happened. */
  message: string;
  /** How notable the step is. */
  level?: Severity;
  /** Extra data for the step. */
  data?: Record<string, unknown>;
  /** Milliseconds since the epoch; set to `Date.now()` when left out. */
  timestamp?: number;
}
```

A step on the way to a possible error, attached to later reports by reporters that keep them.

### CaptureContext

```ts
interface CaptureContext {
  /** Short strings to filter by; merged over the config `tags`. */
  tags?: Record<string, string>;
  /** Any data that helps fix it: ids, sizes, the failing input. */
  extra?: Record<string, unknown>;
  /** How serious it is. */
  level?: Severity;
  /** Where it came from: 'error-boundary' | 'router' | 'server' | 'window' | 'action'. */
  source?: string;
}
```

The optional second argument of `captureException` and `captureMessage`.

### Monitoring

```ts
interface Monitoring {
  /** Report an error, unless `shouldReport` drops it. */
  captureException(error: unknown, context?: CaptureContext): void;
  /** Report a message. Not filtered by `shouldReport`. */
  captureMessage(message: string, context?: CaptureContext): void;
  /** Attach the signed-in user to later reports; null on sign-out. */
  setUser(user: MonitoringUser | null): void;
  /** Record a step leading up to a possible error. */
  addBreadcrumb(crumb: Breadcrumb): void;
  /** Set a tag on reporters that keep their own scope, such as Sentry. */
  setTag(key: string, value: string): void;
  /** Run `fn`, report and rethrow on failure. */
  wrap<T>(fn: () => T, context?: CaptureContext): T;
  /** Wait for every reporter to send what it queued, up to the timeout (default 2000 ms). Never throws. */
  flush(timeoutMs?: number): Promise<void>;
  /** The reporters in use. */
  readonly reporters: readonly Reporter[];
}
```

The service bound as `monitoring`: report errors and messages, and set the user, tags and breadcrumbs, on every reporter.

### MonitoringConfig

```ts
interface MonitoringConfig {
  /** Where reports go. The provider falls back to the console reporter in development. */
  reporters?: Reporter[];
  /** Return false to drop an error (expected 4xx, cancelled requests). Default drops kitr errors with status < 500. */
  shouldReport?: (error: unknown, context?: CaptureContext) => boolean;
  /** Capture `window.onerror` and unhandled rejections on the client. Default true. */
  globalHandlers?: boolean;
  /** Release / environment tags applied to every report. */
  tags?: Record<string, string>;
  /** Log to the console as well. Default: development. */
  debug?: boolean;
}
```

The options in `config/monitoring.ts`.

### MonitoringUser

```ts
interface MonitoringUser {
  /** Your id for the user. */
  id: string;
  /** The user's email, if your privacy policy allows sending it. */
  email?: string;
  /** A display or login name. */
  username?: string;
  [key: string]: unknown;
}
```

The signed-in user attached to reports by `setUser`. Any extra fields go to the reporter as-is.

### Reporter

```ts
interface Reporter {
  /** Identifies the reporter, such as `sentry`. */
  name: string;
  /** Called once when the monitoring service is created. */
  init?(): void | Promise<void>;
  /** Send an exception; must not throw or block. */
  captureException(error: unknown, context?: CaptureContext): void;
  /** Send a message that is not an exception. */
  captureMessage?(message: string, context?: CaptureContext): void;
  /** Attach the user to later reports, or clear it with null. */
  setUser?(user: MonitoringUser | null): void;
  /** Record a step for later reports. */
  addBreadcrumb?(crumb: Breadcrumb): void;
  /** Set a tag on later reports. */
  setTag?(key: string, value: string): void;
  /** Wait for queued reports to be sent, up to the timeout; resolves false when it ran out. */
  flush?(timeoutMs?: number): Promise<boolean>;
}
```

A destination for reports (Sentry, the console, your own endpoint). Only `name` and `captureException` are required.

### SentryLike

```ts
interface SentryLike {
  /** `Sentry.init`, called with the reporter's options. */
  init?(options: Record<string, unknown>): unknown;
  /** `Sentry.captureException`. */
  captureException(error: unknown, context?: Record<string, unknown>): unknown;
  /** `Sentry.captureMessage`. */
  captureMessage(message: string, context?: Record<string, unknown>): unknown;
  /** `Sentry.setUser`. */
  setUser(user: Record<string, unknown> | null): void;
  /** `Sentry.addBreadcrumb`. */
  addBreadcrumb(crumb: Record<string, unknown>): void;
  /** `Sentry.setTag`. */
  setTag(key: string, value: string): void;
  /** `Sentry.flush`. */
  flush?(timeout?: number): Promise<boolean>;
}
```

The subset of `@sentry/react` / `@sentry/browser` / `@sentry/node` these reporters call.

### Severity

```ts
type Severity = 'fatal' | 'error' | 'warning' | 'info' | 'debug';
```

How serious a report or breadcrumb is, using Sentry's levels.

## kitr/monitoring/provider

### MonitoringErrorBoundary

```ts
class MonitoringErrorBoundary extends Component<ErrorBoundaryProps, {
  error: unknown;
}> {
  state: {
    error: unknown;
  };
  static getDerivedStateFromError(error: unknown): {
    error: unknown;
  };
  private report;
  componentDidCatch(error: unknown, info: ErrorInfo): void;
  reset: () => void;
  render(): ReactNode;
}
```

Reports render errors, then shows `fallback` (or nothing, so the router's error component takes over).

### monitoringProvider

```ts
const monitoringProvider: import("@kitr/core").KitrProvider;
```

Binds `monitoring` from `config/monitoring.ts`, installs window handlers on the client,
and wraps the tree in an error boundary that reports before TanStack Router's error
component renders.

### ErrorBoundaryProps

```ts
interface ErrorBoundaryProps {
  /** The service to report render errors to. */
  monitoring: Monitoring;
  /** Shown instead of the children after an error; a function gets the error and `reset`. Left out, the boundary rethrows. */
  fallback?: ReactNode | ((error: unknown, reset: () => void) => ReactNode);
  /** What the boundary guards. */
  children: ReactNode;
}
```

Props of `MonitoringErrorBoundary`.

## kitr/monitoring/server

### reportErrors

```ts
function reportErrors(monitoring: Monitoring): (event: {
  req: {
    method: string;
    url: string;
  };
  context?: Record<string, any>;
}, next: () => Promise<unknown> | unknown) => Promise<unknown>;
```

h3 middleware that reports thrown errors (after the request context exists), then rethrows
so kitr's error handler still produces the response. `server.use(reportErrors(monitoring))`.

<!-- GENERATED by scripts/api-docs.mjs from the type definitions. Do not edit. -->
