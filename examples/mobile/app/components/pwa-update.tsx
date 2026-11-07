import { useServiceWorker } from 'kitr/pwa'

/** Registers the service worker and shows a one-line banner when a new version is waiting. */
export function PwaUpdate() {
  const sw = useServiceWorker()
  if (!sw.needRefresh) return null
  return (
    <div role="status" style={{ position: 'fixed', bottom: 16, right: 16, padding: 12, borderRadius: 8, background: '#0f172a', color: '#fff' }}>
      A new version is available.{' '}
      <button type="button" onClick={() => sw.update()} style={{ textDecoration: 'underline' }}>
        Reload
      </button>
    </div>
  )
}
