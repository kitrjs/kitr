import { z } from 'zod'

/** Shared by the controller (validation) and the form (client-side checks). */
export const createProjectSchema = z.object({
  name: z.string().min(2, 'Give the project a name'),
  status: z.enum(['active', 'archived']).default('active'),
})
export const updateProjectSchema = createProjectSchema.partial()

export type CreateProject = z.infer<typeof createProjectSchema>
export type UpdateProject = z.infer<typeof updateProjectSchema>

export interface Project {
  id: string
  name: string
  status: 'active' | 'archived'
  owner: string
  updatedAt: string
}
