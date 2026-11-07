import { ArrowLeft01Icon } from '@hugeicons/core-free-icons'
import { definePage, getRouteApi, Link } from 'kitr/router'
import { Icon } from '#components/ui/icon'

const route = getRouteApi('/blog/$slug')

/** The page and what renders when the loader in app/routes.ts throws notFound(). */
export default definePage({
  component: PostPage,
  notFoundComponent: () => (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-2xl font-semibold">No such post</h1>
      <Link to="/blog" className="mt-4 inline-block underline">
        Back to the blog
      </Link>
    </main>
  ),
})

function PostPage() {
  const post = route.useLoaderData()
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <Link
        to="/blog"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
      >
        <Icon icon={ArrowLeft01Icon} size={14} />
        Blog
      </Link>
      <article className="mt-4">
        <h1 className="text-3xl font-bold tracking-tight">{post.title}</h1>
        <time dateTime={post.date} className="mt-2 block text-sm text-muted-foreground">
          {new Date(post.date).toLocaleDateString('en-US', { dateStyle: 'long' })}
        </time>
        <div className="prose mt-6 space-y-4 text-base leading-7">
          {post.body.map((paragraph) => (
            <p key={paragraph.slice(0, 24)}>{paragraph}</p>
          ))}
        </div>
      </article>
    </main>
  )
}
