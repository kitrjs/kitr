---
title: API
description: Every export of kitr/monitoring, with its signature.
order: 2
---

# API

Every export of `kitr/monitoring`, `kitr/monitoring/provider`, `kitr/monitoring/server`, read from the published type definitions. The [guide](/packages/monitoring) shows them in use.

## kitr/monitoring

### consoleReporter

```ts
function consoleReporter(): Reporter;
```

Prints reports. The default reporter in development.

### createMonitoring

```ts
function createMonitoring(config?: MonitoringConfig): Monitoring;
```

### defaultShouldReport

```ts
function defaultShouldReport(error: unknown): boolean;
```

Default filter: kitr errors that are client mistakes (4xx) are not incidents.

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

Window error and unhandled-rejection handlers. Returns a disposer.

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

Keeps reports in memory, for tests.

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

### Breadcrumb

```ts
interface Breadcrumb {
  category?: string;
  message: string;
  level?: Severity;
  data?: Record<string, unknown>;
  timestamp?: number;
}
```

### CaptureContext

```ts
interface CaptureContext {
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
  level?: Severity;
  /** Where it came from: 'error-boundary' | 'router' | 'server' | 'window' | 'action'. */
  source?: string;
}
```

### Monitoring

```ts
interface Monitoring {
  captureException(error: unknown, context?: CaptureContext): void;
  captureMessage(message: string, context?: CaptureContext): void;
  setUser(user: MonitoringUser | null): void;
  addBreadcrumb(crumb: Breadcrumb): void;
  setTag(key: string, value: string): void;
  /** Run `fn`, report and rethrow on failure. */
  wrap<T>(fn: () => T, context?: CaptureContext): T;
  flush(timeoutMs?: number): Promise<void>;
  readonly reporters: readonly Reporter[];
}
```

### MonitoringConfig

```ts
interface MonitoringConfig {
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

### MonitoringUser

```ts
interface MonitoringUser {
  id: string;
  email?: string;
  username?: string;
  [key: string]: unknown;
}
```

### Reporter

```ts
interface Reporter {
  name: string;
  init?(): void | Promise<void>;
  captureException(error: unknown, context?: CaptureContext): void;
  captureMessage?(message: string, context?: CaptureContext): void;
  setUser?(user: MonitoringUser | null): void;
  addBreadcrumb?(crumb: Breadcrumb): void;
  setTag?(key: string, value: string): void;
  flush?(timeoutMs?: number): Promise<boolean>;
}
```

What every destination implements.

### SentryLike

```ts
interface SentryLike {
  init?(options: Record<string, unknown>): unknown;
  captureException(error: unknown, context?: Record<string, unknown>): unknown;
  captureMessage(message: string, context?: Record<string, unknown>): unknown;
  setUser(user: Record<string, unknown> | null): void;
  addBreadcrumb(crumb: Record<string, unknown>): void;
  setTag(key: string, value: string): void;
  flush?(timeout?: number): Promise<boolean>;
}
```

The subset of `@sentry/react` / `@sentry/browser` / `@sentry/node` these reporters call.

### Severity

```ts
type Severity = 'fatal' | 'error' | 'warning' | 'info' | 'debug';
```

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
  monitoring: Monitoring;
  fallback?: ReactNode | ((error: unknown, reset: () => void) => ReactNode);
  children: ReactNode;
}
```

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
