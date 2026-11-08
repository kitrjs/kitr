import { useTranslation } from '@kitr/i18n'
import { useLocale } from '#app/locale'
import { Button } from '#components/ui/button'

/** Toggles en ⇄ de and remembers it in a cookie. */
export function LocaleSwitch() {
  const { t } = useTranslation()
  const { locale, setLocale } = useLocale()
  return (
    <Button variant="ghost" size="sm" onClick={() => setLocale(locale === 'en' ? 'de' : 'en')}>
      {t('locale')}
    </Button>
  )
}
