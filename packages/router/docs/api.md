---
title: API reference
description: Every export of @kitr/router, with its signature.
order: 2
---

# API reference

Every export of `@kitr/router`, `@kitr/router/routes`, `@kitr/router/stack`, read from the published type definitions. The [guide](/packages/router/guide) shows them in use.

## @kitr/router

Re-exports `@tanstack/history`, `@tanstack/react-router`, `@tanstack/router-core` unchanged, plus the following.

### can

```ts
function can(permission: string, options?: {
  subject?: unknown;
  to?: string;
}): ({ context }: {
  context: {
    session?: GuardSession | null;
  };
}) => void;
```

`beforeLoad` permission guard: passes when `context.session.can(permission, subject)` is true.
Otherwise throws a FORBIDDEN KitrError (403) that the route's error screen renders, or redirects when `to` is given.

### compileTree

```ts
function compileTree(entries: RouteEntry[], options?: CompileTreeOptions): AnyRoute;
```

Build the TanStack route tree from the table's page entries.

### createKitrRouter

```ts
function createKitrRouter<TRouteTree extends AnyRoute>(options: CreateKitrRouterOptions<TRouteTree>): Router<TRouteTree, 'never', true>;

function createKitrRouter<R>(options: CreateKitrRouterFromRoutesOptions<R>): Router<TreeOf<R>, 'never', true>;
```

`createRouter` with kitr's defaults: queryClient and app in context, intent
preload, scroll restoration, default pending/error/not-found components,
and the app's providers wrapped around the whole tree.

With `@kitr/query` installed, loaders can `context.queryClient.ensureQueryData(...)`.

### DefaultError

```ts
function DefaultError({ error, reset }: ErrorComponentProps): import("react").JSX.Element;
```

The default error screen: the KitrError's message (or "Something went wrong"), a "Try again" button
that reloads the route and a "Go home" link. FORBIDDEN errors read "You don't have access to this page."

### DefaultNotFound

```ts
function DefaultNotFound(): import("react").JSX.Element;
```

The default not-found screen: "Page not found" and a "Go home" link, for unknown URLs and thrown `notFound()`.

### DefaultPending

```ts
function DefaultPending(): import("react").JSX.Element;
```

The default loading screen: a spinner with "Loading…" for screen readers (`data-kitr="pending"`).
`createKitrRouter` uses it for every route; override with `defaultPendingComponent` or a route's `pendingComponent`.

### definePage

```ts
function definePage(page: PageModule): PageModule;
```

`export default definePage({ component: HomePage, pendingComponent: HomeSkeleton })` in a page file.

### guards

```ts
function guards<Ctx>(...fns: Array<(ctx: Ctx) => unknown | Promise<unknown>>): (ctx: Ctx) => Promise<Record<string, unknown>>;
```

Compose several `beforeLoad` guards into one. They run in order and are awaited; the objects
they return are merged into the route context, and the first throw stops the rest.

### onlyPlatform

```ts
function onlyPlatform(platforms: string | string[], options?: OnlyPlatformOptions): ({ context }: {
  context: {
    platform?: GuardPlatform | null;
  };
}) => void;
```

`beforeLoad` guard that limits a route to some platforms: the marketing pages exist on the
`www` build only, the account pages on the authed web app and the phone. Keys are platform
names from kitrrc.ts, platform types (`web`, `mobile`), OS names or `native`. Other platforms
get the route's not-found page, or a redirect with `to`. Reads `context.platform` (the service
from `@kitr/platform`, put in context by `createKitrRouter`) and falls back to the build's
`KITR_PLATFORM` / `KITR_PLATFORM_TYPE`, so it works with no platform package at all.

```ts
export const Route = createFileRoute('/pricing')({ beforeLoad: onlyPlatform('www') })
```

### requireAuth

```ts
function requireAuth(options?: RequireAuthOptions): ({ context, location }: {
  context: {
    session?: GuardSession | null;
    app?: AppWithConfig;
  };
  location: {
    href: string;
  };
}) => {
  session: GuardSession;
};
```

`beforeLoad` guard. Reads `context.session` (set by `@kitr/auth` or your own
provider) and redirects anonymous users, remembering where they were going.

```ts
export const Route = createFileRoute('/_app')({ beforeLoad: requireAuth() })
```

### pages

```ts
const pages: {
  readonly key: "pages";
  readonly kinds: readonly [
    "page",
    "page-layout",
    "page-group",
    "page-root"
  ];
  readonly methods: {
    readonly root: (this: AnyRouteTable, options: Record<string, unknown>) => AnyRouteTable;
    readonly page: (this: AnyRouteTable, path: string, options?: Record<string, unknown>) => AnyRouteTable;
    readonly layout: (this: AnyRouteTable, id: string, ...rest: unknown[]) => AnyRouteTable;
  };
  readonly group: (child: AnyRouteTable, parent: AnyRouteTable, prefix: string, options: GroupOptions) => void;
  readonly targets: {
    readonly tanstack: typeof compileTree;
  };
};
```

The pages extension for the kitr route table: `.root`, `.page` and `.layout` on
`defineRoutes([pages], ...)`, compiled to a TanStack Router tree by `createKitrRouter({ routes })`.

```ts
import pages from '@kitr/router/routes'
export const routes = defineRoutes([pages], (r) =>
  r.root({ head, component: RootDocument }).page('/', { lazy: () => import('./pages/home') }),
)
```

