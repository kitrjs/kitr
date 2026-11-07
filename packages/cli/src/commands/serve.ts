import { defineCommand } from 'citty'
import { createContext } from '../context'
import { parseFlags, runPlatforms } from '../platforms'

/** `kitr serve` is `kitr start`: run the production build of each platform (or the named ones). */
export const serve = defineCommand({
  meta: {
    name: 'serve',
    description: 'Alias of `kitr start`: run production builds of the platforms in kitrrc.ts.',
  },
  args: { names: { type: 'positional', required: false } },
  async run({ rawArgs }) {
    const ctx = createContext()
    const { words, flags } = parseFlags(rawArgs)
    await runPlatforms(ctx, 'start', words, flags)
  },
})
