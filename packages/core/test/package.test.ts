import { describe, expect, it } from 'vitest'
import {
  definePackage,
  isPackageDefinition,
  pickPackageDefinition,
  resolvePackageName,
  shortPackageName,
} from '../src/package'

describe('definePackage', () => {
  it('returns the definition unchanged, with its literal types kept', () => {
    const def = definePackage({
      name: 'jobs',
      requires: ['server'],
      questions: [{ name: 'worker', type: 'confirm', message: 'Worker?', default: true }],
    })
    expect(def.name).toBe('jobs')
    expect(def.requires).toEqual(['server'])
    expect(def.questions).toHaveLength(1)
  })

  it('recognises a definition on its own, as a default export or as a named `kitr` export', () => {
    const def = definePackage({ name: 'x' })
    expect(isPackageDefinition(def)).toBe(true)
    expect(isPackageDefinition({})).toBe(false)
    expect(isPackageDefinition(null)).toBe(false)
    expect(pickPackageDefinition(def)).toBe(def)
    expect(pickPackageDefinition({ default: def })).toBe(def)
    expect(pickPackageDefinition({ kitr: def })).toBe(def)
    expect(pickPackageDefinition({ other: 1 })).toBeUndefined()
    expect(pickPackageDefinition(undefined)).toBeUndefined()
  })
})

describe('package names', () => {
  it('maps short names to @kitr and leaves full names alone', () => {
    expect(resolvePackageName('jobs')).toBe('@kitr/jobs')
    expect(resolvePackageName('@acme/thing')).toBe('@acme/thing')
    expect(resolvePackageName('kitr-community/x')).toBe('kitr-community/x')
    expect(shortPackageName('@kitr/jobs')).toBe('jobs')
    expect(shortPackageName('@acme/thing')).toBe('@acme/thing')
  })
})
