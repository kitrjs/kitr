import { createApp, KitrError, operations } from '@kitr/core'
import { KitrProvider } from '@kitr/react'
import { act, render, renderHook, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  applyCacheEffect,
  call,
  createQueryClient,
  defineMutation,
  defineQuery,
  defineSubscription,
  invalidate,
  QueryClient,
  QueryClientProvider,
  queryOptions,
  queryProvider,
  useKitrMutation,
  useMutation,
  useQuery,
  useSubscription,
  useSuspenseQuery,
} from '../src'

const wrapperFor = (client: QueryClient) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }

describe('createQueryClient', () => {
  it('defaults staleTime to 30s and lets config override', () => {
    expect(createQueryClient().getDefaultOptions().queries?.staleTime).toBe(30_000)
    expect(createQueryClient({ staleTime: 5 }).getDefaultOptions().queries?.staleTime).toBe(5)
    const custom = new QueryClient()
    expect(createQueryClient({ createClient: () => custom })).toBe(custom)
  })

  it('never retries 4xx, retries other failures twice', () => {
    const retry = createQueryClient().getDefaultOptions().queries?.retry as (
      n: number,
      e: unknown,
    ) => boolean
    expect(retry(0, new KitrError('NOT_FOUND'))).toBe(false)
    expect(retry(0, new KitrError('UNAVAILABLE'))).toBe(true)
    expect(retry(1, new Error('x'))).toBe(true)
    expect(retry(2, new Error('x'))).toBe(false)
  })
})

describe('defineQuery', () => {
  it('produces queryOptions with key, staleTime, meta and KitrError normalisation', async () => {
    const q = defineQuery<{ id: string }, { id: string }>({
      key: ({ id }) => ['p', id],
      fetch: async ({ id }) => {
        if (id === 'x') throw new TypeError('fetch failed')
        return { id }
      },
      source: 'http',
      staleTime: 10,
    })
    const opts = q.options({ id: '1' })
    expect(opts.queryKey).toEqual(['p', '1'])
    expect(opts.staleTime).toBe(10)
    expect(opts.meta).toEqual({ source: 'http' })
    const client = new QueryClient()
    expect(await client.fetchQuery(q.options({ id: '1' }))).toEqual({ id: '1' })
    const error = await client
      .fetchQuery({ ...q.options({ id: 'x' }), retry: false })
      .catch((e) => e)
    expect(error).toBeInstanceOf(KitrError)
    expect(error.code).toBe('NETWORK')
    expect(q.key({ id: '2' })).toEqual(['p', '2'])
    expect(await q.fetch({ id: '3' })).toEqual({ id: '3' })
  })

  it('renders through useQuery', async () => {
    const q = defineQuery({ key: () => ['hello'], fetch: async () => 'world' })
    const client = new QueryClient()
    function View() {
      const { data } = useQuery(q.options())
      return <p>{data ?? 'loading'}</p>
    }
    render(<View />, { wrapper: wrapperFor(client) })
    expect(await screen.findByText('world')).toBeTruthy()
  })
})

describe('cache effects', () => {
  it('applies set, remove and invalidate', async () => {
    const client = new QueryClient()
    client.setQueryData(['a', 1], 'old')
    client.setQueryData(['b'], 'gone')
    client.setQueryData(['c', 'list'], [1])
    await applyCacheEffect(client, {
      set: [{ key: ['a', 1], data: 'new' }],
      remove: [['b']],
      invalidate: [['c']],
    })
    expect(client.getQueryData(['a', 1])).toBe('new')
    expect(client.getQueryData(['b'])).toBeUndefined()
    expect(client.getQueryState(['c', 'list'])?.isInvalidated).toBe(true)
    await applyCacheEffect(client, undefined)
  })

  it('invalidate() takes several keys', async () => {
    const client = new QueryClient()
    client.setQueryData(['x'], 1)
    client.setQueryData(['y'], 1)
    await invalidate(client, ['x'], ['y'])
    expect(client.getQueryState(['x'])?.isInvalidated).toBe(true)
    expect(client.getQueryState(['y'])?.isInvalidated).toBe(true)
  })
})

