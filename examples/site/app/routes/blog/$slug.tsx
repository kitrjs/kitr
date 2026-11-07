import { createFileRoute } from '@tanstack/react-router'
import { Link, notFound } from 'kitr/router'
import { seo } from 'kitr/ssr'
import { getPost } from '#app/content/posts'

export const Route = createFileRoute('/blog/$slug')({
  loader: ({ params }) => {
    const post = getPost(params.slug)
    if (!post) throw notFound()
    return post
  },
  head: ({ loaderData }) =>
    seo({ title: loaderData?.title, description: loaderData?.excerpt, type: 'article' }),
  notFoundComponent: () => (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-2xl font-semibold">No such post</h1>
      <Link to="/blog" className="mt-4 inline-block underline">
        Back to the blog
      </Link>
    </main>
  ),
  component: PostPage,
})

function PostPage() {
  const post = Route.useLoaderData()
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <Link to="/blog" className="text-sm text-muted-foreground hover:underline">
        ← Blog
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