### CompileTreeOptions

```ts
interface CompileTreeOptions {
  /** The current platform name; pages whose `platforms` leave it out are dropped. */
  platform?: string;
  /** Default root route options when the table has no `.root(...)`. */
  root?: Record<string, unknown>;
}
```

What `compile('tanstack', options)` receives from `createKitrRouter`.

### CreateKitrRouterBaseOptions

```ts
interface CreateKitrRouterBaseOptions<TRouteTree extends AnyRoute> extends Omit<RouterOptions<TRouteTree, 'never', false, any, any>, 'context' | 'routeTree'> {
  /** The app from `app/app.ts`. Put in every route's context as `context.app`; forked per request on the server. */
  app: KitrApp;
  /** Defaults to the container's `queryClient` (from @kitr/query). */
  queryClient?: QueryClient;
  /** Extra context merged into every route (e.g. `session`). */
  context?: Record<string, unknown>;
  /** The platform this router is built for. Default `import.meta.env.KITR_PLATFORM`. */
  platform?: string;
}
```

Options of `createKitrRouter`: TanStack's router options without `context`, plus the kitr app and extra context.

### CreateKitrRouterFromRoutesOptions

```ts
interface CreateKitrRouterFromRoutesOptions<R> extends CreateKitrRouterBaseOptions<TreeOf<R>> {
  routes: PageRoutes<R>;
  routeTree?: never;
}
```

`createKitrRouter({ routes })`: the kitr route table from `app/routes.ts`, compiled to a route tree.

### CreateKitrRouterOptions

```ts
interface CreateKitrRouterOptions<TRouteTree extends AnyRoute> extends CreateKitrRouterBaseOptions<TRouteTree> {
  routeTree: TRouteTree;
  routes?: never;
}
```

`createKitrRouter({ routeTree })`: a TanStack route tree, from `createRootRoute().addChildren` or file-based routes.

### GuardPlatform

```ts
interface GuardPlatform {
  name?: string | undefined;
  type?: string;
  native?: boolean;
  os?: string;
}
```

What `onlyPlatform()` reads: the platform service when `@kitr/platform` is installed, else the build's name and type.

### GuardSession

```ts
interface GuardSession {
  /** The signed-in user. `requireAuth()` redirects when it is missing or null. */
  user?: unknown | null;
  /** Answers `can(permission, { subject })`. Without it, every `can()` check fails. */
  can?: (permission: string, subject?: unknown) => boolean;
}
```

What the guards read from `context.session`: a user when signed in, and an optional permission check.

### KitrPageOptions

```ts
interface KitrPageOptions {
  /** How the page enters in a stack outlet: slide in (`push`, default), slide up over the parent (`cover`), bottom sheet, or full screen. */
  presentation?: 'push' | 'cover' | 'sheet' | 'fullscreen';
  /** Keep the page mounted (state, scroll, media) when another page covers it. */
  keepAlive?: boolean;
  /** The page a cold deep link stacks under this one (`/chats/$id` under `/chats`). */
  stackParent?: string;
  /** Platforms that ship this page. Default: all. Others drop it from their tree and bundle. */
  platforms?: PlatformName[];
  /** Render mode on the web platform, overriding its `mode`. Native platforms always render on the client. */
  render?: 'ssr' | 'client' | 'static';
  /**
   * The page's components, loaded on first visit: `() => import('#app/pages/home')`. The module's
   * default export is the component, or `definePage({ component, pendingComponent, errorComponent })`.
   */
  lazy?: () => Promise<{
    default: RouteComponent | PageModule;
  } | PageModule>;
}
```

How a page moves and lives inside a stack outlet, and where it ships. Lands in TanStack's `staticData`.

### KitrRouterBindings

```ts
interface KitrRouterBindings {
  session?: GuardSession | null;
  platform?: GuardPlatform;
}
```

Fields `createKitrRouter` fills from the container when the packages are installed, as live
getters: `session` from `@kitr/auth` (what `requireAuth()` and `can()` read) and `platform`
from `@kitr/platform` (what `onlyPlatform()` reads). Each package augments `KitrRouterContext`
with its own precise type; this is their shape as the guards see it.

### KitrRouterContext

```ts
interface KitrRouterContext {
  /** The query client loaders fill with `ensureQueryData`. Per request on the server. */
  queryClient: QueryClient;
  /** The kitr app, forked per request on the server. Read services with `context.app.container.use()`. */
  app: KitrApp;
}
```

The router context every kitr route sees. Packages extend it by augmentation:

```ts
declare module '@kitr/router' { interface KitrRouterContext { session: Session | null } }
```

### OnlyPlatformOptions

```ts
interface OnlyPlatformOptions {
  /** Redirect other platforms here instead of rendering not-found. */
  to?: string;
}
```

Options of `onlyPlatform()`: where other platforms go instead of a 404.

### PageModule

```ts
interface PageModule {
  component?: RouteComponent;
  pendingComponent?: RouteComponent;
  errorComponent?: ErrorRouteComponent;
  notFoundComponent?: NotFoundRouteComponent;
}
```

What a page module may export as default besides a bare component.

### PageRoutes

```ts
interface PageRoutes<R = any> {
  $types: R;
  compile(target: 'tanstack', options?: CompileTreeOptions): Record<string, unknown>;
}
```

A route table with pages (`defineRoutes([pages], ...)`): what `createKitrRouter({ routes })` compiles.

