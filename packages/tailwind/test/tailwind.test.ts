import { describe, expect, it } from 'vitest'
import { cn } from '../src'

describe('cn', () => {
  it('merges conflicting tailwind classes, later wins', () => {
    expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4')
    expect(cn('text-sm', { 'text-lg': true }, false, undefined)).toBe('text-lg')
  })
})
