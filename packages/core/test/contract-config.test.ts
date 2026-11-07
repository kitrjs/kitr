import { describe, expect, it } from 'vitest'
import { ConfigStore, createDefineConfig } from '../src/config'
import { createKeys, keyMatches, mergeEffects } from '../src/contract'
import { defaultDirectories, defineKitrConfig } from '../src/rc'

describe('createKeys', () => {
  it('builds hierarchical keys that prefix-match each other', () => {
    const keys = createKeys('projects')
    expect(keys.all).toEqual(['projects'])
    expect(keys.lists()).toEqual(['projects', 'list'])
    expect(keys.list()).toEqual(['projects', 'list'])
    expect(keys.list({ page: 2 })).toEqual(['projects', 'list', { page: 2 }])
    expect(keys.details()).toEqual(['projects', 'detail'])
    expect(keys.detail(7)).toEqual(['projects', 'detail', 7])
    expect(keys.custom('stats', 'weekly')).toEqual(['projects', 'stats', 'weekly'])
    expect(keyMatches(keys.all, keys.detail(7))).toBe(true)
    expect(keyMatches(keys.lists(), keys.list({ page: 2 }))).toBe(true)
    expect(keyMatches(keys.lists(), keys.detail(1))).toBe(false)
  })
})

describe('keyMatches', () => {
  it('compares objects deeply regardless of key order', () => {
    expect(keyMatches(['a', { x: 1, y: { z: 2 } }], ['a', { y: { z: 2 }, x: 1 }, 'more'])).toBe(
      true,
    )
    expect(keyMatches(['a', { x: 1 }], ['a', { x: 2 }])).toBe(false)
    expect(keyMatches(['a', { x: 1 }], ['a', { x: 1, y: 2 }])).toBe(false)
    expect(keyMatches(['a', 'b'], ['a'])).toBe(false)
    expect(keyMatches([], ['anything'])).toBe(true)
    expect(keyMatches([null], [undefined])).toBe(false)
  })
})

describe('mergeEffects', () => {
  it('concatenates and ignores empty inputs', () => {
    expect(
      mergeEffects(
        { invalidate: [['a']] },
        undefined,
        { set: [{ key: ['b'], data: 1 }], invalidate: [['c']] },
        { remove: [['d']] },
      ),
    ).toEqual({
      invalidate: [['a'], ['c']],
      set: [{ key: ['b'], data: 1 }],
      remove: [['d']],
    })
    expect(mergeEffects()).toEqual({})
  })
})

describe('ConfigStore', () => {
  it('gets, falls back and explains what is missing', () => {
    const store = new ConfigStore().set('http', { baseUrl: 'x' })
    expect(store.has('http')).toBe(true)
    expect(store.get('http')).toEqual({ baseUrl: 'x' })
    expect(store.get('auth', { a: 1 } as never)).toEqual({ a: 1 })
    expect(() => store.get('auth')).toThrow(/Create config\/auth\.ts/)
    expect(store.entries()).toEqual([['http', { baseUrl: 'x' }]])
  })

  it('createDefineConfig is an identity helper', () => {
    const define = createDefineConfig<{ a: number }>()
    const c = { a: 1 }
    expect(define(c)).toBe(c)
  })
})

describe('defineKitrConfig', () => {
  it('fills in default directories and keeps overrides', () => {
    const rc = defineKitrConfig({ providers: [], directories: { routes: 'src/routes' } })
    expect(rc.directories).toEqual({ ...defaultDirectories, routes: 'src/routes' })
  })
})