### PageRouteType

```ts
interface PageRouteType<Rt extends AnyRoute, Kind extends string = 'page'> {
  kind: Kind;
  scope: 'absolute';
  path: Rt['fullPath'];
  /** The TanStack route, exactly as `createRoute` types it. */
  route: Rt;
}
```

The entry type carried per page into `$types`. `scope: 'absolute'`: groups never rewrite it.

### RequireAuthOptions

```ts
interface RequireAuthOptions {
  /** Where to send anonymous users. Default: `signInPath` from `config/auth.ts`, else `/sign-in`. */
  to?: string;
  /** Name of the search param carrying the original URL. Default `redirect`. */
  redirectParam?: string | false;
}
```

Options of `requireAuth()`: where anonymous visitors go and which search param remembers their page.

### RootComponentOptions

```ts
interface RootComponentOptions {
  /** Rendered when no page matches the path, and for `notFound()` thrown without a closer handler. */
  notFoundComponent?: LazyComponent<NotFoundRouteComponent>;
  /** Rendered when a loader or component throws, unless a page has its own. */
  errorComponent?: LazyComponent<ErrorRouteComponent> | false | null;
  /** Rendered while a page loads, past the router's `defaultPendingMs`. */
  pendingComponent?: LazyComponent<RouteComponent>;
}
```

The root's fallback components, each a component or `{ lazy }`, the way `.page()` takes `lazy`.

### DefaultRootRoute

```ts
/** The root route `createKitrRouter` builds when the table has no `.root(...)`: a kitr context, no loader. */
type DefaultRootRoute = RootRoute<Register, undefined, KitrRouterContext, AnyContext, AnyContext, {}, undefined, unknown, unknown, unknown, unknown, undefined>;
```

The root route `createKitrRouter` builds when the table has no `.root(...)`: a kitr context, no loader.

### GroupRouteType

```ts
type GroupRouteType<R, P extends string, O> = PageRouteType<GroupRoute<R, P, O>, 'page-group'>;
```

Reserved for the group route the `pages` extension registers under a group. Not a route type itself.

### LazyComponent

```ts
type LazyComponent<C> = C | {
  lazy: () => Promise<{
    default: C;
  }>;
};
```

A component, or `{ lazy: () => import('./pages/not-found') }` to load it the first time it renders.
The module's default export is the component.

### PageName

```ts
type PageName<P extends AnyRoute, Path extends string> = `page ${JoinPaths<TrimRight<P['fullPath']>, Path>}`;
```

The name of a page entry: `page /admin/users`, the full path without a trailing slash.

### ParentOf

```ts
type ParentOf<R> = R extends {
  '~parent': infer T extends AnyRoute;
} ? T : RootOf<R>;
```

The route pages added here become children of: the enclosing layout or group, else the root.

### RootOf

```ts
type RootOf<R> = R extends {
  '~root': infer T extends AnyRoute;
} ? T : DefaultRootRoute;
```

The table's root route type: from `.root(...)`, else the default.

### RouterContextWith

```ts
type RouterContextWith<T> = KitrRouterContext & T;
```

The router context plus your own fields, for typing a route's context without augmenting `KitrRouterContext`.

### RouteTreeOf

```ts
type RouteTreeOf<R> = Subtree<R, RootOf<R>>;
```

The route tree `compile('tanstack')` returns for a table's `$types`: what `createKitrRouter({ routes })` registers.

### RouteUnder

```ts
type RouteUnder<TParent extends AnyRoute, TPath extends string, TCustomId extends string, TSearchValidator = undefined, TParams = ResolveParams<TPath>, TRouteContextFn = AnyContext, TBeforeLoadFn = AnyContext, TLoaderDeps extends Record<string, any> = {}, TLoaderFn = undefined, TSSR = unknown> = Route<unknown, TParent, TPath, ResolveFullPath<TParent, TPath>, TCustomId, ResolveId<TParent, TCustomId, TPath>, TSearchValidator, TParams, AnyContext, TRouteContextFn, TBeforeLoadFn, TLoaderDeps, TLoaderFn, unknown, unknown, TSSR, unknown, undefined>;
```

A TanStack route under `TParent`, as `createRoute({ getParentRoute, path | id, ...options })` types it.

### TreeOf

```ts
type TreeOf<R> = RouteTreeOf<R> extends (infer T extends AnyRoute) ? T : never;
```

The TanStack route tree of a table's `$types`, as a route (never `unknown`, so the router stays typed).

### WithChildren

```ts
type WithChildren<Rt, C> = IsAny<Rt extends {
  types: {
    parentRoute: infer P;
  };
} ? P : never> extends true ? Rt extends RootRoute<infer TRegister, infer TSearchValidator, infer TRouterContext, infer TRouteContextFn, infer TBeforeLoadFn, infer TLoaderDeps extends Record<string, any>, infer TLoaderFn, any, infer TFileRouteTypes, infer TSSR, infer TServerMiddlewares, infer THandlers> ? RootRoute<TRegister, TSearchValidator, TRouterContext, TRouteContextFn, TBeforeLoadFn, TLoaderDeps, TLoaderFn, C, TFileRouteTypes, TSSR, TServerMiddlewares, THandlers> : never : Rt extends Route<infer TRegister, infer TParentRoute extends AnyRoute, infer TPath extends string, infer TFullPath extends string, infer TCustomId extends string, infer TId extends string, infer TSearchValidator, infer TParams, infer TRouterContext, infer TRouteContextFn, infer TBeforeLoadFn, infer TLoaderDeps extends Record<string, any>, infer TLoaderFn, any, infer TFileRouteTypes, infer TSSR, infer TServerMiddlewares, infer THandlers> ? Route<TRegister, TParentRoute, TPath, TFullPath, TCustomId, TId, TSearchValidator, TParams, TRouterContext, TRouteContextFn, TBeforeLoadFn, TLoaderDeps, TLoaderFn, C, TFileRouteTypes, TSSR, TServerMiddlewares, THandlers> : never;
```

