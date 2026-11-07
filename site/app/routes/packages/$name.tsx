import { createFileRoute, notFound } from '@tanstack/react-router'
import { PackageLayout } from '#app/components/package-layout'
import { findPackage } from '#app/lib/catalog'
import { loadPage } from '#app/lib/content'
import { seo } from '#app/lib/seo'

export const Route = createFileRoute('/packages/$name')({
  loader: async ({ params }) => {
    const pkg = findPackage(params.name)
    if (!pkg) throw notFound()
    const page = pkg.pages.length ? await loadPage(`pkg__${pkg.name}__index`) : null
    return { pkg, page }
  },
  head: ({ loaderData }) =>
    loaderData
      ? seo({
          title: `${loaderData.pkg.title} · kitr packages`,
          description: loaderData.pkg.summary,
          path: `/packages/${loaderData.pkg.name}`,
          type: 'article',
        })
      : {},
  component: function PackageOverview() {
    const { pkg, page } = Route.useLoaderData()
    return <PackageLayout pkg={pkg} page={page} current="" />
  },
})
