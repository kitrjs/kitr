import { describe, expect, it } from 'vitest'
import { cva, cx, darkTokens, dataAttrs, defaultTokens, defineTokens, pick, vars } from '../src'

describe('pick', () => {
  const styles = { card: 'card_x1', active: 'active_x2', big: 'big_x3' }
  it('joins classes and conditions', () => {
    expect(pick(styles, 'card', { active: true, big: false }, false, null, undefined)).toBe(
      'card_x1 active_x2',
    )
    expect(pick(styles)).toBe('')
  })
})

describe('vars and dataAttrs', () => {
  it('builds CSS variable styles', () => {
    expect(vars({ '--gap': 8, '--color': 'red' })).toEqual({ '--gap': '8', '--color': 'red' })
  })
  it('builds data attributes with kebab-case names', () => {
    expect(
      dataAttrs({ state: 'open', isActive: true, size: 2, hidden: false, a: null, b: undefined }),
    ).toEqual({
      'data-state': 'open',
      'data-is-active': '',
      'data-size': '2',
    })
  })
})

describe('defineTokens', () => {
  const t = defineTokens(
    { color: { primary: '#00f', text: { muted: '#999' } }, space: { 1: 4 } },
    { prefix: 'app' },
  )
  it('names and references tokens', () => {
    expect(t.name('color.primary')).toBe('--app-color-primary')
    expect(t.var('color.text.muted')).toBe('var(--app-color-text-muted)')
  })
  it('flattens and emits CSS', () => {
    expect(t.flat()).toEqual({
      '--app-color-primary': '#00f',
      '--app-color-text-muted': '#999',
      '--app-space-1': '4',
    })
    expect(t.css('.theme')).toBe(
      '.theme {\n  --app-color-primary: #00f;\n  --app-color-text-muted: #999;\n  --app-space-1: 4;\n}\n',
    )
    expect(t.css()).toMatch(/^:root \{/)
  })
  it('ships light and dark defaults with the same colour names', () => {
    const light = Object.keys(defaultTokens.flat()).filter((k) => k.includes('-color-'))
    const dark = Object.keys(darkTokens.flat())
    expect(dark.sort()).toEqual(light.sort())
  })
})

describe('re-exports', () => {
  it('exposes clsx and cva', () => {
    expect(cx('a', { b: true, c: false })).toBe('a b')
    const button = cva('btn', { variants: { size: { sm: 'btn-sm' } } })
    expect(button({ size: 'sm' })).toBe('btn btn-sm')
  })
})
