import { describe, expect, it } from 'vitest'
import api from '../src/kitr'

const project = { rc: { directories: { app: 'app', server: 'server' } } } as any

describe('api setup module', () => {
  it('declares what the CLI mounts', () => {
    expect(api.name).toBe('api')
    expect(api.requires).toEqual(['server'])
    expect(api.routes).toBe('@kitr/api/routes')
    expect(api.generate).toEqual({
      command: 'api:sync',
      watch: ['server/**/*.ts', 'app/**/routes.ts', 'config/api.ts'],
    })
    expect(api.vite).toEqual({ serverOnlyConfig: true })
    expect(api.commands).toBeTypeOf('function')
  })

  it('writes controllers under server/controllers with a -controller suffix', () => {
    const controller = api.generators!.controller!
    expect(controller.target('admin/Users', project, { resource: true })).toEqual({
      file: 'server/controllers/admin/users-controller.ts',
      vars: expect.objectContaining({ name: 'Users', dir: 'admin', resource: 'true' }),
    })
    const plain = controller.stub({ name: 'Report', resource: 'false' })
    expect(plain).toContain('export default class ReportController')
    expect(plain).toContain('async handle({ request }: HttpContext)')
    const resource = controller.stub({ name: 'Report', resource: 'true' })
    expect(resource).toContain('static validation')
    for (const action of ['index', 'show', 'store', 'update', 'destroy'])
      expect(resource).toContain(`async ${action}(`)
  })

  it('prints the route line to add after a controller is generated', () => {
    const steps: string[] = []
    const ctx = { log: { step: (line: string) => steps.push(line) } } as any
    const controller = api.generators!.controller!
    controller.after!(ctx, {
      file: 'server/controllers/admin/users-controller.ts',
      vars: { name: 'Users', dir: 'admin', kebab: 'users', resource: 'true' },
    } as any)
    controller.after!(ctx, {
      file: 'server/controllers/report-controller.ts',
      vars: { name: 'Report', dir: '', kebab: 'report', resource: 'false' },
    } as any)
    expect(steps[0]).toContain(
      "r.resource('admin/users', () => import('#server/controllers/admin/users-controller'))",
    )
    expect(steps[1]).toContain("r.get('/report', [ReportController, 'handle'])")
    expect(steps[1]).toContain(
      "import ReportController from '#server/controllers/report-controller'",
    )
  })

  it('writes middleware and validators', () => {
    const middleware = api.generators!.middleware!
    expect(middleware.target('audit', project, {}).file).toBe('server/middleware/audit.ts')
    expect(middleware.stub({ name: 'audit-log' })).toContain(
      'export const auditLog = defineMiddleware(',
    )
    const validator = api.generators!.validator!
    expect(validator.target('project', project, {}).file).toBe('app/validators/project.ts')
    const src = validator.stub({ name: 'project' })
    expect(src).toContain('export const projectSchema = z.object(')
    expect(src).toContain('export const updateProjectSchema = projectSchema.partial()')
    expect(src).toContain('export type ProjectInput')
  })
})
