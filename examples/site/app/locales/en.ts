export default {
  common: {
    nav: { home: 'Home', pricing: 'Pricing', blog: 'Blog' },
    hero: {
      title: 'Ship the whole product, not just the UI',
      subtitle:
        'One stack from routes to sockets, with every piece an add-on you can remove. This page is server-rendered, prerendered and translated.',
      cta: 'Read the blog',
      secondary: 'See pricing',
    },
    features: {
      ssr: { title: 'Server rendered', body: 'HTML first, hydrated in place. Prerendered at build time for the pages that never change.' },
      i18n: { title: 'Translated', body: 'Typed keys from the English bundle; add a locale by adding a file.' },
      api: { title: 'An API in the same app', body: 'The newsletter form below posts to a controller two folders away.' },
    },
    newsletter: {
      title: 'Get the monthly letter',
      placeholder: 'you@example.com',
      button: 'Subscribe',
      success: 'Thanks, you are on the list.',
    },
    footer: 'Built with kitr',
    locale: 'Deutsch',
  },
} as const

/** The shape every other locale must match: same keys, any strings. */
export type Bundle<T> = { [K in keyof T]: T[K] extends string ? string : Bundle<T[K]> }
