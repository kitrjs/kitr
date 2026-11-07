import type { AnyRouteMatch, AnyRouter, ParsedLocation } from '@tanstack/react-router'
import { createStore, derivedStore, type ReadableStore, type WritableStore } from './store'

/**
 * A kept-alive page is rendered through a view of the router whose stores belong to that page.
 * TanStack's hooks (`useMatch`, `useLoaderData`, `useParams`, `<Outlet>`) read
 * `router.stores.getMatchStore(routeId)` and `router.stores.ids`; by pointing those at the page's
 * own stores, a page that is no longer the current location keeps rendering its last matches, and
 * `/chats/1` under `/chats/2` keeps showing chat 1. Routes above the stack outlet are shared with
 * the live router, so a kept-alive page still sees its layout's live context. Everything else
 * (`navigate`, `buildLocation`, `routesById`, `history`...) is the real router.
 */

export type RouterStatus = 'idle' | 'pending'

export interface EntryStores {
  status: WritableStore<RouterStatus>
  location: WritableStore<ParsedLocation>
  resolvedLocation: WritableStore<ParsedLocation | undefined>
  ids: ReadableStore<string[]>
  matches: WritableStore<AnyRouteMatch[]>
  __store: ReadableStore<{
    status: RouterStatus
    isLoading: boolean
    matches: AnyRouteMatch[]
    location: ParsedLocation
    resolvedLocation: ParsedLocation | undefined
  }>
  byRoute: Map<string, WritableStore<AnyRouteMatch | undefined>>
  getMatchStore(routeId: string): ReadableStore<AnyRouteMatch | undefined>
  setMatches(matches: AnyRouteMatch[]): void
}

/** A page's view of the router: the proxy to render through, its stores, and `update()` to mirror the live router while the page is current. */
export interface EntryRouter {
  /** The view of the router to put in `<RouterContextProvider>` around the page. */
  router: AnyRouter
  stores: EntryStores
  /** Mirror the live router into this page: called while the page is the current location. */
  update(matches: AnyRouteMatch[], location: ParsedLocation, status: RouterStatus): void
}

/** Build the router view for one stack page. `ancestorIds` are the routes above the outlet, shared live with the real router. */
export function createEntryRouter(
  router: AnyRouter,
  ancestorIds: string[],
  initial: { matches: AnyRouteMatch[]; location: ParsedLocation },
): EntryRouter {
  const liveStores = (router as unknown as { stores: EntryStores }).stores
  const status = createStore<RouterStatus>('idle')
  const location = createStore(initial.location)
  const resolvedLocation = createStore<ParsedLocation | undefined>(initial.location)
  const matches = createStore(initial.matches)
  const byRoute = new Map<string, WritableStore<AnyRouteMatch | undefined>>()
  const ids = derivedStore([matches], () => matches.get().map((m) => m.routeId))
  const __store = derivedStore([status, location, resolvedLocation, matches], () => ({
    status: status.get(),
    isLoading: status.get() === 'pending',
    matches: matches.get(),
    location: location.get(),
    resolvedLocation: resolvedLocation.get(),
  }))
  const own = (routeId: string) => {
    let store = byRoute.get(routeId)
    if (!store) {
      store = createStore<AnyRouteMatch | undefined>(
        matches.get().find((m) => m.routeId === routeId),
      )
      byRoute.set(routeId, store)
    }
    return store
  }
  const setMatches = (next: AnyRouteMatch[]) => {
    matches.set(next)
    const seen = new Set<string>()
    for (const match of next) {
      seen.add(match.routeId)
      if (!ancestorIds.includes(match.routeId)) own(match.routeId).set(match)
    }
    for (const [routeId, store] of byRoute) if (!seen.has(routeId)) store.set(undefined)
  }
  const stores: EntryStores = {
    status,
    location,
    resolvedLocation,
    ids,
    matches,
    __store,
    byRoute,
    getMatchStore: (routeId) =>
      ancestorIds.includes(routeId) ? liveStores.getMatchStore(routeId) : own(routeId),
    setMatches,
  }
  setMatches(initial.matches)
  // Methods on the router read `this`; bind them to the real router so `proxy.navigate()` and
  // friends never see this page's stores. Bound once per method so hook dependencies stay stable.
  const bound = new Map<PropertyKey, unknown>()
  const proxy = new Proxy(router as object, {
    get(target, prop) {
      if (prop === 'stores') return stores
      if (prop === 'options') {
        // The app's `Wrap` already wraps the whole tree once; a page must not wrap it again.
        const { Wrap: _wrap, ...rest } = (target as AnyRouter).options
        return rest
      }
      const value = Reflect.get(target, prop, target)
      if (typeof value !== 'function') return value
      let fn = bound.get(prop)
      if (!fn) {
        fn = (value as (...args: unknown[]) => unknown).bind(target)
        bound.set(prop, fn)
      }
      return fn
    },
    set(target, prop, value) {
      return Reflect.set(target, prop, value, target)
    },
  }) as AnyRouter
  return {
    router: proxy,
    stores,
    update(next, loc, nextStatus) {
      setMatches(next)
      location.set(loc)
      if (nextStatus === 'idle') resolvedLocation.set(loc)
      status.set(nextStatus)
    },
  }
}