describe('defineMutation', () => {
  it('computes effects from the result and applies them on success', async () => {
    const client = new QueryClient()
    const m = defineMutation<{ name: string }, { id: string; name: string }>({
      mutate: async ({ name }) => ({ id: '9', name }),
      effects: (result) => ({ set: [{ key: ['p', result.id], data: result }] }),
    })
    expect(m.effectsFor({ id: '1', name: 'a' }, { name: 'a' })).toEqual({
      set: [{ key: ['p', '1'], data: { id: '1', name: 'a' } }],
    })
    const { result } = renderHook(() => useKitrMutation(m, { onSuccess: vi.fn() }), {
      wrapper: wrapperFor(client),
    })
    await act(() => result.current.mutateAsync({ name: 'Zed' }))
    expect(client.getQueryData(['p', '9'])).toEqual({ id: '9', name: 'Zed' })
  })

  it('runs both its own and the caller onSuccess', async () => {
    const client = new QueryClient()
    const callerSuccess = vi.fn()
    const m = defineMutation({ mutate: async () => 1, effects: { invalidate: [['all']] } })
    const { result } = renderHook(() => useKitrMutation(m, { onSuccess: callerSuccess }), {
      wrapper: wrapperFor(client),
    })
    await act(() => result.current.mutateAsync())
    expect(callerSuccess).toHaveBeenCalledOnce()
  })

  it('normalises failures to KitrError', async () => {
    const client = new QueryClient()
    const m = defineMutation({
      mutate: async () => {
        throw { code: 'CONFLICT', message: 'dup', status: 409 }
      },
    })
    const { result } = renderHook(() => useKitrMutation(m), { wrapper: wrapperFor(client) })
    await act(async () => {
      await result.current.mutateAsync().catch(() => {})
    })
    await waitFor(() => expect(result.current.error).toBeInstanceOf(KitrError))
    expect((result.current.error as KitrError).code).toBe('CONFLICT')
  })
})

describe('useSubscription', () => {
  function setup() {
    let emit!: (e: { id: string }) => void
    let fail!: (e: any) => void
    const unsubscribe = vi.fn()
    const subscribe = vi.fn((_input: { room: string }, handlers: any) => {
      emit = handlers.next
      fail = handlers.error
      return unsubscribe
    })
    const def = defineSubscription<{ room: string }, { id: string }>({
      key: ({ room }) => ['room', room],
      subscribe,
      effects: (event) => ({ set: [{ key: ['last'], data: event.id }] }),
    })
    return {
      def,
      subscribe,
      unsubscribe,
      emit: (e: { id: string }) => emit(e),
      fail: (e: any) => fail(e),
    }
  }

  it('subscribes, applies effects, reports events and unsubscribes on unmount', async () => {
    const client = new QueryClient()
    const s = setup()
    const onEvent = vi.fn()
    const { result, unmount } = renderHook(
      () => useSubscription(s.def, { room: 'a' }, { onEvent }),
      {
        wrapper: wrapperFor(client),
      },
    )
    expect(result.current.status).toBe('open')
    act(() => s.emit({ id: 'e1' }))
    expect(result.current.lastEvent).toEqual({ id: 'e1' })
    expect(onEvent).toHaveBeenCalledWith({ id: 'e1' })
    await waitFor(() => expect(client.getQueryData(['last'])).toBe('e1'))
    unmount()
    expect(s.unsubscribe).toHaveBeenCalledOnce()
  })

  it('resubscribes only when the input key changes', () => {
    const client = new QueryClient()
    const s = setup()
    const { rerender } = renderHook(({ room }) => useSubscription(s.def, { room }), {
      wrapper: wrapperFor(client),
      initialProps: { room: 'a' },
    })
    rerender({ room: 'a' })
    expect(s.subscribe).toHaveBeenCalledTimes(1)
    rerender({ room: 'b' })
    expect(s.subscribe).toHaveBeenCalledTimes(2)
    expect(s.unsubscribe).toHaveBeenCalledTimes(1)
  })

  it('stays idle when disabled and reports errors', () => {
    const client = new QueryClient()
    const s = setup()
    const { result, rerender } = renderHook(
      ({ enabled }) => useSubscription(s.def, { room: 'a' }, { enabled }),
      {
        wrapper: wrapperFor(client),
        initialProps: { enabled: false },
      },
    )
    expect(result.current.status).toBe('idle')
    expect(s.subscribe).not.toHaveBeenCalled()
    rerender({ enabled: true })
    act(() => s.fail({ code: 'FORBIDDEN', message: 'no', status: 403 }))
    expect(result.current.status).toBe('error')
    expect(result.current.error?.code).toBe('FORBIDDEN')
  })
})

describe('queryProvider', () => {
  it('binds a client and wraps the tree so hooks work', async () => {
    const app = createApp({ providers: [queryProvider], config: { query: { staleTime: 1 } } })
    await app.boot()
    const client = app.container.use('queryClient')
    expect(client.getDefaultOptions().queries?.staleTime).toBe(1)
    client.setQueryData(['greeting'], 'hi')
    function View() {
      const { data } = useQuery({ queryKey: ['greeting'], queryFn: () => 'fetched' })
      return <p>{data}</p>
    }
    render(
      <KitrProvider app={app}>
        <View />
      </KitrProvider>,
    )
    expect(screen.getByText('hi')).toBeTruthy()
  })

  it('notifies devtools on cache changes and logs failed mutations', async () => {
    const hub = { notify: vi.fn(), log: vi.fn() }
    const app = createApp({ providers: [queryProvider] })
    app.container.value('devtools', hub as any)
    await app.boot()
    const client = app.container.use('queryClient')
    client.setQueryData(['x'], 1)
    expect(hub.notify).toHaveBeenCalled()
    await client
      .getMutationCache()
      .build(client, {
        mutationKey: ['save'],
        mutationFn: async () => {
          throw new Error('nope')
        },
      })
      .execute(undefined)
      .catch(() => {})
    expect(hub.log).toHaveBeenCalledWith(
      'query',
      'mutation failed: ["save"]',
      expect.any(Error),
      'error',
    )
  })
})

