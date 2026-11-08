import { createApp, loadRc } from '@kitr/kitr/app'
import { config } from 'virtual:kitr/config'
import { providers } from 'virtual:kitr/providers'
import { env } from './env'
import { operations } from '#kitr/actions'

/** One app object: providers from kitrrc.ts, config from config/*.ts, both as static imports. */
export const app = createApp({ operations, ...loadRc({ providers }, config), env })
