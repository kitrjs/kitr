import { createI18n, I18nextProvider, useTranslation } from '@kitr/i18n'

export const meta = {
  title: 'One component, three languages',
  description: 'Switch the language and every string updates.',
  storage: false,
}

const i18n = createI18n(
  {
    defaultLocale: 'en',
    detect: false,
    resources: {
      en: {
        common: {
          hello: 'Hello, {{name}}',
          orders: 'You have {{count}} open order',
          orders_other: 'You have {{count}} open orders',
          save: 'Save',
        },
      },
      de: {
        common: {
          hello: 'Hallo, {{name}}',
          orders: 'Du hast {{count}} offene Bestellung',
          orders_other: 'Du hast {{count}} offene Bestellungen',
          save: 'Speichern',
        },
      },
      fr: {
        common: {
          hello: 'Bonjour, {{name}}',
          orders: 'Vous avez {{count}} commande ouverte',
          orders_other: 'Vous avez {{count}} commandes ouvertes',
          save: 'Enregistrer',
        },
      },
    },
  },
  'en',
)

// Tailwind utilities on the kitr tokens, so the example looks the same in any kitr app.
const button =
  'min-h-[38px] cursor-pointer rounded-lg border px-3.5 font-semibold disabled:cursor-default disabled:opacity-50 border-border bg-background text-foreground'
const primary =
  'min-h-[38px] cursor-pointer rounded-lg border px-3.5 font-semibold disabled:cursor-default disabled:opacity-50 border-primary bg-primary text-primary-foreground'

function Welcome() {
  const { t, i18n } = useTranslation()
  return (
    <div className="flex flex-col gap-3 text-[15px]">
      <div className="flex flex-wrap gap-2">
        {(['en', 'de', 'fr'] as const).map((lng) => (
          <button
            key={lng}
            type="button"
            className={i18n.language === lng ? primary : button}
            onClick={() => void i18n.changeLanguage(lng)}
            aria-pressed={i18n.language === lng}
          >
            {lng}
          </button>
        ))}
      </div>
      <h2 style={{ margin: '12px 0 4px' }}>{t('hello', { name: 'Ada' })}</h2>
      <p className="m-0 text-muted-foreground">{t('orders', { count: 3 })}</p>
      <button type="button" className={button}>
        {t('save')}
      </button>
    </div>
  )
}

export default function SwitchLanguage() {
  return (
    <I18nextProvider i18n={i18n}>
      <Welcome />
    </I18nextProvider>
  )
}
