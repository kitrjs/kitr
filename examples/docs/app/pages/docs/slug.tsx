import { definePage, getRouteApi, Link } from '@kitr/router'
import { nav } from '#kitr/content'
import { DocLayout } from '#components/ui/doc-layout'

const route = getRouteApi('/docs/$slug')

/** One docs page, and what renders when the loader in app/routes.ts throws notFound(). */
export default definePage({
  component: DocPage,
  notFoundComponent: () => (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-2xl font-semibold">No such page</h1>
      <Link to="/docs" className="mt-4 inline-block underline">
        All docs
      </Link>
    </main>
  ),
})

function DocPage() {
  const page = route.useLoaderData()
  const { slug } = route.useParams()
  return <DocLayout page={page} nav={nav.docs} base="/docs" slug={slug} />
}
