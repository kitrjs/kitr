import { config } from 'virtual:kitr/config'
import { providers } from 'virtual:kitr/providers'
import { createApp } from 'kitr/app'

export const app = createApp({ providers, config })
