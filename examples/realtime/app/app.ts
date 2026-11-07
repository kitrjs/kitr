import { createApp } from 'kitr/app'
import { config } from 'virtual:kitr/config'
import { providers } from 'virtual:kitr/providers'
import { env } from './env'

/** One app object: providers from kitrrc.ts, config from config/*.ts, both as static imports. */
export const app = createApp({ providers, config, env })
