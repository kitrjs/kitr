import { mutationFrom, queryFrom } from '@kitr/query'
import { api } from '#app/api/client'

/** One place for every query and mutation of the feature; routes and components import from here. */
export const projectsQuery = queryFrom(api.projects.index.query())

export const createProject = mutationFrom(
  api.projects.store.mutation({ effects: { invalidate: [api.projects.index.key()] } }),
)

export const deleteProject = mutationFrom(
  api.projects.destroy.mutation({ effects: { invalidate: [api.projects.index.key()] } }),
)
