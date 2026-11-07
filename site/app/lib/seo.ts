export const siteUrl = 'https://kitr.dev'
export const siteName = 'kitr'

/** `/` → `home`, `/packages/query/api` → `packages-query-api`. content.mjs names OG images the same way. */
export const ogId = (path: string) => (path === '/' ? 'home' : path.slice(1).replace(/\//g, '-'))

/** Title, description, canonical URL, Open Graph and Twitter tags for one page. */
export function seo({
  title,
  description,
  path,
  type = 'website',
}: {
  title: string
  description: string
  path: string
  type?: 'website' | 'article'
}) {
  const url = `${siteUrl}${path === '/' ? '/' : path}`
  const image = `${siteUrl}/og/${ogId(path)}.png`
  return {
    meta: [
      { title },
      { name: 'description', content: description },
      { property: 'og:site_name', content: siteName },
      { property: 'og:type', content: type },
      { property: 'og:url', content: url },
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:image', content: image },
      { property: 'og:image:width', content: '1200' },
      { property: 'og:image:height', content: '630' },
      { property: 'og:image:alt', content: title },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: title },
      { name: 'twitter:description', content: description },
      { name: 'twitter:image', content: image },
    ],
    links: [{ rel: 'canonical', href: url }],
  }
}
