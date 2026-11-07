import { KitrError } from '@kitr/core'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  HttpResponse,
  kitrErrorResponse,
  mockRoutes,
  mockValidationError,
  setupNodeMocks,
} from '../src'

const base = 'http://mock.test'
const table = [
  { name: 'projects.index', method: 'GET', path: '/projects' },
  { name: 'projects.show', method: 'GET', path: '/projects/:id' },
  { name: 'projects.store', method: 'POST', path: '/projects' },
  { name: 'projects.destroy', method: 'DELETE', path: '/projects/:id' },
  { name: 'projects.update', method: 'PATCH', path: '/projects/:id' },
  { name: 'teapot', method: 'GET', path: '/teapot' },
  { name: 'boom', method: 'GET', path: '/boom' },
]

describe('mockRoutes', () => {
  let server: Awaited<ReturnType<typeof setupNodeMocks>>
  beforeAll(async () => {
    server = await setupNodeMocks([
      ...mockRoutes(table, `${base}/`, {
        'projects.index': [{ id: '1' }],
        'projects.show': ({ params }) => {
          if (params.id === '404') throw KitrError.notFound('Project')
          return { id: params.id }
        },
        'projects.store': async ({ body }) => ({ created: await body() }),
        'projects.destroy': () => undefined,
        teapot: () => new HttpResponse('short and stout', { status: 418 }),
        boom: () => {
          throw new Error('kaboom')
        },
      }),
      mockValidationError('post', `${base}/signup`, { email: ['taken'] }),
    ])
  })
  afterAll(() => server.close())

  it('serves static values and resolver results as JSON', async () => {
    expect(await (await fetch(`${base}/projects`)).json()).toEqual([{ id: '1' }])
    expect(await (await fetch(`${base}/projects/7`)).json()).toEqual({ id: '7' })
    const created = await fetch(`${base}/projects`, {
      method: 'POST',
      body: JSON.stringify({ name: 'A' }),
    })
    expect(await created.json()).toEqual({ created: { name: 'A' } })
  })

  it('returns 204 for undefined and passes Responses through', async () => {
    expect((await fetch(`${base}/projects/1`, { method: 'DELETE' })).status).toBe(204)
    const teapot = await fetch(`${base}/teapot`)
    expect(teapot.status).toBe(418)
  })

  it('serialises thrown errors in the kitr shape', async () => {
    const missing = await fetch(`${base}/projects/404`)
    expect(missing.status).toBe(404)
    expect(await missing.json()).toMatchObject({ code: 'NOT_FOUND' })
    const boom = await fetch(`${base}/boom`)
    expect(boom.status).toBe(500)
    expect(await boom.json()).toMatchObject({ code: 'INTERNAL', message: 'kaboom' })
  })

  it('makes a missing mock loud with a 501', async () => {
    const res = await fetch(`${base}/projects/1`, { method: 'PATCH' })
    expect(res.status).toBe(501)
    expect((await res.json()).message).toBe('No mock for projects.update')
  })

  it('mockValidationError produces field errors', async () => {
    const res = await fetch(`${base}/signup`, { method: 'POST' })
    expect(res.status).toBe(422)
    expect((await res.json()).fieldErrors).toEqual({ email: ['taken'] })
  })
})

describe('kitrErrorResponse', () => {
  it('keeps KitrErrors and wraps anything else as INTERNAL', async () => {
    expect((await kitrErrorResponse(KitrError.forbidden()).json()).status).toBe(403)
    expect(await kitrErrorResponse('weird').json()).toMatchObject({
      code: 'INTERNAL',
      message: 'weird',
    })
  })
})
