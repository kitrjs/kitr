import { defineProvider } from '@kitr/core'
import queryProvider from '@kitr/query/provider'
import { useApp } from '@kitr/react'
import { useQuery } from '@tanstack/react-query'
import { screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { createTestApp, createTestClient } from '../src'
import { renderWithKitr } from '../src/react'

describe('createTestApp', () => {
  it('boots with environment test and the given providers', async () => {
    const booted: string[] = []
    const app = await createTestApp({
      providers: [defineProvider({ name: 'probe', boot: () => void booted.push('probe') })],
      config: { probe: { on: true } } as any,
    })
    expect(app.mode).toBe('test')
    expect(booted).toEqual(['probe'])
  })
})

describe('createTestClient', () => {
  const target = {
    async fetch(request: Request) {
      const url = new URL(request.url)
      const body = request.body ? await request.text() : null
      if (url.pathname === '/text') return new Response('plain words')
      if (url.pathname === '/empty') return new Response(null, { status: 204 })
      return Response.json(
        {
          method: request.method,
          path: url.pathname + url.search,
          body: body ? JSON.parse(body) : null,
          contentType: request.headers.get('content-type'),
          auth: request.headers.get('authorization'),
          accept: request.headers.get('accept'),
        },
        { status: request.method === 'POST' ? 201 : 200, headers: { 'x-test': '1' } },
      )
    },
  }
  const client = createTestClient(target, { headers: { authorization: 'Bearer t' } })

  it('sends every verb with JSON bodies, default and per-call headers', async () => {
    const get = await client.get<any>('/items?page=2')
    expect(get.status).toBe(200)
    expect(get.headers.get('x-test')).toBe('1')
    expect(get.body).toMatchObject({
      method: 'GET',
      path: '/items?page=2',
      body: null,
      auth: 'Bearer t',
      accept: 'application/json',
    })
    expect(get.body.contentType).toBeNull()
    const post = await client.post<any>('/items', { name: 'a' })
    expect(post.status).toBe(201)
    expect(post.body).toMatchObject({ body: { name: 'a' }, contentType: 'application/json' })
    for (const verb of ['put', 'patch'] as const)
      expect((await client[verb]<any>('/items/1', { n: 1 })).body.method).toBe(verb.toUpperCase())
    expect((await client.delete<any>('/items/1')).body.method).toBe('DELETE')
    const override = await client.get<any>('/x', { headers: { authorization: 'Bearer other' } })
    expect(override.body.auth).toBe('Bearer other')
  })

  it('keeps non-JSON and empty bodies usable', async () => {
    expect((await client.get('/text')).body).toBe('plain words')
    const empty = await client.get('/empty')
    expect(empty.status).toBe(204)
    expect(empty.body).toBeUndefined()
  })

  it('sends a falsy JSON body (0, false, null) instead of dropping it', async () => {
    expect((await client.post<any>('/x', 0)).body.body).toBe(0)
    expect((await client.post<any>('/x', false)).body.body).toBe(false)
  })
})

describe('renderWithKitr', () => {
  function Project() {
    const { data } = useQuery({
      queryKey: ['projects', '1'],
      queryFn: async () => ({ name: 'from network' }),
      staleTime: Infinity,
    })
    return <p>{data?.name ?? 'loading'}</p>
  }
  function Mode() {
    return <p>mode {useApp().mode}</p>
  }

  it('renders inside KitrProvider with a seeded query cache and an extra wrapper', async () => {
    const app = await createTestApp({ providers: [queryProvider] })
    const Extra = ({ children }: { children: ReactNode }) => (
      <section aria-label="extra">{children}</section>
    )
    renderWithKitr(
      <>
        <Project />
        <Mode />
      </>,
      { app, queryData: [[['projects', '1'], { name: 'seeded' }]], wrapper: Extra },
    )
    expect(await screen.findByText('seeded')).toBeTruthy()
    expect(screen.getByText('mode test')).toBeTruthy()
    expect(screen.getByLabelText('extra')).toBeTruthy()
  })

  it('ignores queryData when no query provider is installed', async () => {
    const app = await createTestApp()
    renderWithKitr(<Mode />, { app, queryData: [[['x'], 1]] })
    expect(await screen.findByText('mode test')).toBeTruthy()
  })
})
