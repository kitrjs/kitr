import { describe, expect, it } from 'vitest'
import { KitrError } from '../src/errors'
import {
  anySchema,
  isStandardSchema,
  parse,
  schemaFrom,
  toFieldErrors,
  validate,
  validateSync,
} from '../src/schema'

const positive = schemaFrom((n: number) => {
  if (typeof n !== 'number' || n <= 0) return { issues: [{ message: 'must be positive' }] }
  return n
})

describe('toFieldErrors', () => {
  it('joins paths, unwraps path segments and groups messages', () => {
    expect(
      toFieldErrors([
        { message: 'a', path: ['items', 0, 'name'] },
        { message: 'b', path: [{ key: 'items' }, { key: 0 }, { key: 'name' }] },
        { message: 'c' },
        { message: 'd', path: [] },
      ]),
    ).toEqual({ 'items.0.name': ['a', 'b'], _root: ['c', 'd'] })
  })
})

describe('validate', () => {
  it('returns success or field errors without throwing', async () => {
    expect(await validate(positive, 2)).toEqual({ success: true, data: 2 })
    expect(await validate(positive, -1)).toEqual({
      success: false,
      fieldErrors: { _root: ['must be positive'] },
    })
  })

  it('handles async schemas', async () => {
    const asyncSchema = {
      '~standard': { version: 1, vendor: 't', validate: async (v: unknown) => ({ value: v }) },
    } as any
    expect(await validate(asyncSchema, 'x')).toEqual({ success: true, data: 'x' })
    expect(() => validateSync(asyncSchema, 'x')).toThrow(/async schema/)
  })

  it('validateSync mirrors validate', () => {
    expect(validateSync(positive, 3)).toEqual({ success: true, data: 3 })
    expect(validateSync(positive, 0).success).toBe(false)
  })

  it('parse throws a VALIDATION KitrError', async () => {
    await expect(parse(positive, 5)).resolves.toBe(5)
    const error = await parse(positive, 0).catch((e) => e)
    expect(error).toBeInstanceOf(KitrError)
    expect(error.code).toBe('VALIDATION')
    expect(error.fieldErrors).toEqual({ _root: ['must be positive'] })
  })
})

describe('schema helpers', () => {
  it('schemaFrom turns thrown errors into issues', () => {
    const s = schemaFrom(() => {
      throw new Error('nope')
    })
    expect(s['~standard'].validate(1)).toEqual({ issues: [{ message: 'nope' }] })
  })

  it('anySchema accepts everything', () => {
    expect(anySchema['~standard'].validate({ a: 1 })).toEqual({ value: { a: 1 } })
  })

  it('isStandardSchema detects the spec marker', () => {
    expect(isStandardSchema(positive)).toBe(true)
    expect(isStandardSchema({})).toBe(false)
    expect(isStandardSchema(null)).toBe(false)
  })
})
