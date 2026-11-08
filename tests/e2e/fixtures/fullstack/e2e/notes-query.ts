import { createServerFn } from '@tanstack/react-start'
import { listNotes } from '#app/e2e/notes-store'

const readNotes = createServerFn().handler(async () => listNotes())

/** Read on the server for the first render, and again after a note is added. */
export const notesQuery = { queryKey: ['e2e', 'notes'], queryFn: () => readNotes(), staleTime: 0 }
