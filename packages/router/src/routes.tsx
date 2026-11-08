import {
  type AnyRouteTable,
  defineRouteExtension,
  type ExtensionKey,
  type GroupOptions,
  type JoinPaths,
  joinPath,
  type KitrRouter,
  type PlatformName,
  type Prettify,
  type RouteEntry,
} from '@kitr/core'
import {
  type AnyContext,
  type AnyRoute,
  createLazyRoute,
  createRootRouteWithContext,
  createRoute,
  type ErrorRouteComponent,
  type NotFoundRouteComponent,
  Outlet,
  type Register,
  type ResolveFullPath,
  type ResolveId,
  type ResolveParams,
  type RootRoute,
  type RootRouteOptions,
  type Route,
  type RouteComponent,
  type RouteOptions,
} from '@tanstack/react-router'
import type { KitrRouterContext } from './context'

/**
 * The pages extension: `.root`, `.layout` and `.page` on the route table, compiled to a
 * TanStack Router route tree by `createKitrRouter({ routes, app })` (the `tanstack` target).
 *
 *   import { defineRoutes } from 'kitr/app'
 *   import pages from 'kitr/router/routes'
 *
 *   export const routes = defineRoutes([pages], (r) =>
 *     r.root({ component: RootDocument })
 *      .page('/', { lazy: () => import('#app/pages/home') })
 *      .layout('_app', { beforeLoad: requireAuth() }, (app) =>
 *        app.page('/projects/$id', { loader: ({ params }) => ..., lazy: () => import('#app/pages/project') })),
 *   )
 *
 * Every page is a real `createRoute`: TanStack infers params, search, loader data and context
 * the same way it does for code-based routes, and `Register` makes `<Link to>` and
 * `getRouteApi('/projects/$id')` typed. `group('/admin', ...)` becomes a path route without a
 * component, so pages inside resolve their full path through it.
 */

/** The root route `createKitrRouter` builds when the table has no `.root(...)`: a kitr context, no loader. */
export type DefaultRootRoute = RootRoute<
  Register,
  undefined,
  KitrRouterContext,
  AnyContext,
  AnyContext,
  {},
  undefined,
  unknown,
  unknown,
  unknown,
  unknown,
  undefined
>

/** The table's root route type: from `.root(...)`, else the default. */
export type RootOf<R> = R extends { '~root': infer T extends AnyRoute } ? T : DefaultRootRoute
/** The route pages added here become children of: the enclosing layout or group, else the root. */
export type ParentOf<R> = R extends { '~parent': infer T extends AnyRoute } ? T : RootOf<R>

type TrimRight<T extends string> = T extends '/' ? '/' : T extends `${infer U}/` ? TrimRight<U> : T
/** The name of a page entry: `page /admin/users`, the full path without a trailing slash. */
export type PageName<P extends AnyRoute, Path extends string> = `page ${JoinPaths<
  TrimRight<P['fullPath']>,
  Path
>}`

/** A TanStack route under `TParent`, as `createRoute({ getParentRoute, path | id, ...options })` types it. */
export type RouteUnder<
  TParent extends AnyRoute,
  TPath extends string,
  TCustomId extends string,
  TSearchValidator = undefined,
  TParams = ResolveParams<TPath>,
  TRouteContextFn = AnyContext,
  TBeforeLoadFn = AnyContext,
  TLoaderDeps extends Record<string, any> = {},
  TLoaderFn = undefined,
  TSSR = unknown,
> = Route<
  unknown,
  TParent,
  TPath,
  ResolveFullPath<TParent, TPath>,
  TCustomId,
  ResolveId<TParent, TCustomId, TPath>,
  TSearchValidator,
  TParams,
  AnyContext,
  TRouteContextFn,
  TBeforeLoadFn,
  TLoaderDeps,
  TLoaderFn,
  unknown,
  unknown,
  TSSR,
  unknown,
  undefined
>

