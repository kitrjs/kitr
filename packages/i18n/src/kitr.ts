import { definePackage } from '@kitr/core/package'

/** `kitr add i18n`: react-i18next with typed keys, locale detection and a provider. */
export default definePackage({
  name: 'i18n',
  client: true,
  add(ctx) {
    ctx.deps.add('i18next', 'react-i18next')
    ctx.provider.add('@kitr/i18n/provider')
    ctx.write(
      'app/locales/en.ts',
      `export default {\n  common: {\n    hello: 'Hello, {{name}}',\n    save: 'Save',\n  },\n} as const\n`,
    )
    ctx.config(
      'i18n',
      `import { defineConfig } from 'kitr/i18n'\nimport en from '#app/locales/en'\n\nexport default defineConfig({\n  resources: { en },\n  defaultLocale: 'en',\n  defaultNS: 'common',\n})\n`,
    )
    ctx.agents.add(
      'i18n',
      `- Strings live in \`app/locales/<lang>.ts\`. Components: \`const { t } = useTranslation()\` from \`kitr/i18n\`; keys are typed from the English bundle.`,
    )
  },
  remove(ctx) {
    ctx.provider.remove('@kitr/i18n/provider')
    ctx.deps.remove('i18next', 'react-i18next')
    ctx.agents.remove('i18n')
  },
  wraps: { 'react-i18next': 'kitr/i18n' },
  eject: { 'kitr/i18n': 'react-i18next' },
  vite: { optimizeDeps: ['i18next', 'react-i18next'] },
})
