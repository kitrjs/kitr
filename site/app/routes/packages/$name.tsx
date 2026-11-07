import { createFileRoute, notFound } from '@tanstack/react-router'
import { PackageLayout } from '#app/components/package-layout'
import { findPackage } from '#app/lib/catalog'
import { loadPage } from '#app/lib/content'

export const Route = createFileRoute('/packages/$name')({
  loader: async ({ params }) => {
    const pkg = findPackage(params.name)
    if (!pkg) throw notFound()
    const page = pkg.pages.length ? await loadPage(`pkg__${pkg.name}__index`) : null
    return { pkg, page }
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.pkg.title} · kitr` },
          { name: 'description', content: loaderData.pkg.summary },
          { property: 'og:title', content: `${loaderData.pkg.title} · kitr` },
          { property: 'og:description', content: loaderData.pkg.summary },
        ]
      : [],
  }),
  component: function PackageOverview() {
    const { pkg, page } = Route.useLoaderData()
    return <PackageLayout pkg={pkg} page={page} current="" />
  },
})
