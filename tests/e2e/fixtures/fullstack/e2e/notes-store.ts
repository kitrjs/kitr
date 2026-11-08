export interface Note {
  id: number
  text: string
}

// In memory, in the one server process: the `/api/e2e/notes` endpoints write it and the page's
// server function reads it, so a reload shows what the API stored.
const notes: Note[] = []

export const listNotes = (): Note[] => [...notes]

export function addNote(text: string): Note {
  const note = { id: notes.length + 1, text }
  notes.push(note)
  return note
}
