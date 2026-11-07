import { defineMutation, defineQuery } from 'kitr/query'
import { api } from '#app/api/client'

/** One place for every query and mutation of the feature; routes and components import from here. */
export const projectsQuery = defineQuery(api.projects.index.query())

export const createProject = defineMutation(
  api.projects.store.mutation({ effects: { invalidate: [api.projects.index.key()] } }),
)

export const deleteProject = defineMutation(
  api.projects.destroy.mutation({ effects: { invalidate: [api.projects.index.key()] } }),
)
