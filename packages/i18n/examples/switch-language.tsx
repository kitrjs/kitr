import { createI18n, I18nextProvider, useTranslation } from '@kitr/i18n'

export const meta = {
  title: 'One component, three languages',
  description:
    'The strings live in one bundle per language. Switch and every t() call re-renders; the name stays interpolated.',
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

function Welcome() {
  const { t, i18n } = useTranslation()
  return (
    <div className="demo">
      <div className="demo-row">
        {(['en', 'de', 'fr'] as const).map((lng) => (
          <button
            key={lng}
            type="button"
            className={`demo-button${i18n.language === lng ? ' primary' : ''}`}
            onClick={() => void i18n.changeLanguage(lng)}
            aria-pressed={i18n.language === lng}
          >
            {lng}
          </button>
        ))}
      </div>
      <h2 style={{ margin: '12px 0 4px' }}>{t('hello', { name: 'Ada' })}</h2>
      <p className="demo-muted">{t('orders', { count: 3 })}</p>
      <button type="button" className="demo-button">
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
