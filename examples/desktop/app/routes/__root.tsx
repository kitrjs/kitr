import type { KitrRouterContext } from 'kitr/router'
import { Link, Outlet, createRootRouteWithContext } from 'kitr/router'
import '#app/styles/app.css'

export const Route = createRootRouteWithContext<KitrRouterContext>()({
  component: RootLayout,
})

function RootLayout() {
  return (
    <>
      <nav style={{ display: 'flex', gap: 12, padding: 12 }}>
        <Link to="/">Home</Link>
        <Link to="/about">About</Link>
      </nav>
      <Outlet />
    </>
  )
}
