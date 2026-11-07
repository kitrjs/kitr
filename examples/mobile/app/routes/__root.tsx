import type { KitrRouterContext } from 'kitr/router'
import { Outlet, createRootRouteWithContext } from 'kitr/router'
import { PwaUpdate } from '#app/components/pwa-update'
import '#app/styles/app.css'

export const Route = createRootRouteWithContext<KitrRouterContext>()({
  component: RootLayout,
})

function RootLayout() {
  return (
    <>
      <Outlet />
      <PwaUpdate />
    </>
  )
}
