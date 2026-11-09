/** Server-side state the action handlers share. Its only reader is a handler, so the browser bundle must not contain it. */
const tasks: { id: number; title: string }[] = []

export const listTasks = () => [...tasks]

export function addTask(title: string) {
  const task = { id: tasks.length + 1, title }
  tasks.push(task)
  return task
}

export const SERVER_ONLY = 'e2e-server-only-marker'
