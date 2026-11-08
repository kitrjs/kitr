import { useStorage } from 'kitr/storage/react'
import { type FormEvent, useState } from 'react'
import { notes } from '#app/e2e/notes-store'

export default function Notes() {
  const [list, setList] = useStorage(notes)
  const [text, setText] = useState('')

  function add(event: FormEvent) {
    event.preventDefault()
    if (!text.trim()) return
    setList([...list, text.trim()])
    setText('')
  }

  return (
    <main>
      <h1>Notes</h1>
      <form onSubmit={add}>
        <input aria-label="Note" value={text} onChange={(e) => setText(e.target.value)} />
        <button type="submit">Add note</button>
      </form>
      <ul>
        {list.map((note, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: notes are append-only
          <li key={i}>{note}</li>
        ))}
      </ul>
    </main>
  )
}
