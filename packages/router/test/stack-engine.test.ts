import { describe, expect, it } from 'vitest'
import { createBackRegistry } from '../src/stack/back'
import { StackEngine, stackOptionsOf } from '../src/stack/engine'
import { shouldCommit } from '../src/stack/gestures'
import { detectMotionStyle, motionFor } from '../src/stack/motion'
import { createStore, derivedStore } from '../src/stack/store'

const ROOT = '__root__'
const SHELL = '/_shell'

function state(
  pathname: string,
  index: number,
  routeIds: string[],
  staticData: Record<string, Record<string, unknown>> = {},
) {
  const all = [ROOT, SHELL, ...routeIds]
  return {
    outletRouteId: SHELL,
    location: {
      href: pathname,
      pathname,
      search: {},
      searchStr: '',
      hash: '',
      state: { key: `k${index}-${pathname}`, __TSR_index: index },
    } as any,
    matches: all.map((routeId) => ({ routeId, staticData: staticData[routeId] ?? {} })) as any,
  }
}

describe('StackEngine', () => {
  it('pushes deeper pages and pops back to the kept page', () => {
    const engine = new StackEngine()
    expect(engine.apply(state('/', 0, ['/']))?.kind).toBe('push')
    const home = engine.active!
    const t = engine.apply(state('/post/1', 1, ['/post', '/post/$id']))
    expect(t?.kind).toBe('push')
    expect(t?.from).toBe(home.id)
    expect(engine.depth).toBe(2)
    expect(home.phase).toBe('covered')
    engine.settle(t!.id)
    expect(engine.active?.phase).toBe('active')

    const back = engine.apply(state('/', 0, ['/']))
    expect(back?.kind).toBe('pop')
    expect(back?.to).toBe(home.id)
    expect(back?.leaving).toHaveLength(1)
    expect(engine.byId(back!.leaving[0]!)?.phase).toBe('leaving')
    engine.settle(back!.id)
    expect(engine.entries).toHaveLength(1)
    expect(engine.active).toBe(home)
  })

  it('stacks the same route twice (/chats/1 under /chats/2) as two pages', () => {
    const engine = new StackEngine()
    engine.apply(state('/chats/1', 0, ['/chats', '/chats/$id']))
    const t = engine.apply(state('/chats/2', 1, ['/chats', '/chats/$id']))
    expect(t?.kind).toBe('push')
    expect(engine.entries.map((e) => e.pathname)).toEqual(['/chats/1', '/chats/2'])
    expect(engine.entries[0]!.matches.at(-1)).not.toBe(engine.entries[1]!.matches.at(-1))
  })

  it('refreshes the current page in place when only its data changed', () => {
    const engine = new StackEngine()
    engine.apply(state('/', 0, ['/']))
    const before = engine.active!
    const t = engine.apply({
      ...state('/', 0, ['/']),
      matches: [
        { routeId: ROOT },
        { routeId: SHELL },
        { routeId: '/', loaderData: { n: 2 } },
      ] as any,
    })
    expect(t).toBeUndefined()
    expect(engine.active).toBe(before)
    expect((engine.active!.matches.at(-1) as any).loaderData).toEqual({ n: 2 })
  })

  it('treats the same history index as a replace', () => {
    const engine = new StackEngine()
    engine.apply(state('/login', 0, ['/login']))
    const login = engine.active!
    const t = engine.apply(state('/', 0, ['/']))
    expect(t?.kind).toBe('replace')
    expect(t?.leaving).toEqual([login.id])
    engine.settle(t!.id)
    expect(engine.entries.map((e) => e.pathname)).toEqual(['/'])
  })

  it('puts an unknown earlier page beneath when the app started mid-history', () => {
    const engine = new StackEngine()
    engine.apply(state('/post/1', 3, ['/post', '/post/$id']))
    const t = engine.apply(state('/', 2, ['/']))
    expect(t?.kind).toBe('pop')
    engine.settle(t!.id)
    expect(engine.entries.map((e) => e.pathname)).toEqual(['/'])
  })

  it('reads presentation, keepAlive and stackParent from staticData, innermost route last', () => {
    const matches = [
      { routeId: '/post', staticData: { presentation: 'push', keepAlive: false } },
      { routeId: '/post/new', staticData: { presentation: 'cover', stackParent: '/post' } },
    ] as any
    expect(stackOptionsOf(matches)).toEqual({
      presentation: 'cover',
      keepAlive: false,
      stackParent: '/post',
    })
    const engine = new StackEngine()
    engine.apply(state('/post/new', 0, ['/post/new'], { '/post/new': { presentation: 'sheet' } }))
    expect(engine.active?.presentation).toBe('sheet')
  })

  it('limits how many covered pages stay mounted', () => {
    const engine = new StackEngine({ keepAlive: 1 })
    for (let i = 0; i < 4; i++) {
      const t = engine.apply(state(`/p/${i}`, i, ['/p', '/p/$id']))
      engine.settle(t!.id)
    }
    const mounted = engine.entries.filter((e) => engine.isMounted(e)).map((e) => e.pathname)
    expect(mounted).toEqual(['/p/2', '/p/3'])
    const none = new StackEngine({ keepAlive: false })
    none.settle(none.apply(state('/a', 0, ['/a']))!.id)
    none.settle(none.apply(state('/b', 1, ['/b']))!.id)
    expect(none.entries.filter((e) => none.isMounted(e)).map((e) => e.pathname)).toEqual(['/b'])
  })

  it('keeps a stack per tab and reuses a tab page on switch', () => {
    const engine = new StackEngine({
      groupOf: (location) => (location.pathname.startsWith('/search') ? 'search' : 'home'),
    })
    engine.settle(engine.apply(state('/', 0, ['/']))!.id)
    engine.settle(engine.apply(state('/post/1', 1, ['/post', '/post/$id']))!.id)
    // Switch to the search tab (first time: a plain push into a new group).
    const toSearch = engine.apply(state('/search', 2, ['/search']))
    expect(toSearch?.kind).toBe('push')
    expect(toSearch?.groupChanged).toBe(true)
    engine.settle(toSearch!.id)
    expect(engine.depth).toBe(1)
    expect(engine.stackOf('home').map((e) => e.pathname)).toEqual(['/', '/post/1'])
    // Back to the home tab's last page: reused, not duplicated.
    engine.switchingTo = 'home'
    const back = engine.apply(state('/post/1', 3, ['/post', '/post/$id']))
    expect(back?.kind).toBe('switch')
    engine.settle(back!.id)
    expect(engine.entries.filter((e) => e.pathname === '/post/1')).toHaveLength(1)
    expect(engine.depth).toBe(2)
    // Tapping the current tab pops it to its root.
    engine.switchingTo = 'home'
    const root = engine.apply(state('/', 4, ['/']))
    expect(root?.kind).toBe('switch')
    expect(root?.leaving).toHaveLength(1)
    engine.settle(root!.id)
    expect(engine.stackOf('home').map((e) => e.pathname)).toEqual(['/'])
  })

  it('skips the animation for a pop a swipe gesture already showed', () => {
    const engine = new StackEngine()
    engine.settle(engine.apply(state('/', 0, ['/']))!.id)
    const pushed = engine.apply(state('/a', 1, ['/a']))!
    engine.settle(pushed.id)
    engine.gesturePopped = pushed.to
    const pop = engine.apply(state('/', 0, ['/']))
    expect(pop?.animate).toBe(false)
  })

  it('settles a transition still running when the next one starts', () => {
    const engine = new StackEngine()
    engine.apply(state('/', 0, ['/']))
    const first = engine.apply(state('/a', 1, ['/a']))!
    const second = engine.apply(state('/b', 2, ['/b']))!
    expect(engine.transition?.id).toBe(second.id)
    expect(engine.byId(first.to)?.phase).toBe('covered')
    engine.settle(first.id) // stale: ignored
    expect(engine.transition?.id).toBe(second.id)
  })

  it('notifies subscribers and resets', () => {
    const engine = new StackEngine()
    let calls = 0
    const off = engine.subscribe(() => calls++)
    engine.apply(state('/', 0, ['/']))
    expect(calls).toBe(1)
    engine.reset()
    expect(engine.entries).toEqual([])
    off()
    engine.apply(state('/', 0, ['/']))
    expect(calls).toBe(2)
  })
})

