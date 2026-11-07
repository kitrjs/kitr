import { afterEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/app'
import { globToRegExp } from '../src/generate'
import { type OperationLike, OperationRegistry, operations } from '../src/operations'

const query = (name: string): OperationLike => ({
  kind: 'query',
  name,
  contract: { kind: 'query', key: () => [name], fetch: async () => name },
})
const mutation = (name: string): OperationLike => ({
  kind: 'mutation',
  name,
  contract: { kind: 'mutation', mutate: async () => name },
})

afterEach(() => operations.reset())

describe('OperationRegistry', () => {
  it('registers, resolves and lists operations by name', () => {
    const registry = new OperationRegistry()
    registry.register({ 'projects.list': query('projects.list') })
    registry.register({ 'projects.update': mutation('projects.update') })
    expect(registry.get('projects.list').kind).toBe('query')
    expect(registry.has('projects.update')).toBe(true)
    expect(registry.names()).toEqual(['projects.list', 'projects.update'])
    expect(registry.all().map((op) => op.name)).toEqual(['projects.list', 'projects.update'])
  })

  it('replaces a name registered twice, so a test can swap in a fake', () => {
    const registry = new OperationRegistry()
    registry.register({ 'projects.list': query('projects.list') })
    const fake = query('fake')
    registry.register({ 'projects.list': fake })
    expect(registry.get('projects.list')).toBe(fake)
  })

  it('names the registered operations when one is missing', () => {
    const registry = new OperationRegistry()
    expect(() => registry.get('nope')).toThrow(/Nothing is registered/)
    registry.register({ 'projects.list': query('projects.list') })
    expect(() => registry.get('nope')).toThrow(/Registered: projects.list/)
  })

  it('rejects values that are not definitions', () => {
    const registry = new OperationRegistry()
    expect(() => registry.register({ bad: {} as OperationLike })).toThrow(/operations.bad/)
  })

  it('is filled by createApp({ operations }) and shared by forks', () => {
    const app = createApp({ operations: { 'projects.list': query('projects.list') } })
    expect(app.operations).toBe(operations)
    expect(operations.get('projects.list').name).toBe('projects.list')
    expect(app.fork().operations.has('projects.list')).toBe(true)
    operations.reset()
    expect(app.operations.has('projects.list')).toBe(false)
  })
})

describe('globToRegExp', () => {
  it('matches the shapes generators use', () => {
    const re = globToRegExp('app/actions/**/*.{ts,tsx}')
    expect(re.test('app/actions/projects.ts')).toBe(true)
    expect(re.test('app/actions/projects/update.tsx')).toBe(true)
    expect(re.test('app/actions/projects/update.test.ts')).toBe(true)
    expect(re.test('app/routes/index.tsx')).toBe(false)
    expect(re.test('app/actions/notes.md')).toBe(false)
    expect(globToRegExp('kitrrc.ts').test('kitrrc.ts')).toBe(true)
    expect(globToRegExp('*.ts').test('a/b.ts')).toBe(false)
    expect(globToRegExp('?.ts').test('a.ts')).toBe(true)
  })
})
