import { describe, expectTypeOf, it } from 'vitest'
import {
  type ContractInput,
  type ContractOutput,
  createEnv,
  createKeys,
  type QueryContract,
  type StandardSchemaV1,
} from '../src'

declare const str: StandardSchemaV1<unknown, string>
declare const port: StandardSchemaV1<unknown, number>
declare const flag: StandardSchemaV1<unknown, boolean | undefined>

describe('createEnv types', () => {
  it('infers readonly outputs from public and server schemas', () => {
    const env = createEnv({
      public: { VITE_API_URL: str },
      server: { PORT: port, DEBUG: flag },
      runtimeEnv: {},
      skip: true,
    })
    expectTypeOf(env.VITE_API_URL).toEqualTypeOf<string>()
    expectTypeOf(env.PORT).toEqualTypeOf<number>()
    expectTypeOf(env.DEBUG).toEqualTypeOf<boolean | undefined>()
    // @ts-expect-error env is readonly
    env.PORT = 1
    // @ts-expect-error unknown variable
    env.NOPE
  })
})

describe('createKeys types', () => {
  it('produces literal tuples for TanStack keys', () => {
    const keys = createKeys('projects')
    expectTypeOf(keys.all).toEqualTypeOf<readonly ['projects']>()
    expectTypeOf(keys.lists()).toEqualTypeOf<readonly ['projects', 'list']>()
    expectTypeOf(keys.detail('1')).toEqualTypeOf<readonly ['projects', 'detail', string]>()
    expectTypeOf(keys.custom('stats', 2024)).toEqualTypeOf<readonly ['projects', 'stats', 2024]>()
  })
})

describe('contract helpers', () => {
  it('extract input and output', () => {
    type Q = QueryContract<{ id: string }, { name: string }>
    expectTypeOf<ContractInput<Q>>().toEqualTypeOf<{ id: string }>()
    expectTypeOf<ContractOutput<Q>>().toEqualTypeOf<{ name: string }>()
  })
})