`Rt` with its `TChildren` replaced by `C`, for a root or a child route.

## @kitr/router/routes

### compileTree

```ts
function compileTree(entries: RouteEntry[], options?: CompileTreeOptions): AnyRoute;
```

Build the TanStack route tree from the table's page entries.

### definePage

```ts
function definePage(page: PageModule): PageModule;
```

`export default definePage({ component: HomePage, pendingComponent: HomeSkeleton })` in a page file.

### pages

```ts
const pages: {
  readonly key: "pages";
  readonly kinds: readonly [
    "page",
    "page-layout",
    "page-group",
    "page-root"
  ];
  readonly methods: {
    readonly root: (this: AnyRouteTable, options: Record<string, unknown>) => AnyRouteTable;
    readonly page: (this: AnyRouteTable, path: string, options?: Record<string, unknown>) => AnyRouteTable;
    readonly layout: (this: AnyRouteTable, id: string, ...rest: unknown[]) => AnyRouteTable;
  };
  readonly group: (child: AnyRouteTable, parent: AnyRouteTable, prefix: string, options: GroupOptions) => void;
  readonly targets: {
    readonly tanstack: typeof compileTree;
  };
};
```

The pages extension for the kitr route table: `.root`, `.page` and `.layout` on
`defineRoutes([pages], ...)`, compiled to a TanStack Router tree by `createKitrRouter({ routes })`.

```ts
import pages from '@kitr/router/routes'
export const routes = defineRoutes([pages], (r) =>
  r.root({ head, component: RootDocument }).page('/', { lazy: () => import('./pages/home') }),
)
```

### CompileTreeOptions

```ts
interface CompileTreeOptions {
  /** The current platform name; pages whose `platforms` leave it out are dropped. */
  platform?: string;
  /** Default root route options when the table has no `.root(...)`. */
  root?: Record<string, unknown>;
}
```

What `compile('tanstack', options)` receives from `createKitrRouter`.

### KitrPageOptions

```ts
interface KitrPageOptions {
  /** How the page enters in a stack outlet: slide in (`push`, default), slide up over the parent (`cover`), bottom sheet, or full screen. */
  presentation?: 'push' | 'cover' | 'sheet' | 'fullscreen';
  /** Keep the page mounted (state, scroll, media) when another page covers it. */
  keepAlive?: boolean;
  /** The page a cold deep link stacks under this one (`/chats/$id` under `/chats`). */
  stackParent?: string;
  /** Platforms that ship this page. Default: all. Others drop it from their tree and bundle. */
  platforms?: PlatformName[];
  /** Render mode on the web platform, overriding its `mode`. Native platforms always render on the client. */
  render?: 'ssr' | 'client' | 'static';
  /**
   * The page's components, loaded on first visit: `() => import('#app/pages/home')`. The module's
   * default export is the component, or `definePage({ component, pendingComponent, errorComponent })`.
   */
  lazy?: () => Promise<{
    default: RouteComponent | PageModule;
  } | PageModule>;
}
```

How a page moves and lives inside a stack outlet, and where it ships. Lands in TanStack's `staticData`.

### PageModule

```ts
interface PageModule {
  component?: RouteComponent;
  pendingComponent?: RouteComponent;
  errorComponent?: ErrorRouteComponent;
  notFoundComponent?: NotFoundRouteComponent;
}
```

What a page module may export as default besides a bare component.

### PageRouteType

```ts
interface PageRouteType<Rt extends AnyRoute, Kind extends string = 'page'> {
  kind: Kind;
  scope: 'absolute';
  path: Rt['fullPath'];
  /** The TanStack route, exactly as `createRoute` types it. */
  route: Rt;
}
```

The entry type carried per page into `$types`. `scope: 'absolute'`: groups never rewrite it.

### RootComponentOptions

```ts
interface RootComponentOptions {
  /** Rendered when no page matches the path, and for `notFound()` thrown without a closer handler. */
  notFoundComponent?: LazyComponent<NotFoundRouteComponent>;
  /** Rendered when a loader or component throws, unless a page has its own. */
  errorComponent?: LazyComponent<ErrorRouteComponent> | false | null;
  /** Rendered while a page loads, past the router's `defaultPendingMs`. */
  pendingComponent?: LazyComponent<RouteComponent>;
}
```

The root's fallback components, each a component or `{ lazy }`, the way `.page()` takes `lazy`.

### DefaultRootRoute

```ts
/** The root route `createKitrRouter` builds when the table has no `.root(...)`: a kitr context, no loader. */
type DefaultRootRoute = RootRoute<Register, undefined, KitrRouterContext, AnyContext, AnyContext, {}, undefined, unknown, unknown, unknown, unknown, undefined>;
```

The root route `createKitrRouter` builds when the table has no `.root(...)`: a kitr context, no loader.

