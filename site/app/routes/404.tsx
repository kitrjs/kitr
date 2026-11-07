import { createFileRoute } from '@tanstack/react-router'
import { NotFound } from '#app/components/not-found'

export const Route = createFileRoute('/404')({
  head: () => ({
    meta: [{ title: 'Not found · kitr' }, { name: 'robots', content: 'noindex' }],
  }),
  component: NotFound,
})