describe('back registry', () => {
  it('runs handlers newest first and stops at the first that consumes the press', () => {
    const registry = createBackRegistry()
    const order: string[] = []
    const offA = registry.push(() => {
      order.push('a')
      return true
    })
    registry.push(() => {
      order.push('b')
      return undefined
    })
    expect(registry.run()).toBe(true)
    expect(order).toEqual(['b', 'a'])
    offA()
    expect(registry.run()).toBe(false)
    expect(registry.size).toBe(1)
  })
})

describe('gesture rule', () => {
  it('commits past 30% or when flicked, and never when flicked back', () => {
    expect(shouldCommit(100, 400, 0)).toBe(false)
    expect(shouldCommit(130, 400, 0)).toBe(true)
    expect(shouldCommit(20, 400, 900)).toBe(true)
    expect(shouldCommit(300, 400, -500)).toBe(false)
    expect(shouldCommit(100, 400, 0, { commitAt: 0.2 })).toBe(true)
  })
})

describe('motion', () => {
  it('describes each presentation per style and skips animation under reduced motion', () => {
    expect(motionFor('push', 'ios').under).toBeDefined()
    expect(motionFor('push', 'plain').under).toBeUndefined()
    expect(motionFor('sheet', 'android').scrim).toBe(true)
    expect(motionFor('cover', 'ios').enter[0]).toEqual({ transform: 'translate3d(0, 100%, 0)' })
    expect(motionFor('push', 'none')).toMatchObject({ enter: [], duration: 0 })
  })

  it('detects the style from the device', () => {
    const win = (ua: string, reduced = false, touch = 0) =>
      ({
        matchMedia: () => ({ matches: reduced }),
        navigator: { userAgent: ua, maxTouchPoints: touch },
      }) as unknown as Window
    expect(detectMotionStyle(win('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'))).toBe(
      'ios',
    )
    expect(detectMotionStyle(win('Mozilla/5.0 (Macintosh; Intel Mac OS X)', false, 5))).toBe('ios')
    expect(detectMotionStyle(win('Mozilla/5.0 (Linux; Android 14)'))).toBe('android')
    expect(detectMotionStyle(win('Mozilla/5.0 (Windows NT 10.0)'))).toBe('plain')
    expect(detectMotionStyle(win('Mozilla/5.0 (Linux; Android 14)', true))).toBe('none')
    expect(detectMotionStyle(undefined)).toBe('plain')
  })
})

describe('stores', () => {
  it('notify on change and derive lazily', () => {
    const a = createStore(1)
    const b = createStore(2)
    const sum = derivedStore([a, b], () => a.get() + b.get())
    expect(sum.get()).toBe(3)
    let seen: number[] = []
    const sub = sum.subscribe(() => seen.push(sum.get()))
    a.set(5)
    a.set(5) // unchanged: silent
    b.set((prev) => prev + 1)
    expect(seen).toEqual([7, 8])
    sub.unsubscribe()
    seen = []
    a.set(0)
    expect(seen).toEqual([])
    expect(sum.get()).toBe(3)
  })
})
