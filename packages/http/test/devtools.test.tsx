import { createApp } from '@kitr/core'
import { createDevtoolsHub } from '@kitr/devtools'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { panels, toCurl } from '../src/devtools'
import { httpProvider } from '../src/provider'

async function setup() {
  const fetch = (async (input: Request | string | URL, init?: RequestInit) => {
    const req = input instanceof Request ? input : new Request(input, init)
    return req.url.endsWith('/missing')
      ? new Response('nope', { status: 404, headers: { 'content-type': 'text/plain' } })
      : Response.json({ id: 1 })
  }) as typeof globalThis.fetch
  const app = createApp({
    providers: [httpProvider],
    config: {
      http: { baseUrl: 'https://api.dev', fetch, retry: 0, getToken: () => 'secret-token' },
    },
  })
  const hub = createDevtoolsHub()
  app.container.value('devtools', hub)
  await app.boot()
  const http = app.container.use('http')
  await http.get('users')
  await http.get('missing').catch(() => {})
  return { app, hub }
}

describe('http devtools', () => {
  it('logs status, duration and redacted headers with a body preview', async () => {
    const { hub } = await setup()
    const ok = hub.entries('http')[0]
    expect(ok).toBeDefined()
    expect(ok?.label).toMatch(/^GET \/users → 200 \(\d+ms\)$/)
    expect(ok?.data).toMatchObject({
      method: 'GET',
      path: '/users',
      status: 200,
      ok: true,
      body: '{"id":1}',
      requestHeaders: { authorization: '•••' },
    })
    expect(typeof (ok?.data as { ms: number } | undefined)?.ms).toBe('number')
    expect(hub.entries('http')[1]?.level).toBe('warn')
  })

  it('renders rows newest first and filters by status class', async () => {
    const { app } = await setup()
    const [panel] = panels()
    render(<div>{panel?.render(app)}</div>)
    expect(screen.getByText('/users')).toBeTruthy()
    expect(screen.getByText('/missing')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /4xx/ }))
    expect(screen.queryByText('/users')).toBeNull()
    expect(screen.getByText('/missing')).toBeTruthy()
    expect(panel?.badge?.(app)).toBeNull()
  })

  it('builds curl without redacted headers', () => {
    expect(
      toCurl({
        method: 'GET',
        url: "https://a.dev/x?q='1'",
        requestHeaders: { accept: 'application/json', authorization: '•••' },
      }),
    ).toBe("curl -X GET 'https://a.dev/x?q='\\''1'\\''' -H 'accept: application/json'")
  })
})