### GroupRouteType

```ts
type GroupRouteType<R, P extends string, O> = PageRouteType<GroupRoute<R, P, O>, 'page-group'>;
```

Reserved for the group route the `pages` extension registers under a group. Not a route type itself.

### LazyComponent

```ts
type LazyComponent<C> = C | {
  lazy: () => Promise<{
    default: C;
  }>;
};
```

A component, or `{ lazy: () => import('./pages/not-found') }` to load it the first time it renders.
The module's default export is the component.

### PageName

```ts
type PageName<P extends AnyRoute, Path extends string> = `page ${JoinPaths<TrimRight<P['fullPath']>, Path>}`;
```

The name of a page entry: `page /admin/users`, the full path without a trailing slash.

### ParentOf

```ts
type ParentOf<R> = R extends {
  '~parent': infer T extends AnyRoute;
} ? T : RootOf<R>;
```

The route pages added here become children of: the enclosing layout or group, else the root.

### RootOf

```ts
type RootOf<R> = R extends {
  '~root': infer T extends AnyRoute;
} ? T : DefaultRootRoute;
```

The table's root route type: from `.root(...)`, else the default.

### RouteTreeOf

```ts
type RouteTreeOf<R> = Subtree<R, RootOf<R>>;
```

The route tree `compile('tanstack')` returns for a table's `$types`: what `createKitrRouter({ routes })` registers.

### RouteUnder

```ts
type RouteUnder<TParent extends AnyRoute, TPath extends string, TCustomId extends string, TSearchValidator = undefined, TParams = ResolveParams<TPath>, TRouteContextFn = AnyContext, TBeforeLoadFn = AnyContext, TLoaderDeps extends Record<string, any> = {}, TLoaderFn = undefined, TSSR = unknown> = Route<unknown, TParent, TPath, ResolveFullPath<TParent, TPath>, TCustomId, ResolveId<TParent, TCustomId, TPath>, TSearchValidator, TParams, AnyContext, TRouteContextFn, TBeforeLoadFn, TLoaderDeps, TLoaderFn, unknown, unknown, TSSR, unknown, undefined>;
```

A TanStack route under `TParent`, as `createRoute({ getParentRoute, path | id, ...options })` types it.

### WithChildren

```ts
type WithChildren<Rt, C> = IsAny<Rt extends {
  types: {
    parentRoute: infer P;
  };
} ? P : never> extends true ? Rt extends RootRoute<infer TRegister, infer TSearchValidator, infer TRouterContext, infer TRouteContextFn, infer TBeforeLoadFn, infer TLoaderDeps extends Record<string, any>, infer TLoaderFn, any, infer TFileRouteTypes, infer TSSR, infer TServerMiddlewares, infer THandlers> ? RootRoute<TRegister, TSearchValidator, TRouterContext, TRouteContextFn, TBeforeLoadFn, TLoaderDeps, TLoaderFn, C, TFileRouteTypes, TSSR, TServerMiddlewares, THandlers> : never : Rt extends Route<infer TRegister, infer TParentRoute extends AnyRoute, infer TPath extends string, infer TFullPath extends string, infer TCustomId extends string, infer TId extends string, infer TSearchValidator, infer TParams, infer TRouterContext, infer TRouteContextFn, infer TBeforeLoadFn, infer TLoaderDeps extends Record<string, any>, infer TLoaderFn, any, infer TFileRouteTypes, infer TSSR, infer TServerMiddlewares, infer THandlers> ? Route<TRegister, TParentRoute, TPath, TFullPath, TCustomId, TId, TSearchValidator, TParams, TRouterContext, TRouteContextFn, TBeforeLoadFn, TLoaderDeps, TLoaderFn, C, TFileRouteTypes, TSSR, TServerMiddlewares, THandlers> : never;
```

`Rt` with its `TChildren` replaced by `C`, for a root or a child route.

## @kitr/router/stack

### animate

```ts
function animate(element: Element | null | undefined, keyframes: Keyframe[], options: AnimateOptions): Promise<void>;
```

Animate an element and resolve when done. Resolves at once without the Web Animations API or with no keyframes.

### attachDrag

```ts
function attachDrag(element: HTMLElement, options: DragGestureOptions): () => void;
```

Attach a drag gesture to a page element. Returns the detach function.

### createBackRegistry

```ts
function createBackRegistry(): BackRegistry;
```

A new registry; `<StackOutlet>` makes one per stack and `useBackHandler()` registers into the nearest.

### createEntryRouter

```ts
function createEntryRouter(router: AnyRouter, ancestorIds: string[], initial: {
  matches: AnyRouteMatch[];
  location: ParsedLocation;
}): EntryRouter;
```

Build the router view for one stack page. `ancestorIds` are the routes above the outlet, shared live with the real router.

### detectMotionStyle

```ts
function detectMotionStyle(win?: Window | undefined): MotionStyle;
```

The style for the device: iOS and Android from the user agent, everything else `plain`. Reduced motion → `none`.

### motionFor

```ts
function motionFor(presentation: Presentation, style: MotionStyle): MotionStep;
```

The motion for a presentation in a style. `none` keeps the page but skips the animation.

### shouldCommit

```ts
function shouldCommit(distance: number, size: number, velocity: number, rule?: GestureRule): boolean;
```

Whether a release at `distance` of `size` pixels, moving at `velocity` px/s, pops the page.

