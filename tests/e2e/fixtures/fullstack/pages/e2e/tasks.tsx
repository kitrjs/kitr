import { useMutation, useSuspenseQuery } from '@kitr/query'
import { type FormEvent, useEffect, useState } from 'react'

export default function Tasks() {
  const { data } = useSuspenseQuery('e2e.tasks.list')
  const add = useMutation('e2e.tasks.add')
  const [title, setTitle] = useState('')
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)
  useEffect(() => setReady(true), [])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    try {
      await add.mutateAsync({ title })
      setTitle('')
    } catch (e) {
      const { fieldErrors, message } = e as { fieldErrors?: Record<string, string[]>; message: string }
      setError(fieldErrors?.title?.[0] ?? message)
    }
  }

  return (
    <main>
      <h1>Tasks</h1>
      <form onSubmit={submit} data-ready={ready}>
        <input aria-label="Task" value={title} onChange={(e) => setTitle(e.target.value)} />
        <button type="submit">Add task</button>
      </form>
      {error ? <p role="alert">{error}</p> : null}
      <ul>
        {data.map((task) => (
          <li key={task.id}>{task.title}</li>
        ))}
      </ul>
    </main>
  )
}
