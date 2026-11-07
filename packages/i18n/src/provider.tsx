import { defineProvider, type KitrProvider } from '@kitr/core'
import type { ReactNode } from 'react'
import { I18nextProvider } from 'react-i18next'
import { createI18n } from './index'

/** Binds `i18n` from `config/i18n.ts` and wraps the tree in I18nextProvider. */
export const i18nProvider: KitrProvider = defineProvider({
  name: 'i18n',
  register(app) {
    app.container.singleton('i18n', () =>
      createI18n(app.config.get('i18n'), app.env.locale as string | undefined),
    )
  },
  wrap(children, app) {
    return (
      <I18nextProvider i18n={app.container.use('i18n')}>{children as ReactNode}</I18nextProvider>
    )
  },
})

export default i18nProvider
