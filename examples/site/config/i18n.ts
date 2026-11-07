import { defineConfig } from 'kitr/i18n'
import de from '#app/locales/de'
import en from '#app/locales/en'

export default defineConfig({
  resources: { en, de },
  defaultLocale: 'en',
  defaultNS: 'common',
  // The visitor's choice lives in a cookie; app/locale.tsx renders each request in that language.
  detect: false,
})