describe('name and definition forms', () => {
  const listProjects = defineQuery<{ owner?: string }, string[]>({
    key: (input) => ['projects', input?.owner ?? 'all'],
    fetch: async (input) => [input?.owner ?? 'all'],
    source: 'action',
  })
  const updateProject = defineMutation<{ id: string }, { id: string }>({
    mutate: async ({ id }) => ({ id }),
    effects: { invalidate: [['projects']] },
  })
  const named = {
    'projects.list': Object.assign(listProjects, {
      kind: 'query' as const,
      name: 'projects.list',
      contract: {},
    }),
    'projects.update': Object.assign(updateProject, {
      kind: 'mutation' as const,
      name: 'projects.update',
      contract: {},
    }),
  }

  beforeEach(() => {
    operations.reset()
    operations.register(named)
  })

  it('useQuery resolves a registered name and a definition to the same options', async () => {
    const client = new QueryClient()
    const byName = renderHook(() => useQuery('projects.list' as any, { owner: 'ada' }), {
      wrapper: wrapperFor(client),
    })
    await waitFor(() => expect(byName.result.current.isSuccess).toBe(true))
    expect(byName.result.current.data).toEqual(['ada'])
    const byDefinition = renderHook(() => useQuery(named['projects.list'], { owner: 'ada' }), {
      wrapper: wrapperFor(client),
    })
    await waitFor(() => expect(byDefinition.result.current.isSuccess).toBe(true))
    expect(client.getQueryData(['projects', 'ada'])).toEqual(['ada'])
    expect(client.getQueryCache().getAll()).toHaveLength(1)
  })

  it('useQuery passes overrides through and still accepts plain TanStack options', async () => {
    const client = new QueryClient()
    const { result } = renderHook(
      () => useQuery('projects.list' as any, undefined, { enabled: false }),
      { wrapper: wrapperFor(client) },
    )
    expect(result.current.fetchStatus).toBe('idle')
    const plain = renderHook(() => useQuery({ queryKey: ['plain'], queryFn: () => 'ok' }), {
      wrapper: wrapperFor(client),
    })
    await waitFor(() => expect(plain.result.current.data).toBe('ok'))
  })

  it('queryOptions works for loaders and useSuspenseQuery reads the cache it fills', async () => {
    const client = new QueryClient()
    const opts = queryOptions('projects.list' as any, { owner: 'grace' })
    expect(opts.queryKey).toEqual(['projects', 'grace'])
    await client.ensureQueryData(opts)
    const { result } = renderHook(
      () => useSuspenseQuery('projects.list' as any, { owner: 'grace' }),
      {
        wrapper: wrapperFor(client),
      },
    )
    await waitFor(() => expect(result.current.data).toEqual(['grace']))
  })

  it('useMutation by name applies cache effects and then the caller onSuccess', async () => {
    const client = new QueryClient()
    client.setQueryData(['projects', 'all'], ['stale'])
    const onSuccess = vi.fn()
    const { result } = renderHook(() => useMutation('projects.update' as any, { onSuccess }), {
      wrapper: wrapperFor(client),
    })
    await act(async () => {
      await result.current.mutateAsync({ id: '1' })
    })
    expect(onSuccess).toHaveBeenCalledWith({ id: '1' }, { id: '1' }, undefined, expect.anything())
    expect(client.getQueryState(['projects', 'all'])?.isInvalidated).toBe(true)
  })

  it('call runs a query or a mutation by name', async () => {
    await expect(call('projects.list' as any, { owner: 'linus' })).resolves.toEqual(['linus'])
    await expect(call('projects.update' as any, { id: '2' })).resolves.toEqual({ id: '2' })
  })

  it('explains an unknown name or the wrong kind', () => {
    expect(() => queryOptions('projects.missing' as any)).toThrow(/projects\.missing/)
    expect(() => queryOptions('projects.update' as any)).toThrow(/is a mutation/)
    const client = new QueryClient()
    expect(() =>
      renderHook(() => useMutation('projects.list' as any), { wrapper: wrapperFor(client) }),
    ).toThrow(/is a query/)
  })
})
