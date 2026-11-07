import { describe, expectTypeOf, it } from 'vitest'
import { defineCommands } from '../src/client'

type Rust = {
  greet: (args: { name: string }) => string
  version: () => string
  save: (args: { path: string; data: number[] }) => Promise<boolean>
}

describe('tauri command types', () => {
  it('types arguments and promised results', () => {
    const commands = defineCommands<Rust>()
    expectTypeOf(commands.greet).parameters.toEqualTypeOf<[{ name: string }]>()
    expectTypeOf(commands.greet).returns.toEqualTypeOf<Promise<string>>()
    expectTypeOf(commands.version).parameters.toEqualTypeOf<[]>()
    expectTypeOf(commands.save).returns.toEqualTypeOf<Promise<boolean>>()
    // @ts-expect-error missing argument
    commands.greet()
    // @ts-expect-error unknown command
    commands.nope
  })
})