/** How a page moves and lives inside a stack outlet, and where it ships. Lands in TanStack's `staticData`. */
export interface KitrPageOptions {
  /** How the page enters in a stack outlet: slide in (`push`, default), slide up over the parent (`cover`), bottom sheet, or full screen. */
  presentation?: 'push' | 'cover' | 'sheet' | 'fullscreen'
  /** Keep the page mounted (state, scroll, media) when another page covers it. */
  keepAlive?: boolean
  /** The page a cold deep link stacks under this one (`/chats/$id` under `/chats`). */
  stackParent?: string
  /** Platforms that ship this page. Default: all. Others drop it from their tree and bundle. */
  platforms?: PlatformName[]
  /** Render mode on the web platform, overriding its `mode`. Native platforms always render on the client. */
  render?: 'ssr' | 'client' | 'static'
  /**
   * The page's components, loaded on first visit: `() => import('#app/pages/home')`. The module's
   * default export is the component, or `definePage({ component, pendingComponent, errorComponent })`.
   */
  lazy?: () => Promise<{ default: RouteComponent | PageModule } | PageModule>
}

/** What a page module may export as default besides a bare component. */
export interface PageModule {
  component?: RouteComponent
  pendingComponent?: RouteComponent
  errorComponent?: ErrorRouteComponent
  notFoundComponent?: NotFoundRouteComponent
}

/** `export default definePage({ component: HomePage, pendingComponent: HomeSkeleton })` in a page file. */
export function definePage(page: PageModule): PageModule {
  return page
}

type PageRouteOptions<
  TParent extends AnyRoute,
  TPath extends string,
  TSearchValidator,
  TParams,
  TRouteContextFn,
  TBeforeLoadFn,
  TLoaderDeps extends Record<string, any>,
  TLoaderFn,
  TSSR,
> = Omit<
  RouteOptions<
    unknown,
    TParent,
    ResolveId<TParent, string, TPath>,
    string,
    ResolveFullPath<TParent, TPath>,
    TPath,
    TSearchValidator,
    TParams,
    TLoaderDeps,
    TLoaderFn,
    AnyContext,
    TRouteContextFn,
    TBeforeLoadFn,
    TSSR,
    unknown
  >,
  'getParentRoute' | 'path' | 'id'
> &
  KitrPageOptions

type LayoutRouteOptions<
  TParent extends AnyRoute,
  TId extends string,
  TSearchValidator,
  TRouteContextFn,
  TBeforeLoadFn,
  TLoaderDeps extends Record<string, any>,
  TLoaderFn,
  TSSR,
> = Omit<
  RouteOptions<
    unknown,
    TParent,
    ResolveId<TParent, TId, '/'>,
    TId,
    ResolveFullPath<TParent, '/'>,
    '/',
    TSearchValidator,
    {},
    TLoaderDeps,
    TLoaderFn,
    AnyContext,
    TRouteContextFn,
    TBeforeLoadFn,
    TSSR,
    unknown
  >,
  'getParentRoute' | 'path' | 'id'
> &
  Pick<KitrPageOptions, 'platforms' | 'lazy'>

/** The entry type carried per page into `$types`. `scope: 'absolute'`: groups never rewrite it. */
export interface PageRouteType<Rt extends AnyRoute, Kind extends string = 'page'> {
  kind: Kind
  scope: 'absolute'
  path: Rt['fullPath']
  /** The TanStack route, exactly as `createRoute` types it. */
  route: Rt
}

type BeforeLoadOf<O> = O extends { beforeLoad: infer B extends (...args: any[]) => any }
  ? B
  : AnyContext

type GroupRoute<R, P extends string, O> = RouteUnder<
  ParentOf<R>,
  P,
  string,
  undefined,
  ResolveParams<P>,
  AnyContext,
  BeforeLoadOf<O>
>

