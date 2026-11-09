import { defineMutation, defineQuery } from '@kitr/actions'
import { KitrError } from '@kitr/kitr/app'
import { z } from 'zod'
import { addTask, listTasks, SERVER_ONLY } from '#app/e2e/tasks-store'

export const listTasksQuery = defineQuery('e2e.tasks.list', {
  staleTime: 60_000,
  handler: () => listTasks(),
})

export const addTaskMutation = defineMutation('e2e.tasks.add', {
  input: z.object({
    title: z.string().trim().min(2, 'Give the task a title of two letters or more'),
  }),
  effects: { invalidate: [['action', 'e2e.tasks.list']] },
  handler: ({ input }) => {
    if (input.title.toLowerCase() === 'forbidden')
      throw KitrError.forbidden('That title is not allowed')
    return { ...addTask(input.title), via: SERVER_ONLY }
  },
})
