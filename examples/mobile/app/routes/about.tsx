import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/about')({
  component: () => <main style={{ padding: 24 }}>About</main>,
})