declare module '@kitr/core' {
  interface RouterExtensions<K extends string, R extends Record<string, unknown>> {
    pages: {
      /**
       * The root route: the HTML document around every page (`head`, `component`, `beforeLoad`).
       * Once per table, before any page. Without it kitr renders a default document.
       */
      root<
        TSearchValidator = undefined,
        TRouteContextFn = AnyContext,
        TBeforeLoadFn = AnyContext,
        TLoaderDeps extends Record<string, any> = {},
        TLoaderFn = undefined,
        TSSR = unknown,
      >(
        options: RootRouteOptions<
          Register,
          TSearchValidator,
          KitrRouterContext,
          TRouteContextFn,
          TBeforeLoadFn,
          TLoaderDeps,
          TLoaderFn,
          TSSR,
          unknown,
          undefined
        >,
      ): KitrRouter<
        K & ExtensionKey,
        Prettify<
          Omit<R, '~root' | '~parent'> & {
            '~root': RootRoute<
              Register,
              TSearchValidator,
              KitrRouterContext,
              TRouteContextFn,
              TBeforeLoadFn,
              TLoaderDeps,
              TLoaderFn,
              unknown,
              unknown,
              TSSR,
              unknown,
              undefined
            >
          }
        >
      >
      /**
       * A page at `path`, relative to the enclosing group or layout. Options are TanStack's
       * `createRoute` options (`loader`, `beforeLoad`, `validateSearch`, `component`...) plus
       * kitr's (`lazy`, `presentation`, `keepAlive`, `platforms`, `render`).
       */
      page<
        TPath extends string,
        TSearchValidator = undefined,
        TParams = ResolveParams<TPath>,
        TRouteContextFn = AnyContext,
        TBeforeLoadFn = AnyContext,
        TLoaderDeps extends Record<string, any> = {},
        TLoaderFn = undefined,
        TSSR = unknown,
      >(
        path: TPath,
        options?: PageRouteOptions<
          ParentOf<R>,
          TPath,
          TSearchValidator,
          TParams,
          TRouteContextFn,
          TBeforeLoadFn,
          TLoaderDeps,
          TLoaderFn,
          TSSR
        >,
      ): KitrRouter<
        K & ExtensionKey,
        Prettify<
          R & {
            [N in PageName<ParentOf<R>, TPath>]: PageRouteType<
              RouteUnder<
                ParentOf<R>,
                TPath,
                string,
                TSearchValidator,
                TParams,
                TRouteContextFn,
                TBeforeLoadFn,
                TLoaderDeps,
                TLoaderFn,
                TSSR
              >
            >
          }
        >
      >
      /**
       * A pathless layout (`_app` in file routes): its component renders `<Outlet />` around
       * the pages declared inside `define`. Guards go in `beforeLoad`.
       */
      layout<
        TId extends string,
        G extends Record<string, unknown> = {},
        TSearchValidator = undefined,
        TRouteContextFn = AnyContext,
        TBeforeLoadFn = AnyContext,
        TLoaderDeps extends Record<string, any> = {},
        TLoaderFn = undefined,
        TSSR = unknown,
      >(
        id: TId,
        options: LayoutRouteOptions<
          ParentOf<R>,
          TId,
          TSearchValidator,
          TRouteContextFn,
          TBeforeLoadFn,
          TLoaderDeps,
          TLoaderFn,
          TSSR
        >,
        define: (
          r: KitrRouter<
            K & ExtensionKey,
            Prettify<
              Omit<R, '~parent'> & {
                '~parent': RouteUnder<
                  ParentOf<R>,
                  '/',
                  TId,
                  TSearchValidator,
                  {},
                  TRouteContextFn,
                  TBeforeLoadFn,
                  TLoaderDeps,
                  TLoaderFn,
                  TSSR
                >
              }
            >
          >,
        ) => KitrRouter<K & ExtensionKey, G> | void,
      ): KitrRouter<
        K & ExtensionKey,
        Prettify<
          R & {
            [N in `layout ${ResolveId<ParentOf<R>, TId, '/'>}`]: PageRouteType<
              RouteUnder<
                ParentOf<R>,
                '/',
                TId,
                TSearchValidator,
                {},
                TRouteContextFn,
                TBeforeLoadFn,
                TLoaderDeps,
                TLoaderFn,
                TSSR
              >,
              'page-layout'
            >
          } & Omit<G, `~${string}`>
        >
      >
    }
  }

