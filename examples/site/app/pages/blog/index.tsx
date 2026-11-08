import { Link } from '@kitr/router'
import { posts } from '#app/content/posts'
import { PageHeader } from '#components/ui/page-header'

export default function BlogIndexPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <PageHeader title="Blog" description="Every post is prerendered; the build crawls these links." />
      <ul className="divide-y divide-border">
        {posts.map((post) => (
          <li key={post.slug} className="py-5">
            <Link to="/blog/$slug" params={{ slug: post.slug }} className="text-lg font-medium hover:underline">
              {post.title}
            </Link>
            <p className="mt-1 text-sm text-muted-foreground">{post.excerpt}</p>
            <time dateTime={post.date} className="mt-1 block text-xs text-muted-foreground">
              {new Date(post.date).toLocaleDateString('en-US', { dateStyle: 'medium' })}
            </time>
          </li>
        ))}
      </ul>
    </main>
  )
}
