import { describe, expect, it } from 'vitest'
import { generatorFile, naming } from '../src/package'

const project = { rc: { directories: { app: 'app', server: 'server' } } } as any

describe('naming.split', () => {
  it('splits a nested name into its kebab folder and the last segment as typed', () => {
    expect(naming.split('admin/Users')).toEqual({ dir: 'admin', base: 'Users' })
    expect(naming.split('BillingTeam/invoices/Usage')).toEqual({
      dir: 'billing-team/invoices',
      base: 'Usage',
    })
    expect(naming.split('users')).toEqual({ dir: '', base: 'users' })
  })
})

describe('generatorFile', () => {
  it('writes kebab file names with the suffix, inside the kind folder', () => {
    const out = generatorFile(project, 'server', 'controllers', 'admin/UserRoles', {
      suffix: '-controller',
    })
    expect(out.file).toBe('server/controllers/admin/user-roles-controller.ts')
    expect(out.vars).toMatchObject({
      name: 'UserRoles',
      path: 'admin/UserRoles',
      dir: 'admin',
      kebab: 'user-roles',
      pascal: 'UserRoles',
      camel: 'userRoles',
    })
  })

  it('kebab-cases snake names and takes the extension and prefix', () => {
    expect(generatorFile(project, 'server', 'jobs', 'send_receipt').file).toBe(
      'server/jobs/send-receipt.ts',
    )
    expect(generatorFile(project, 'app', 'hooks', 'disclosure', { prefix: 'use-' }).file).toBe(
      'app/hooks/use-disclosure.ts',
    )
    expect(generatorFile(project, 'app', 'layouts', 'admin', { ext: '.tsx' }).file).toBe(
      'app/layouts/admin.tsx',
    )
  })

  it('follows rc.directories, and puts components under the app folder by default', () => {
    const custom = { rc: { directories: { app: 'src', server: 'api' } } } as any
    expect(
      generatorFile(custom, 'server', 'services', 'billing', { suffix: '-service' }).file,
    ).toBe('api/services/billing-service.ts')
    expect(generatorFile(custom, 'components', '', 'StatCard', { ext: '.tsx' }).file).toBe(
      'src/components/stat-card.tsx',
    )
    const withComponents = { rc: { directories: { components: 'ui' } } } as any
    expect(
      generatorFile(withComponents, 'components', 'forms', 'invite', { ext: '.tsx' }).file,
    ).toBe('ui/forms/invite.tsx')
    expect(generatorFile(project, 'test', '', 'billing', { suffix: '.test' }).file).toBe(
      'test/billing.test.ts',
    )
  })

  it('keeps the placeholder intact, so kitr make can print the pattern', () => {
    expect(
      generatorFile(project, 'server', 'controllers', '<name>', { suffix: '-controller' }).file,
    ).toBe('server/controllers/<name>-controller.ts')
  })
})
