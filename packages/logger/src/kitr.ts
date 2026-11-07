import { definePackage } from '@kitr/core/package'

/** `kitr add logger`: the structured logger with levels, children and request ids. */
export default definePackage({
  name: 'logger',
  add(ctx) {
    ctx.provider.add('@kitr/logger')
    ctx.config(
      'logger',
      `import { defineConfig } from 'kitr/logger'\n\nexport default defineConfig({\n  name: 'app',\n  level: (process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') ?? 'info',\n  // 'pretty' in dev, 'json' in production by default.\n})\n`,
    )
    ctx.agents.add(
      'logger',
      `- Log through \`ctx.logger\` (request-scoped, carries the request id) or \`app.container.use('logger')\`. Never \`console.log\` in server code.`,
    )
  },
  remove(ctx) {
    ctx.provider.remove('@kitr/logger')
    ctx.agents.remove('logger')
  },
})
