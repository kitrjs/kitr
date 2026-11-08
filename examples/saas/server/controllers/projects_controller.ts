import type { HttpContext } from 'kitr/api'
import { KitrError } from 'kitr/app'
import { requireUser } from 'kitr/auth/server'
import type { User } from '#app/abilities'
import {
  type CreateProject,
  type Project,
  type UpdateProject,
  createProjectSchema,
  updateProjectSchema,
} from '#app/features/projects/schema'

type Ctx<B = unknown> = HttpContext<{ id: string }, Record<string, string | string[]>, B>

/** In-memory for the demo. Swap for a database binding (`kitr add db`) without touching the routes. */
const projects = new Map<string, Project>()
for (const [i, name] of ['Onboarding revamp', 'Billing v2', 'Mobile beta'].entries()) {
  const id = String(i + 1)
  projects.set(id, {
    id,
    name,
    status: i === 2 ? 'archived' : 'active',
    owner: 'admin@example.com',
    updatedAt: new Date(Date.now() - i * 86_400_000).toISOString(),
  })
}

export default class ProjectsController {
  static validation = {
    store: { body: createProjectSchema },
    update: { body: updateProjectSchema },
  }

  async index() {
    return [...projects.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  async show({ params }: Ctx) {
    const project = projects.get(params.id)
    if (!project) throw KitrError.notFound('Project ' + params.id)
    return project
  }

  async store({ body, response, locals }: Ctx<CreateProject>) {
    // The routes sit behind sessionMiddleware, so there is always a signed-in user here.
    const user = requireUser<User>({ locals })
    const project: Project = {
      id: crypto.randomUUID(),
      name: body.name,
      status: body.status,
      owner: user.email,
      updatedAt: new Date().toISOString(),
    }
    projects.set(project.id, project)
    response.status(201)
    return project
  }

  async update({ params, body }: Ctx<UpdateProject>) {
    const current = projects.get(params.id)
    if (!current) throw KitrError.notFound('Project ' + params.id)
    const next: Project = { ...current, ...body, updatedAt: new Date().toISOString() }
    projects.set(params.id, next)
    return next
  }

  async destroy({ params, response }: Ctx) {
    projects.delete(params.id)
    return response.noContent()
  }
}