  interface RouteGroupChild<
    K extends string,
    R extends Record<string, unknown>,
    P extends string,
    O extends GroupOptions,
  > {
    /** Pages inside `group(prefix)` hang off a path route for the prefix, kept as `group /prefix`. */
    pages: { '~parent': GroupRoute<R, P, O> } & {
      [N in `group ${JoinPaths<TrimRight<ParentOf<R>['fullPath']>, P>}`]: GroupRouteType<R, P, O>
    }
  }
}

/** Reserved for the group route the `pages` extension registers under a group. Not a route type itself. */
export type GroupRouteType<R, P extends string, O> = PageRouteType<
  GroupRoute<R, P, O>,
  'page-group'
>

interface PagesState {
  /** Entry name of the route pages added here become children of; `null` means the root. */
  parent: string | null
  /** Group prefix segments since the parent route, for pages' TanStack `path`. */
  pendingPrefix: string
  /** TanStack id of the parent route (`''` for the root, `/_app`, `/admin/_app`): layouts are named by theirs. */
  id: string
}

const STATE = 'pages'

function pagesState(table: AnyRouteTable): PagesState {
  const states = table.state as Record<string, PagesState>
  states[STATE] ??= { parent: null, pendingPrefix: '', id: '' }
  return states[STATE]
}

const KITR_KEYS = [
  'presentation',
  'keepAlive',
  'stackParent',
  'platforms',
  'render',
  'lazy',
] as const

/** Split kitr's page options from TanStack's, moving the stack options into `staticData`. */
function splitOptions(options: Record<string, unknown>) {
  const kitr: Record<string, unknown> = {}
  const tanstack: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(options)) {
    if ((KITR_KEYS as readonly string[]).includes(k)) kitr[k] = v
    else tanstack[k] = v
  }
  const staticData = { ...(tanstack.staticData as object | undefined) } as Record<string, unknown>
  for (const k of ['presentation', 'keepAlive', 'stackParent', 'platforms', 'render'] as const)
    if (kitr[k] !== undefined) staticData[k] = kitr[k]
  if (Object.keys(staticData).length) tanstack.staticData = staticData
  return {
    tanstack,
    lazy: kitr.lazy as KitrPageOptions['lazy'],
    platforms: kitr.platforms as string[] | undefined,
  }
}

interface PageEntry extends RouteEntry {
  kind: 'page' | 'page-layout' | 'page-group' | 'page-root'
  parent: string | null
  /** TanStack `path` (pages, groups) or `id` (layouts). */
  segment: string
  options: Record<string, unknown>
  lazy?: KitrPageOptions['lazy']
  platforms?: string[]
}

/**
 * The pages extension for the kitr route table: `.root`, `.page` and `.layout` on
 * `defineRoutes([pages], ...)`, compiled to a TanStack Router tree by `createKitrRouter({ routes })`.
 *
 *   import pages from 'kitr/router/routes'
 *   export const routes = defineRoutes([pages], (r) =>
 *     r.root({ head, component: RootDocument }).page('/', { lazy: () => import('./pages/home') }),
 *   )
 */
