import { useFormFactor, useRuntime } from '@kitr/platform/react'
import { useService } from '@kitr/react'
import { useSecureItem } from '@kitr/secure-storage/react'
import { useState } from 'react'
import { noteItem } from '#app/secure'

/** One page for the browser, Electron and Capacitor. Only the drivers behind the services differ. */
export default function HomePage() {
  const runtime = useRuntime()
  const form = useFormFactor()
  const notifications = useService('notifications')
  const flags = useService('flags')
  const [note, setNote, { loading, secure }] = useSecureItem(noteItem)
  const [draft, setDraft] = useState('')
  const [status, setStatus] = useState('')

  const notify = async () => {
    try {
      if ((await notifications.request()) !== 'granted')
        return setStatus('notifications not allowed')
      await notifications.show({ title: 'everywhere', body: note ?? 'Hello' })
      setStatus('notification sent')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error))
    }
  }

  return (
    <main
      style={{
        colorScheme: 'light dark',
        maxWidth: 560,
        margin: '0 auto',
        padding: 24,
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <h1>everywhere</h1>
      {flags.isOn('beta') && <p data-testid="beta">Beta features are on.</p>}
      <p>
        Runtime: <strong data-testid="runtime">{runtime}</strong>
      </p>
      <p>
        Form factor:{' '}
        <strong data-testid="form-factor">
          {form.width} / {form.input} / {form.orientation}
        </strong>
      </p>
      <h2>Remember this</h2>
      <input aria-label="Note" value={draft} onChange={(e) => setDraft(e.target.value)} />{' '}
      <button type="button" onClick={() => void setNote(draft).then(() => setStatus('saved'))}>
        Save
      </button>
      <p data-testid="note">
        {loading ? 'Loading…' : (note ?? 'Nothing saved yet.')} (
        {secure ? 'OS vault' : 'browser fallback'})
      </p>
      <button type="button" onClick={() => void notify()}>
        Notify me
      </button>
      <p data-testid="status">{status}</p>
    </main>
  )
}
