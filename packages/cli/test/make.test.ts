import { describe, expect, it } from 'vitest'
import {
  coreGenerators,
  formatGeneratorRows,
  generatorPattern,
  nearestKind,
} from '../src/commands/make'

const project = { rc: { directories: { app: 'app', server: 'server' } } } as any

describe('core generators', () => {
  it('write kebab files with the kind suffix, nested names in feature folders', () => {
    expect(coreGenerators.provider!.target('flags', project, {}).file).toBe(
      'app/providers/flags-provider.ts',
    )
    expect(coreGenerators.service!.target('billing/Usage', project, {}).file).toBe(
      'server/services/billing/usage-service.ts',
    )
    expect(coreGenerators.exception!.target('QuotaExceeded', project, {}).file).toBe(
      'app/exceptions/quota-exceeded-error.ts',
    )
  })

  it('name the export after the last segment of a nested name', () => {
    const { vars } = coreGenerators.service!.target('billing/usage', project, {})
    const body = coreGenerators.service!.stub({ name: 'billing/usage', ...vars } as any)
    expect(body).toContain('export class UsageService')
    expect(body).not.toContain('BillingUsageService')
  })

  it('print their target pattern for kitr make', () => {
    expect(generatorPattern(coreGenerators.service!, project)).toBe(
      'server/services/<name>-service.ts',
    )
  })

  it('every core generator says what its kind is', () => {
    for (const g of Object.values(coreGenerators)) expect(g.definition).toBeTruthy()
  })
})

describe('kitr make', () => {
  it('aligns the rows', () => {
    const text = formatGeneratorRows([
      {
        kind: 'service',
        owner: 'kitr',
        pattern: 'server/services/<name>-service.ts',
        description: 'd',
      },
      { kind: 'page', owner: '@kitr/router', pattern: 'app/pages/<path>.tsx', description: 'd' },
    ])
    expect(text).toMatch(/make:service {2}server/)
    expect(text).toMatch(/make:page {5}app/)
  })

  it('suggests the kind that was meant', () => {
    const kinds = ['controller', 'component', 'channel', 'service', 'page']
    expect(nearestKind('controler', kinds)).toBe('controller')
    expect(nearestKind('servise', kinds)).toBe('service')
    expect(nearestKind('pages', kinds)).toBe('page')
    expect(nearestKind('database', kinds)).toBeUndefined()
  })
})