const pages = defineRouteExtension({
  key: 'pages',
  kinds: ['page', 'page-layout', 'page-group', 'page-root'],
  methods: {
    root(this: AnyRouteTable, options: Record<string, unknown>) {
      if (this.entries.some((e) => e.kind === 'page-root'))
        throw new Error('[kitr/router] routes.root() may only be called once')
      this.add({ kind: 'page-root', path: '/', name: '~root', parent: null, segment: '', options })
      return this
    },
    page(this: AnyRouteTable, path: string, options: Record<string, unknown> = {}) {
      const state = pagesState(this)
      const { tanstack, lazy, platforms } = splitOptions(options)
      const fullPath = joinPath(this.prefix, path)
      this.add({
        kind: 'page',
        path: fullPath,
        name: `page ${fullPath}`,
        parent: state.parent,
        segment: joinPath(state.pendingPrefix, path),
        options: tanstack,
        lazy,
        platforms,
      })
      return this
    },
    layout(this: AnyRouteTable, id: string, ...rest: unknown[]) {
      const define = rest.pop() as (r: AnyRouteTable) => unknown
      const options = (rest[0] ?? {}) as Record<string, unknown>
      const state = pagesState(this)
      const { tanstack, lazy, platforms } = splitOptions(options)
      const routeId = `${state.id}/${id}`
      const name = `layout ${routeId}`
      this.add({
        kind: 'page-layout',
        path: this.prefix || '/',
        name,
        parent: state.parent,
        segment: id,
        options: tanstack,
        lazy,
        platforms,
      })
      // A layout is a child table with the same prefix and middleware; only the parent changes.
      this.group('', {}, (child) => {
        ;(child.state as Record<string, PagesState>)[STATE] = {
          parent: name,
          pendingPrefix: state.pendingPrefix,
          id: routeId,
        }
        define(child)
      })
      return this
    },
  },
  group(child, parent, prefix, options) {
    const state = pagesState(parent)
    if (!prefix || prefix === '/') {
      // No path segment: nothing for TanStack to match; children keep the parent's route.
      ;(child.state as Record<string, PagesState>)[STATE] = { ...state }
      return
    }
    const { tanstack, platforms } = splitOptions(
      Object.fromEntries(
        Object.entries(options).filter(([k]) => !['prefix', 'middleware', 'as'].includes(k)),
      ),
    )
    const name = `group ${child.prefix}`
    child.add({
      kind: 'page-group',
      path: child.prefix,
      name,
      parent: state.parent,
      segment: joinPath(state.pendingPrefix, prefix),
      options: tanstack,
      platforms,
    })
    ;(child.state as Record<string, PagesState>)[STATE] = {
      parent: name,
      pendingPrefix: '',
      id: `${state.id}${joinPath(state.pendingPrefix, prefix).replace(/\/$/, '')}`,
    }
  },
  targets: {
    tanstack: compileTree,
  },
})

export default pages
export { pages }

/** What `compile('tanstack', options)` receives from `createKitrRouter`. */
export interface CompileTreeOptions {
  /** The current platform name; pages whose `platforms` leave it out are dropped. */
  platform?: string
  /** Default root route options when the table has no `.root(...)`. */
  root?: Record<string, unknown>
}

function DefaultRootComponent() {
  return <Outlet />
}

/** Build the TanStack route tree from the table's page entries. */
export function compileTree(entries: RouteEntry[], options: CompileTreeOptions = {}): AnyRoute {
  const all = entries as PageEntry[]
  const platform = options.platform
  const shipped = (e: PageEntry) => !platform || !e.platforms || e.platforms.includes(platform)
  const rootEntry = all.find((e) => e.kind === 'page-root')
  const rootRoute = createRootRouteWithContext<KitrRouterContext>()({
    component: DefaultRootComponent,
    ...(options.root ?? {}),
    ...(rootEntry?.options ?? {}),
  } as RootRouteOptions<Register, undefined, KitrRouterContext>)

  const byName = new Map<string, AnyRoute>()
  const childrenOf = new Map<string | null, PageEntry[]>()
  for (const entry of all) {
    if (entry.kind === 'page-root' || !shipped(entry)) continue
    const list = childrenOf.get(entry.parent) ?? []
    list.push(entry)
    childrenOf.set(entry.parent, list)
  }
  // A group or layout with no page under it has nothing to render: leave it out of the tree.
  const hasPages = (entry: PageEntry): boolean =>
    entry.kind === 'page' || (childrenOf.get(entry.name) ?? []).some(hasPages)

  const build = (parentName: string | null, parentRoute: AnyRoute): Record<string, AnyRoute> => {
    const children: Record<string, AnyRoute> = {}
    for (const entry of childrenOf.get(parentName) ?? []) {
      if (!hasPages(entry)) continue
      const route = createRoute({
        getParentRoute: () => parentRoute,
        ...(entry.kind === 'page-layout' ? { id: entry.segment } : { path: entry.segment }),
        ...entry.options,
      } as never) as AnyRoute
      if (entry.lazy) {
        const lazy = entry.lazy
        route.lazy(async () => {
          const mod = await lazy()
          const page = 'default' in mod ? mod.default : mod
          const spec: PageModule = typeof page === 'function' ? { component: page } : page
          return createLazyRoute(route.id as never)(spec)
        })
      }
      byName.set(entry.name, route)
      const grandChildren = build(entry.name, route)
      children[entry.name] = Object.keys(grandChildren).length
        ? route.addChildren(grandChildren)
        : route
    }
    return children
  }

  const children = build(null, rootRoute)
  return rootRoute.addChildren(children) as unknown as AnyRoute
}

