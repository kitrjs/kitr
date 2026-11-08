import { createApp } from '@kitr/core'
import { KitrProvider } from '@kitr/react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createI18n, detectLocale, I18nextProvider, matchLocale, useTranslation } from '../src'
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

describe('default namespace', () => {
  it('looks keys up in the bundle namespace without a defaultNS, and follows changeLanguage', async () => {
    const i18n = createI18n({ resources, defaultLocale: 'en', detect: false })
    function Hello() {
      const { t, i18n: current } = useTranslation()
      return (
        <button type="button" onClick={() => void current.changeLanguage('de')}>
          {t('hello', { name: 'Ada' })}
        </button>
      )
    }
    render(
      <I18nextProvider i18n={i18n}>
        <Hello />
      </I18nextProvider>,
    )
    expect(screen.getByRole('button').textContent).toBe('Hello Ada')
    await act(async () => {
      fireEvent.click(screen.getByRole('button'))
    })
    expect(screen.getByRole('button').textContent).toBe('Hallo Ada')
  })

  it('prefers `common`, else the first namespace, and an explicit defaultNS wins', () => {
    const two = { en: { orders: { title: 'Orders' }, common: { title: 'App' } } }
    expect(createI18n({ resources: two, defaultLocale: 'en', detect: false }).t('title')).toBe(
      'App',
    )
    const one = { en: { orders: { title: 'Orders' } } }
    expect(createI18n({ resources: one, defaultLocale: 'en', detect: false }).t('title')).toBe(
      'Orders',
    )
    expect(
      createI18n({ resources: two, defaultLocale: 'en', detect: false, defaultNS: 'orders' }).t(
        'title',
      ),
    ).toBe('Orders')
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

// One i18next instance per request, so changeLanguage() while rendering one request never
// switches the language of another.
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