### SplitStack

```ts
function SplitStack({ master, children, minWidth, masterWidth, className, style }: SplitStackProps): import("react").JSX.Element;
```

The list beside the stack above `minWidth`, the stack alone below it.

### stackOptionsOf

```ts
function stackOptionsOf(pageMatches: AnyRouteMatch[]): StackRouteOptions;
```

The stack options of a page: the innermost route's `staticData` wins, then its parents below the outlet.

### StackOutlet

```ts
function StackOutlet(props: StackOutletProps): React.JSX.Element;
```

The stacked outlet. A plain `<Outlet>` on the server and until hydration, then pages that push, pop and stay mounted beneath.

### StackTabs

```ts
function StackTabs({ tabs, children, placement, backToHome, className, style, ...outlet }: StackTabsProps): import("react").JSX.Element;
```

`<StackTabs>`: tabs that each keep their own stack. Switching tabs shows where that tab was
left; tapping the current tab again pops it to its root; back inside a tab pops that tab's
pages. Routes decide which tab they belong to by path (`match`), so the same route tree serves
a tabbed phone app and a sidebar desktop app.

### useBackHandler

```ts
function useBackHandler(handler: BackHandler, enabled?: boolean): void;
```

Answer the back button while this component is mounted: a dialog closes itself, a form asks
before leaving. Return `true` to stop the stack from popping. The newest handler runs first.

### useMinWidth

```ts
function useMinWidth(minWidth: number): boolean;
```

`true` once the viewport is at least `minWidth` wide. Hydration-safe: false on the server and first render.

### useSplitPane

```ts
function useSplitPane(): SplitPane;
```

Whether the nearest `<SplitStack>` shows both panes. `false` outside one, on the server and before hydration.

### useStack

```ts
function useStack(): StackInfo;
```

The stack around the current page: depth, whether it can pop, and `pop()`.

### useStackEntry

```ts
function useStackEntry(): StackEntry | undefined;
```

The entry of the page this component renders in, or undefined outside a stack page.

### StackEngine

```ts
class StackEngine {
  entries: StackEntry[];
  activeId: string | undefined;
  transition: StackTransition | undefined;
  private listeners;
  private fallbackIndex;
  /** Set by the tabs view before navigating to a tab's last page: that push reuses the page instead of stacking a copy. */
  switchingTo: string | undefined;
  /** Set by a completed swipe gesture: the next pop needs no leave animation. */
  gesturePopped: string | undefined;
  readonly options: Required<StackEngineOptions>;
  constructor(options?: StackEngineOptions);
  subscribe: (listener: () => void) => () => void;
  private notify;
  get active(): StackEntry | undefined;
  byId(id: string): StackEntry | undefined;
  /** The pages of one group that are not leaving, bottom first. */
  stackOf(group: string): StackEntry[];
  /** The topmost page of a group that is not leaving. */
  topOf(group: string): StackEntry | undefined;
  /** How many pages the active group holds (what "can go back" means to the stack). */
  get depth(): number;
  /** Whether a page should be in the tree: entering, active, leaving, or covered and kept alive within the limit. */
  isMounted(entry: StackEntry): boolean;
  /** Apply a committed router state. Returns the transition to show, or undefined when the current page only refreshed. */
  apply(input: ApplyInput): StackTransition | undefined;
  private create;
  private refresh;
  private begin;
  /** The view finished animating a transition: entering pages are active, leaving pages are gone. */
  settle(transitionId: number): void;
  /** Remove a page whose leave animation ended. */
  finishLeaving(id: string, notify?: boolean): void;
  /** Drop every page (the outlet unmounted). */
  reset(): void;
}
```

The stack's state machine, free of React and the DOM so it can be tested on its own. Feed it
every committed router state with `apply()`; it decides whether that was a push, a pop, a
replace or a tab switch, keeps the pages in order with their last matches, and tells the view
what to animate. The view reports the end of leave animations with `finishLeaving()`.

### defaultBackRegistry

```ts
const defaultBackRegistry: BackRegistry;
```

One registry for the app: `<StackOutlet>` reads it, and so does `useBackHandler()` outside any stack.

### AnimateOptions

```ts
interface AnimateOptions {
  duration: number;
  easing: string;
  /** Play the keyframes backwards (a leaving page). */
  reverse?: boolean;
  /** Start part-way (a gesture already dragged the page this far), 0..1. */
  from?: number;
}
```

Duration and easing for `animate()`, with `reverse` for a leaving page and `from` to continue a gesture.

### ApplyInput

```ts
interface ApplyInput {
  /** The live router's matches, root first. */
  matches: AnyRouteMatch[];
  location: ParsedLocation;
  /** The id of the route whose outlet this is; pages are the matches below it. */
  outletRouteId: string;
}
```

A committed router state for `StackEngine.apply()`: the matches, the location and the outlet's route.

### BackRegistry

```ts
interface BackRegistry {
  push(handler: BackHandler): () => void;
  /** Run the handlers newest first; true when one consumed the press. */
  run(): boolean;
  readonly size: number;
}
```

The handlers that answer the back button, newest first.

### DragGestureOptions

