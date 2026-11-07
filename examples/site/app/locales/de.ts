import type { Bundle } from './en'
import type en from './en'

const de = {
  common: {
    nav: { home: 'Start', pricing: 'Preise', blog: 'Blog' },
    hero: {
      title: 'Liefere das ganze Produkt, nicht nur die Oberfläche',
      subtitle:
        'Ein Stack von Routen bis Sockets, jedes Teil ein Add-on. Diese Seite wird serverseitig gerendert, vorgerendert und übersetzt.',
      cta: 'Zum Blog',
      secondary: 'Preise ansehen',
    },
    features: {
      ssr: { title: 'Serverseitig gerendert', body: 'HTML zuerst, danach hydriert. Statische Seiten werden beim Build vorgerendert.' },
      i18n: { title: 'Übersetzt', body: 'Typisierte Schlüssel aus dem englischen Bundle; eine Sprache ist eine Datei.' },
      api: { title: 'Eine API in derselben App', body: 'Das Newsletter-Formular unten schickt an einen Controller zwei Ordner weiter.' },
    },
    newsletter: {
      title: 'Der monatliche Brief',
      placeholder: 'du@example.com',
      button: 'Abonnieren',
      success: 'Danke, du stehst auf der Liste.',
    },
    footer: 'Gebaut mit kitr',
    locale: 'English',
  },
} as const satisfies Bundle<typeof en>

export default de
