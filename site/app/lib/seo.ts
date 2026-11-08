export const siteUrl = 'https://kitr.dev'
export const siteName = 'kitr'

/** `/` → `home`, `/packages/query/api` → `packages-query-api`. content.mjs names OG images the same way. */
export const ogId = (path: string) => (path === '/' ? 'home' : path.slice(1).replace(/\//g, '-'))

/** Breadcrumbs from the path: `/packages/query/api` → kitr › Packages › query › api. */
function breadcrumbs(path: string) {
  const parts = path.split('/').filter(Boolean)
  const labels: Record<string, string> = {
    docs: 'Docs',
    guides: 'Guides',
    packages: 'Packages',
    platforms: 'Platforms',
    about: 'About',
  }
  const items = [{ name: siteName, url: `${siteUrl}/` }]
  let url = siteUrl
  for (const part of parts) {
    url += `/${part}`
    items.push({ name: labels[part] ?? part, url })
  }
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  }
}

/**
 * Title, description, canonical URL, Open Graph and Twitter tags for one page. Articles (docs,
 * guides, package pages) also carry TechArticle and BreadcrumbList structured data, so search
 * engines can show the section path and attribute the page.
 */
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
      { property: 'og:locale', content: 'en_US' },
    ],
    links: [{ rel: 'canonical', href: url }],
    ...(type === 'article'
      ? {
          scripts: [
            {
              type: 'application/ld+json',
              children: JSON.stringify({
                '@context': 'https://schema.org',
                '@graph': [
                  {
                    '@type': 'TechArticle',
                    headline: title,
                    description,
                    url,
                    image,
                    inLanguage: 'en',
                    isPartOf: { '@type': 'WebSite', name: siteName, url: `${siteUrl}/` },
                    publisher: { '@type': 'Organization', name: siteName, url: `${siteUrl}/` },
                  },
                  breadcrumbs(path),
                ],
              }),
            },
          ],
        }
      : {}),
  }
}