```ts
interface DragGestureOptions extends GestureRule {
  /** `x`: horizontal from the left edge (swipe back). `y`: downward from anywhere (dismiss). */
  axis: 'x' | 'y';
  /** Start only at the leading edge (swipe back) or anywhere (dismiss). */
  fromEdge: boolean;
  /** Progress 0..1 as the pointer moves. */
  onProgress(progress: number): void;
  /** The pointer lifted: `commit` says whether to pop; `progress` is where it stopped. */
  onEnd(commit: boolean, progress: number): void;
  /** Called when the gesture claims the pointer (after `slop`). */
  onStart?(): void;
  /** Whether a gesture may start now (not mid-transition, not at the root). */
  enabled?(): boolean;
}
```

What `attachDrag()` needs: the axis, whether the drag starts at the edge, and the progress callbacks.

### EntryRouter

```ts
interface EntryRouter {
  /** The view of the router to put in `<RouterContextProvider>` around the page. */
  router: AnyRouter;
  stores: EntryStores;
  /** Mirror the live router into this page: called while the page is the current location. */
  update(matches: AnyRouteMatch[], location: ParsedLocation, status: RouterStatus): void;
}
```

A page's view of the router: the proxy to render through, its stores, and `update()` to mirror the live router while the page is current.

### GestureRule

```ts
interface GestureRule {
  /** Pointers must start within this many pixels of the edge (swipe back). Default 24. */
  edge?: number;
  /** Movement needed before the gesture claims the pointer. Default 8. */
  slop?: number;
  /** Fraction of the page that commits a release with no speed. Default 0.3. */
  commitAt?: number;
  /** Velocity (px/s) that commits regardless of distance. Default 800. */
  velocity?: number;
}
```

Pointer gestures for the stack: the iOS edge swipe that pops a pushed page, and the drag that
dismisses a cover or a sheet. Pure DOM so the rules can be tested without React.

### MotionStep

```ts
interface MotionStep {
  /** Keyframes for the page coming to the front. */
  enter: Keyframe[];
  /** Keyframes for the page leaving the front (the reverse of `enter` when omitted). */
  exit?: Keyframe[];
  /** Keyframes for the page beneath while another arrives over it. Reversed when that page leaves. */
  under?: Keyframe[];
  /** Whether the page beneath is dimmed by a scrim. */
  scrim: boolean;
  duration: number;
  easing: string;
}
```

The keyframes of one presentation in one style: for the arriving page, the leaving page and the page beneath.

### SplitPane

```ts
interface SplitPane {
  /** Whether both panes show. */
  split: boolean;
}
```

What `useSplitPane()` returns: whether the list pane shows beside the stack.

### SplitStackProps

```ts
interface SplitStackProps {
  /** The list (master) pane. */
  master: ReactNode;
  /** The detail pane: a `<StackOutlet>` or `<Outlet>`. */
  children: ReactNode;
  /** Split at this viewport width in pixels. Default 768. */
  minWidth?: number;
  /** The master pane's width. Default `320px`. */
  masterWidth?: string | number;
  className?: string;
  style?: CSSProperties;
}
```

`<SplitStack>`: a list beside the stack when the window is wide enough, the stack alone when it
is not. Phones push the detail over the list; tablets and desktops show both. The list route
reads `useSplitPane()` to know whether it is the whole screen (a page in the stack) or the
left pane (and the index route shows a placeholder in the right pane).

### StackEngineOptions

```ts
interface StackEngineOptions {
  /** How many covered pages stay mounted per group. `false` keeps none (every page remounts on back). Default 5. */
  keepAlive?: number | false;
  /** The tab a location belongs to. Default: one group. */
  groupOf?: (location: ParsedLocation, matches: AnyRouteMatch[]) => string;
}
```

Options of `StackEngine` and `<StackOutlet>`: the keep-alive limit and how locations group into tabs.

### StackEntry

```ts
interface StackEntry {
  /** Stable, unique per page instance: React's key. */
  id: string;
  /** The history entry key (`location.state.key`) of this page's latest visit. */
  key: string;
  /** The history index (`location.state.__TSR_index`) of that visit. */
  index: number;
  href: string;
  pathname: string;
  /** The route ids below the outlet's route, outermost first. */
  routeIds: string[];
  presentation: Presentation;
  /** Whether the page stays mounted under later pages. */
  keepAlive: boolean;
  /** The tab (or `'default'`) the page belongs to. */
  group: string;
  phase: EntryPhase;
  /** The page's matches at its last visit, outlet route excluded, with the ancestors in front. */
  matches: AnyRouteMatch[];
  location: ParsedLocation;
}
```

One page in the stack: its history key and index, route ids, presentation and last matches.

### StackInfo

```ts
interface StackInfo {
  /** The active page's entry, or undefined outside a stack. */
  entry: StackEntry | undefined;
  /** How many pages the current tab holds. */
  depth: number;
  /** Whether `pop()` has a page to go back to. */
  canPop: boolean;
  /** Go back one page (the router's history back). */
  pop(): void;
  /** Dismiss the top page the way its presentation suggests: the same as `pop()` for now. */
  dismiss(): void;
  presentation: Presentation | undefined;
  /** Register a handler for the back button, newest first. */
  registry: BackRegistry;
}
```

What `useStack()` returns inside a stacked page.

### StackOutletProps

