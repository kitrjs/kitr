import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  return (
    <main style={{ padding: 24 }}>
      <h1>blank</h1>
      <p>Edit <code>app/routes/index.tsx</code>. Add a page with <code>kitr make:route</code>.</p>
    </main>
  )
}
