import { createI18n, I18nextProvider, useTranslation } from '@kitr/i18n'
import de from './switch-language/app/locales/de'
import en from './switch-language/app/locales/en'
import fr from './switch-language/app/locales/fr'

export const meta = {
  title: 'One component, three languages',
  description: 'Switch the language and every string updates.',
  storage: false,
}

const i18n = createI18n({ defaultLocale: 'en', detect: false, resources: { en, de, fr } }, 'en')

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
