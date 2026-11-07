import { createApp } from '@kitr/core'
import { KitrProvider } from '@kitr/react'
import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createI18n, detectLocale, matchLocale, useTranslation } from '../src'
import { i18nProvider } from '../src/provider'

const resources = {
  en: { common: { hello: 'Hello {{name}}' } },
  'pt-BR': { common: { hello: 'Olá {{name}}' } },
  de: { common: { hello: 'Hallo {{name}}' } },
}

afterEach(() => vi.unstubAllGlobals())

describe('matchLocale', () => {
  const supported = ['en', 'pt-BR', 'de']
  it('parses Accept-Language and matches regions and base languages', () => {
    expect(matchLocale('fr-CH, de;q=0.8, en;q=0.5', supported)).toBe('de')
    expect(matchLocale('pt', supported)).toBe('pt-BR')
    expect(matchLocale('en-GB', supported)).toBe('en')
    expect(matchLocale(['zz', 'pt-BR'], supported)).toBe('pt-BR')
    expect(matchLocale('ja', supported)).toBeUndefined()
    expect(matchLocale('', supported)).toBeUndefined()
  })
})

describe('detectLocale', () => {
  it('prefers a stored choice, then the browser languages', () => {
    vi.stubGlobal('navigator', { languages: ['de-AT'], language: 'de-AT' })
    expect(detectLocale(['en', 'de'])).toBe('de')
    localStorage.setItem('locale', 'en')
    expect(detectLocale(['en', 'de'])).toBe('en')
    localStorage.setItem('locale', 'xx')
    expect(detectLocale(['en', 'de'])).toBe('de')
  })
})

describe('createI18n', () => {
  it('uses the initial locale, interpolates without escaping and falls back', () => {
    const i18n = createI18n({ resources, defaultLocale: 'en', defaultNS: 'common' }, 'de')
    expect(i18n.language).toBe('de')
    expect(i18n.t('hello', { name: '<b>' })).toBe('Hallo <b>')
    const fallback = createI18n({
      resources,
      defaultLocale: 'en',
      detect: false,
      defaultNS: 'common',
    })
    expect(fallback.language).toBe('en')
  })

  it('creates isolated instances (no shared global language)', () => {
    const a = createI18n({ resources, defaultLocale: 'en', detect: false }, 'en')
    const b = createI18n({ resources, defaultLocale: 'en', detect: false }, 'de')
    expect(a.language).toBe('en')
    expect(b.language).toBe('de')
  })
})

describe('i18nProvider', () => {
  it('binds i18n and wraps the tree so useTranslation works', async () => {
    const app = createApp({
      providers: [i18nProvider],
      config: { i18n: { resources, defaultLocale: 'en', detect: false, defaultNS: 'common' } },
      env: { locale: 'pt-BR' },
    })
    await app.boot()
    function Hello() {
      const { t } = useTranslation()
      return <p>{t('hello', { name: 'Ana' })}</p>
    }
    render(
      <KitrProvider app={app}>
        <Hello />
      </KitrProvider>,
    )
    expect(screen.getByText('Olá Ana')).toBeTruthy()
  })
})

// Regression: one i18next instance for the whole server, so changeLanguage() while rendering one
// request switched the language of every request rendering at the same time.
describe('i18n per request', () => {
  it('gives each forked app (one per server request) its own instance', async () => {
    const app = createApp({
      environment: 'server',
      providers: [i18nProvider],
      config: { i18n: { resources, defaultLocale: 'en', detect: false } },
    })
    await app.boot()
    const a = app.fork().container.use('i18n')
    const b = app.fork().container.use('i18n')
    expect(a).not.toBe(b)
    await a.changeLanguage('de')
    expect(a.language).toBe('de')
    expect(b.language).toBe('en')
  })
})