```ts
interface StackOutletProps extends StackEngineOptions {
  /** `ios`, `android`, `plain` (web, desktop) or `none`. Default: detected from the device, `none` with reduced motion. */
  motion?: MotionStyle | 'auto';
  /** Edge swipe back and drag to dismiss. Default: on for touch input. */
  gestures?: boolean | GestureRule;
  /** Back pressed at the root of the stack (Android back with nothing to pop). Return true when handled. Default: exit the app on Android, else nothing. */
  onRootBack?: () => boolean | undefined;
  /** An engine shared with `<StackTabs>`; one is created otherwise. */
  engine?: StackEngine;
  className?: string;
  style?: CSSProperties;
}
```

`<StackOutlet>`: an `<Outlet>` whose pages stack. A navigation deeper pushes the new page over
the current one, which stays mounted (its state, scroll position and media untouched); back
slides it away and the page beneath is there as it was. Routes declare how they arrive
(`staticData.presentation`: push, cover, sheet, fullscreen); iOS gets edge swipe back, Android
the hardware back button, and a cold start on a deep page gets its `stackParent` beneath it.

On the server and during hydration it renders a plain `<Outlet>`, so SSR output and the first
client paint are the ordinary route tree; the stack takes over after hydration.

### StackRouteOptions

```ts
interface StackRouteOptions {
  /** How the page arrives. Default `push`. */
  presentation?: Presentation;
  /** Keep this page mounted (state, scroll, media) under later pages. Default: the outlet's `keepAlive`. */
  keepAlive?: boolean;
  /**
   * The page a cold start lands under: opening `/chats/5` from a notification puts `/chats` beneath
   * it so swipe back and the back button have somewhere to go. A pathname (`/chats`).
   */
  stackParent?: string;
}
```

Route options the stack reads from `staticData`. Declare them on a route:

```ts
export const Route = createFileRoute('/post/new')({ staticData: { presentation: 'cover' } })
```

### StackTab

```ts
interface StackTab {
  /** Stable id, also the stack group. */
  id: string;
  /** The path the tab opens the first time. */
  to: string;
  label?: ReactNode;
  icon?: ReactNode;
  /** Paths that belong to this tab. Default: `to` and anything under it. */
  match?: string[] | ((pathname: string) => boolean);
}
```

One tab: where it starts and which paths belong to it.

### StackTabsProps

```ts
interface StackTabsProps extends Omit<StackOutletProps, 'groupOf' | 'engine' | 'onRootBack'> {
  tabs: StackTab[];
  /** The tab bar. Receives the tabs, the current one and `select()`. Rendered after the pages. */
  children: (props: StackTabsRenderProps) => ReactNode;
  /** Where the bar goes. Default `bottom` (`top` for a desktop sidebar is yours to style). */
  placement?: 'top' | 'bottom';
  /**
   * Android back at the root of a tab other than the first goes to the first tab before exiting
   * (Material's "home tab" rule). Default true.
   */
  backToHome?: boolean;
  className?: string;
  style?: CSSProperties;
}
```

Props of `<StackTabs>`: the tabs, the bar as a render prop, and the outlet's own options.

### StackTabsRenderProps

```ts
interface StackTabsRenderProps {
  tabs: StackTab[];
  /** The tab whose page shows. */
  current: StackTab | undefined;
  /** Open a tab: its last page, or its root when it is already current. */
  select(tab: StackTab | string): void;
  /** The tab a pathname belongs to. */
  tabOf(pathname: string): StackTab | undefined;
}
```

What the tab bar render prop receives: the tabs, the current one, `select()` and `tabOf()`.

### StackTransition

```ts
interface StackTransition {
  id: number;
  kind: TransitionKind;
  /** The page coming to the front. */
  to: string;
  /** The page it replaces at the front, if any. */
  from?: string;
  /** The pages leaving the stack; removed once `finishLeaving()` is called for them. */
  leaving: string[];
  /** Whether the group (tab) changed. */
  groupChanged: boolean;
  /** False when the move was already shown (a completed swipe gesture) and needs no animation. */
  animate: boolean;
}
```

One move the view animates: what comes to the front, what leaves, and how.

### BackHandler

```ts
type BackHandler = () => boolean | undefined;
```

Who answers the back button. Handlers register last-in-first-out: an open menu or dialog
registers one while it shows, so Android back (and a desktop window's back key) closes it
before the stack pops a page. A handler returns `true` when it consumed the press.

### EntryPhase

```ts
type EntryPhase = 'entering' | 'active' | 'covered' | 'leaving';
```

Where a page is in its life: arriving, in front, under another page, or on its way out.

### MotionStyle

```ts
type MotionStyle = 'ios' | 'android' | 'plain' | 'none';
```

The look of a transition: iOS slides the new page in from the right with the page beneath
drifting left, Android fades it in while it rises a little, the web and desktops cross-fade.
Covers and sheets rise from the bottom everywhere. Every animation runs through the Web
Animations API; where it is missing (an old WebView, happy-dom) the transition settles at once.

### Presentation

```ts
type Presentation = 'push' | 'cover' | 'sheet' | 'fullscreen';
```

How a page arrives when it is pushed on the stack.
- `push`: slides in from the side; the page below stays mounted and slides back out on pop.
- `cover`: rises from the bottom over the whole screen, dismissed by dragging down (a composer, a player).
- `sheet`: rises from the bottom over a dimmed page that stays visible (a picker, a menu).
- `fullscreen`: like `push` but with no swipe-back gesture (a video, a camera).

### TransitionKind

```ts
type TransitionKind = 'push' | 'pop' | 'replace' | 'switch';
```

<!-- GENERATED by scripts/api-docs.mjs from the type definitions. Do not edit. -->
