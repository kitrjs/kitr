import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { type FormEvent, useEffect, useState } from 'react'
import { notesQuery } from '#app/e2e/notes-query'

export default function Notes() {
  const { data } = useSuspenseQuery(notesQuery)
  const queryClient = useQueryClient()
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)
  // A test types only once the page is interactive; before that, the form is plain HTML.
  useEffect(() => setReady(true), [])

  async function add(event: FormEvent) {
    event.preventDefault()
    setError('')
    const res = await fetch('/api/e2e/notes', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text }),
    })
    if (!res.ok) return setError(((await res.json()) as { message: string }).message)
    setText('')
    await queryClient.invalidateQueries({ queryKey: notesQuery.queryKey })
  }

  return (
    <main>
      <h1>Notes</h1>
      <form onSubmit={add} data-ready={ready}>
        <input aria-label="Note" value={text} onChange={(e) => setText(e.target.value)} />
        <button type="submit">Add note</button>
      </form>
      {error ? <p role="alert">{error}</p> : null}
      <ul>
        {data.map((note) => (
          <li key={note.id}>{note.text}</li>
        ))}
      </ul>
    </main>
  )
}