// Type-level tree: the compiled route tree, so `Register` types links and `getRouteApi`.

type IsAny<T> = 0 extends 1 & T ? true : false

/** `Rt` with its `TChildren` replaced by `C`, for a root or a child route. */
export type WithChildren<Rt, C> =
  IsAny<Rt extends { types: { parentRoute: infer P } } ? P : never> extends true
    ? Rt extends RootRoute<
        infer TRegister,
        infer TSearchValidator,
        infer TRouterContext,
        infer TRouteContextFn,
        infer TBeforeLoadFn,
        infer TLoaderDeps extends Record<string, any>,
        infer TLoaderFn,
        any,
        infer TFileRouteTypes,
        infer TSSR,
        infer TServerMiddlewares,
        infer THandlers
      >
      ? RootRoute<
          TRegister,
          TSearchValidator,
          TRouterContext,
          TRouteContextFn,
          TBeforeLoadFn,
          TLoaderDeps,
          TLoaderFn,
          C,
          TFileRouteTypes,
          TSSR,
          TServerMiddlewares,
          THandlers
        >
      : never
    : Rt extends Route<
          infer TRegister,
          infer TParentRoute extends AnyRoute,
          infer TPath extends string,
          infer TFullPath extends string,
          infer TCustomId extends string,
          infer TId extends string,
          infer TSearchValidator,
          infer TParams,
          infer TRouterContext,
          infer TRouteContextFn,
          infer TBeforeLoadFn,
          infer TLoaderDeps extends Record<string, any>,
          infer TLoaderFn,
          any,
          infer TFileRouteTypes,
          infer TSSR,
          infer TServerMiddlewares,
          infer THandlers
        >
      ? Route<
          TRegister,
          TParentRoute,
          TPath,
          TFullPath,
          TCustomId,
          TId,
          TSearchValidator,
          TParams,
          TRouterContext,
          TRouteContextFn,
          TBeforeLoadFn,
          TLoaderDeps,
          TLoaderFn,
          C,
          TFileRouteTypes,
          TSSR,
          TServerMiddlewares,
          THandlers
        >
      : never

type RouteOfEntry<T> = T extends { route: infer Rt extends AnyRoute } ? Rt : never
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false

/** Entries whose route's parent is `P`. */
type ChildKeys<R, P extends AnyRoute> = {
  [K in keyof R]: K extends `~${string}`
    ? never
    : RouteOfEntry<R[K]> extends infer Rt extends AnyRoute
      ? Same<Rt['types']['parentRoute'], P> extends true
        ? K
        : never
      : never
}[keyof R]

/** Children that are pages, or layouts and groups with a page somewhere under them. */
type LiveChildKeys<R, P extends AnyRoute> = {
  [K in ChildKeys<R, P>]: R[K] extends { kind: 'page' }
    ? K
    : [LiveChildKeys<R, RouteOfEntry<R[K]>>] extends [never]
      ? never
      : K
}[ChildKeys<R, P>]

// A leaf keeps `TChildren = unknown`: TanStack's `ParseRoute` stops there, where `{}` would end the walk in `never`.
type Subtree<R, Rt extends AnyRoute> = [LiveChildKeys<R, Rt>] extends [never]
  ? Rt
  : WithChildren<Rt, { [K in LiveChildKeys<R, Rt>]: Subtree<R, RouteOfEntry<R[K]>> }>

/** The route tree `compile('tanstack')` returns for a table's `$types`: what `createKitrRouter({ routes })` registers. */
export type RouteTreeOf<R> = Subtree<R, RootOf<R>>
