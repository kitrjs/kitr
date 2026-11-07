import { createFileRoute, notFound } from '@tanstack/react-router'
import { PackageLayout } from '#app/components/package-layout'
import { findPackage } from '#app/lib/catalog'
import { loadPage } from '#app/lib/content'
import { seo } from '#app/lib/seo'

export const Route = createFileRoute('/packages/$name_/$page')({
  loader: async ({ params }) => {
    const pkg = findPackage(params.name)
    const page = pkg ? await loadPage(`pkg__${pkg.name}__${params.page}`) : null
    if (!pkg || !page) throw notFound()
    return { pkg, page }
  },
  head: ({ loaderData }) =>
    loaderData
      ? seo({
          title: `${loaderData.pkg.title} ${loaderData.page.title} · kitr packages`,
          description: loaderData.page.description ?? loaderData.pkg.summary,
          path: loaderData.page.url,
          type: 'article',
        })
      : {},
  component: function PackagePage() {
    const { pkg, page } = Route.useLoaderData()
    const { page: slug } = Route.useParams()
    return <PackageLayout pkg={pkg} page={page} current={slug} />
  },
})
