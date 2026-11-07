import { RouterProvider } from 'kitr/router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { app } from './app'
import { getRouter } from './router'

async function main() {
  await app.boot()
  const router = getRouter()
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  )
}

main()
