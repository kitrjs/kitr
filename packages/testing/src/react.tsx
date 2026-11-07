import type { KitrApp } from '@kitr/core'
import { KitrProvider } from '@kitr/react'
import { type RenderOptions, render } from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'

export interface RenderWithKitrOptions extends Omit<RenderOptions, 'wrapper'> {
  app: KitrApp
  /** Seed the query cache: `[[['projects', 'detail', '1'], project]]`. Needs @kitr/query's provider. */
  queryData?: Array<[readonly unknown[], unknown]>
  wrapper?: (props: { children: ReactNode }) => ReactElement
}

/**
 * Render inside the same providers the app uses, with the query cache pre-seeded.
 * Pass a `wrapper` to add a router (e.g. `RouterProvider` with a memory history).
 */
export function renderWithKitr(
  ui: ReactElement,
  { app, queryData, wrapper: Extra, ...options }: RenderWithKitrOptions,
) {
  if (queryData && app.container.has('queryClient')) {
    const client = app.container.use('queryClient') as {
      setQueryData(key: readonly unknown[], data: unknown): void
    }
    for (const [key, data] of queryData) client.setQueryData(key, data)
  }
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <KitrProvider app={app}>{Extra ? <Extra>{children}</Extra> : children}</KitrProvider>
  )
  return render(ui, { ...options, wrapper: Wrapper })
}

export * from './index'
