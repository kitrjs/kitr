import { defineProvider } from '@kitr/kitr/app'

/** Options for `config/flags.ts`. */
export interface FlagsConfig {
  /** Flag name to value. Unknown flags are off. */
  flags: Record<string, boolean>
}

/** A small feature flag client. Swap the body for LaunchDarkly, Unleash or your own API. */
export class Flags {
  constructor(private readonly values: Record<string, boolean>) {}

  isOn(name: string): boolean {
    return this.values[name] ?? false
  }
}

// Types `app.config.get('flags')` and `useService('flags')` everywhere.
declare module '@kitr/core' {
  interface ConfigRegistry {
    flags: FlagsConfig
  }
  interface ContainerBindings {
    flags: Flags
  }
}

export default defineProvider({
  name: 'flags',
  register(app) {
    const config = app.config.get('flags', { flags: {} })
    app.container.singleton('flags', () => new Flags(config.flags))
  },
})
