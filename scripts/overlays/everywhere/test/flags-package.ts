// The setup module of a package that ships the flags provider (level 3 of the Extending kitr guide).
// In a real package this is src/kitr.ts.
import { definePackage } from '@kitr/core/package'

export default definePackage({
  name: 'flags',
  add(ctx) {
    ctx.provider.add('@acme/flags/provider')
    ctx.config('flags', 'export default { flags: {} }\n')
  },
  remove(ctx) {
    ctx.provider.remove('@acme/flags/provider')
  },
})
