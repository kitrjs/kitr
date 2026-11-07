import { useServiceWorker } from 'kitr/web/client'

/** Registers the service worker and shows a one-line banner when a new version is waiting. */
export function PwaUpdate() {
  const sw = useServiceWorker()
  if (!sw.needRefresh) return null
  return (
    <div role="status" className="fixed bottom-4 right-4 rounded-md bg-foreground px-3 py-2 text-sm text-background shadow">
      A new version is available.{' '}
      <button type="button" className="underline" onClick={() => sw.update()}>
        Reload
      </button>
    </div>
  )
}
