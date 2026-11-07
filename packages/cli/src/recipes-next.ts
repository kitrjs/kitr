import type { ProjectContext } from './context'
import { type Recipe, r } from './recipe'

/**
 * Insert `line` (with its import) into server/main.ts once. By default it goes after the routes
 * and anything attached before it; `first` puts it straight after `createServer()` so middleware
 * that must see every request (the shield) reads in the order it runs.
 */
function attachToServer(
  ctx: ProjectContext,
  marker: string,
  importLine: string,
  line: string,
  options: { first?: boolean } = {},
) {
  if (!ctx.exists('server/main.ts')) return
  const main = ctx.read('server/main.ts')
  if (main.includes(marker)) return
  let next = importLine
    ? main.replace(/(import \{ createServer \} from 'kitr\/server'\n)/, `$1${importLine}\n`)
    : main
  next = options.first
    ? next.replace(/(export const server = createServer\([^\n]*\)\n)/, `$1${line}\n`)
    : next.replace(
        /(export const server = createServer\([^\n]*\)\n(?:(?:\/\/[^\n]*\n)?(?!export |const |\n)[^\n]+\n)*)/,
        `$1${line}\n`,
      )
  if (next !== main) ctx.write('server/main.ts', next, { overwrite: true })
}

/**
 * The next tier: device capabilities, offline data, flags, consent, and the server-side
 * cache, shield, mail, jobs and uploads. Each recipe writes `config/<name>.ts`, adds the
 * provider and tells agents how the package is meant to be used.
 */
export const nextRecipes: Record<string, Recipe> = {
  'secure-storage': r({
    name: 'secure-storage',
    package: '@kitr/secure-storage',
    description:
      "Keep login tokens and secrets in the phone or computer's secure vault instead of plain storage.",
    configure(ctx, c) {
      c.installPackages(['@kitr/secure-storage'])
      c.addProvider('@kitr/secure-storage/provider')
      c.addPackage('@kitr/secure-storage')
      ctx.write(
        'config/secure-storage.ts',
        `import { defineConfig } from 'kitr/secure-storage'\n\nexport default defineConfig({\n  // OS vault on mobile/desktop; AES-GCM in the browser. true refuses the browser fallback.\n  requireSecure: false,\n})\n`,
      )
      ctx.write(
        'app/secure.ts',
        `import { defineSecureItem } from 'kitr/secure-storage'\n\n/** Secrets, typed once: \`useSecureItem(sessionItem)\` in components, \`sessionItem(storage).get()\` elsewhere. */\nexport const sessionItem = defineSecureItem<{ token: string; expiresAt: number }>('session')\n`,
      )
      c.addAgentsSection(
        'secure-storage',
        `- Tokens and secrets go through \`kitr/secure-storage\` (\`app/secure.ts\`), never \`defineStorage\` or localStorage. \`useSecureItem(item)\` returns \`[value, set, { loading, secure }]\`; the value is undefined until the vault answers.`,
      )
    },
    unconfigure(_ctx, c) {
      c.removeProvider('@kitr/secure-storage/provider')
      c.removePackage('@kitr/secure-storage')
      c.removePackages(['@kitr/secure-storage'])
      c.removeAgentsSection('secure-storage')
    },
  }),
  files: r({
    name: 'files',
    package: '@kitr/files',
    description:
      'Let people open, save and pick files on any platform, with a download fallback in older browsers.',
    configure(ctx, c) {
      c.installPackages(['@kitr/files'])
      c.addProvider('@kitr/files/provider')
      c.addPackage('@kitr/files')
      ctx.write(
        'config/files.ts',
        `import { defineConfig } from 'kitr/files'\n\nexport default defineConfig({\n  // Filters added to every open/save dialog.\n  filters: [],\n})\n`,
      )
      c.addAgentsSection(
        'files',
        `- Open, pick and save files with \`useFileDialogs()\` from \`kitr/files/react\` (or \`app.container.use('files')\`). Never build \`<input type="file">\` or download links by hand: the service shows native dialogs on desktop/mobile and falls back on the web. A cancelled dialog resolves to \`[]\`/\`null\`.`,
      )
    },
    unconfigure(_ctx, c) {
      c.removeProvider('@kitr/files/provider')
      c.removePackage('@kitr/files')
      c.removePackages(['@kitr/files'])
      c.removeAgentsSection('files')
    },
  }),
  notifications: r({
    name: 'notifications',
    package: '@kitr/notifications',
    description:
      'Ask for permission and show local or scheduled notifications that open the right page when tapped.',
    configure(ctx, c) {
      c.installPackages(['@kitr/notifications'])
      c.addProvider('@kitr/notifications/provider')
      c.addPackage('@kitr/notifications')
      ctx.write(
        'config/notifications.ts',
        `import { defineConfig } from 'kitr/notifications'\n\nexport default defineConfig({\n  icon: '/icon-192.png',\n  // Ask from a click (browsers block unprompted asks); true asks at boot instead.\n  requestOnBoot: false,\n})\n`,
      )
      c.addAgentsSection(
        'notifications',
        `- \`useNotificationPermission()\` gives \`{ permission, request }\`; call \`request\` from a click. \`notifications.show({ title, url })\` / \`schedule({ ..., at })\` resolve to an id for \`cancel\`. Route taps once, near the router: \`useNotificationTap((tap) => tap.url && navigate({ to: tap.url }))\`.`,
      )
    },
    unconfigure(_ctx, c) {
      c.removeProvider('@kitr/notifications/provider')
      c.removePackage('@kitr/notifications')
      c.removePackages(['@kitr/notifications'])
      c.removeAgentsSection('notifications')
    },
  }),
  native: r({
    name: 'native',
    package: '@kitr/native',
    description:
      'Clipboard, share sheet, haptics, location, camera and fingerprint unlock, each with a web fallback.',
    configure(_ctx, c) {
      c.installPackages(['@kitr/native'])
      c.addProvider('@kitr/native/provider')
      c.addPackage('@kitr/native')
      c.addAgentsSection(
        'native',
        `- Clipboard, share, haptics, geolocation, camera and biometrics come from \`useNative()\` / \`useClipboard()\` / \`useShare()\` / \`useGeolocation()\` in \`kitr/native/react\`. Check \`.supported\` (or \`canShare\`) before showing a button; calling an unsupported capability rejects with \`UnsupportedError\`.`,
      )
    },
    unconfigure(_ctx, c) {
      c.removeProvider('@kitr/native/provider')
      c.removePackage('@kitr/native')
      c.removePackages(['@kitr/native'])
      c.removeAgentsSection('native')
    },
  }),
  updater: r({
    name: 'updater',
    package: '@kitr/updater',
    description:
      'Tell people a new version is ready and update the app in place, on the web, desktop and mobile.',
    configure(ctx, c) {
      c.installPackages(['@kitr/updater'])
      c.addProvider('@kitr/updater/provider')
      c.addPackage('@kitr/updater')
      ctx.write(
        'config/updater.ts',
        `import { defineConfig } from 'kitr/updater'\n\nexport default defineConfig({\n  checkOnBoot: true,\n  interval: 60 * 60 * 1000, // look again every hour while the app is open\n  auto: false, // true applies as soon as an update is ready, without asking\n})\n`,
      )
      ctx.write(
        'app/components/update-banner.tsx',
        `import { useUpdate } from 'kitr/updater/react'

/** Mount once in the root layout. Hidden until the updater has something ready. */
export function UpdateBanner() {
  const { available, update, status, progress, apply, dismiss } = useUpdate()
  if (!available) return null
  return (
    <div role="status" className="fixed inset-x-0 bottom-0 flex items-center justify-center gap-3 bg-foreground p-3 text-sm text-background">
      <span>Version {update?.version} is ready.</span>
      <button type="button" className="rounded-md bg-background px-3 py-1 text-foreground" onClick={apply} disabled={status === 'downloading'}>
        {status === 'downloading' ? \`Updating \${Math.round(progress * 100)}%\` : 'Restart to update'}
      </button>
      <button type="button" className="underline" onClick={dismiss}>
        Later
      </button>
    </div>
  )
}
`,
      )
      c.addAgentsSection(
        'updater',
        `- \`useUpdate()\` from \`kitr/updater/react\` drives \`app/components/update-banner.tsx\` (mount it once in the root layout). Status runs idle → checking → available → downloading → ready; the web driver watches the service worker, desktop/mobile packages register theirs.`,
      )
    },
    unconfigure(_ctx, c) {
      c.removeProvider('@kitr/updater/provider')
      c.removePackage('@kitr/updater')
      c.removePackages(['@kitr/updater'])
      c.removeAgentsSection('updater')
    },
  }),
  offline: r({
    name: 'offline',
    package: '@kitr/offline',
    description:
      'Keep showing loaded data with no connection, and send queued changes when the network comes back.',
    configure(ctx, c) {
      c.installPackages(['@kitr/offline'])
      c.addProvider('@kitr/offline/provider')
      c.addPackage('@kitr/offline')
      ctx.write(
        'config/offline.ts',
        `import { defineConfig } from 'kitr/offline'\nimport { env } from '#app/env'\n\nexport default defineConfig({\n  maxAge: 24 * 60 * 60 * 1000,\n  // include: (key) => key[0] !== 'search', // leave volatile queries out of the snapshot\n  buster: env.VITE_APP_VERSION, // a new version drops old snapshots\n})\n`,
      )
      c.addEnvSchema('public', 'VITE_APP_VERSION', "e.string({ default: '0.0.0' })", '0.0.0')
      c.addAgentsSection(
        'offline',
        `- Successful queries are persisted and restored before the first render; mutations made offline pause and replay on reconnect (TanStack's default \`networkMode\`). Give mutations a \`mutationKey\` and an optimistic \`onMutate\`. \`useOffline()\` from \`kitr/offline/react\` gives \`{ online, pending, restored }\` for a status line.`,
      )
    },
    unconfigure(_ctx, c) {
      c.removeProvider('@kitr/offline/provider')
      c.removePackage('@kitr/offline')
      c.removePackages(['@kitr/offline'])
      c.removeAgentsSection('offline')
    },
  }),
  flags: r({
    name: 'flags',
    package: '@kitr/flags',
    description:
      'Turn features on for some users and off for others, with the same answer on the server and in the browser.',
    configure(ctx, c) {
      const serverOnly = ctx.isServerOnly()
      c.installPackages(['@kitr/flags'])
      c.addProvider('@kitr/flags/provider')
      c.addPackage('@kitr/flags')
      ctx.write(
        'app/flags.ts',
        `import { defineFlags } from 'kitr/flags'\n\n/** Every flag with its default, so unknown flags are a type error. */\nexport const flags = defineFlags({\n  'new-dashboard': { default: false, description: 'The redesigned dashboard' },\n  'max-upload-mb': { default: 10 },\n})\n`,
      )
      ctx.write(
        'config/flags.ts',
        `import { defineConfig, envFlagsProvider, percentageFlagsProvider } from 'kitr/flags'\nimport { flags } from '#app/flags'\n\nexport default defineConfig({\n  definitions: flags,\n  // First provider with an answer wins: FLAG_NEW_DASHBOARD=true in .env, then a 10% rollout.\n  providers: [envFlagsProvider(), percentageFlagsProvider({ 'new-dashboard': 10 })],\n  // openFeatureFlagsProvider(client) plugs in LaunchDarkly, Flagsmith, Unleash... through OpenFeature.\n})\n`,
      )
      c.addAgentsSection(
        'flags',
        serverOnly
          ? `- Flags live in \`app/flags.ts\` (\`defineFlags\`); resolve per request with \`resolveFlags(app, event, { userId })\` from \`kitr/flags/server\`. Providers are ordered in \`config/flags.ts\`.`
          : `- Flags live in \`app/flags.ts\` (\`defineFlags\`). Components read \`useFlag('new-dashboard')\` from \`kitr/flags/react\`; the server resolves them per request (\`resolveFlags\` in \`kitr/flags/server\`) and embeds them with \`<FlagsScript />\` so the first render matches. Never read \`import.meta.env\` for a feature switch.`,
      )
    },
    unconfigure(_ctx, c) {
      c.removeProvider('@kitr/flags/provider')
      c.removePackage('@kitr/flags')
      c.removePackages(['@kitr/flags'])
      c.removeAgentsSection('flags')
    },
  }),
  consent: r({
    name: 'consent',
    package: '@kitr/consent',
    description:
      'Ask for cookie and tracking consent once, and hold analytics and error reports until people agree.',
    configure(ctx, c) {
      c.installPackages(['@kitr/consent'])
      c.addProvider('@kitr/consent/provider')
      c.addPackage('@kitr/consent')
      ctx.write(
        'config/consent.ts',
        `import { defineConfig } from 'kitr/consent'\n\nexport default defineConfig({\n  categories: ['analytics', 'marketing'],\n  version: 1, // bump to ask everyone again\n  analytics: 'analytics', // analytics waits for this category\n  monitoring: false, // error reports are not gated\n})\n`,
      )
      ctx.write(
        'app/components/consent-banner.tsx',
        `import { useConsent } from 'kitr/consent/react'

/** Mount once in the root layout. Renders nothing once a choice is recorded. */
export function ConsentBanner() {
  const { decided, acceptAll, rejectAll } = useConsent()
  if (decided) return null
  return (
    <div role="dialog" aria-label="Cookie consent" className="fixed inset-x-0 bottom-0 flex flex-wrap items-center justify-center gap-3 border-t bg-background p-4 text-sm">
      <span>We use cookies for analytics. You can change your mind in settings.</span>
      <button type="button" className="rounded-md border px-3 py-1" onClick={rejectAll}>
        Only necessary
      </button>
      <button type="button" className="rounded-md bg-foreground px-3 py-1 text-background" onClick={acceptAll}>
        Accept all
      </button>
    </div>
  )
}
`,
      )
      c.addAgentsSection(
        'consent',
        `- \`app/components/consent-banner.tsx\` is the one place consent is asked; mount it in the root layout. Analytics stays queued until its category is granted (\`config/consent.ts\`), so never call \`analytics.enable()\` by hand. Read a category with \`useConsent().has('marketing')\` before loading third-party scripts.`,
      )
    },
    unconfigure(_ctx, c) {
      c.removeProvider('@kitr/consent/provider')
      c.removePackage('@kitr/consent')
      c.removePackages(['@kitr/consent'])
      c.removeAgentsSection('consent')
    },
  }),
  cache: r({
    name: 'cache',
    package: '@kitr/cache',
    description: 'Remember slow results on the server and clear them by tag when the data changes.',
    configure(ctx, c) {
      c.installPackages(['@kitr/cache'])
      c.addProvider('@kitr/cache/provider')
      c.addPackage('@kitr/cache')
      ctx.write(
        'config/cache.ts',
        `import { defineConfig } from 'kitr/cache'\n\nexport default defineConfig({\n  // In-memory by default. For several instances pass a shared driver (Redis, Upstash) as \`driver\`.\n  prefix: '${(ctx.pkg.name ?? 'app').replace(/^@[^/]+\//, '')}:',\n  defaultTtl: 300,\n})\n`,
      )
      c.addAgentsSection(
        'cache',
        `- Expensive reads go through \`cache.remember(key, fn, { ttl, tags })\` or \`cached(cache, fn, { key, ttl, tags })\` from \`kitr/cache\`; \`useCache(ctx.app)\` in controllers and actions. Invalidate by tag after a write (\`cache.invalidateTags('projects')\`) instead of guessing keys.`,
      )
    },
    unconfigure(_ctx, c) {
      c.removeProvider('@kitr/cache/provider')
      c.removePackage('@kitr/cache')
      c.removePackages(['@kitr/cache'])
      c.removeAgentsSection('cache')
    },
  }),
  shield: r({
    name: 'shield',
    package: '@kitr/shield',
    description:
      'Turn on the security basics every API needs: CORS, CSRF protection, safe headers and rate limits.',
    configure(ctx, c) {
      c.installPackages(['@kitr/shield'])
      c.addProvider('@kitr/shield/provider')
      c.addPackage('@kitr/shield')
      ctx.write(
        'config/shield.ts',
        `import { defineConfig } from 'kitr/shield'\n\nexport default defineConfig({\n  headers: {}, // sensible security headers; set contentSecurityPolicy to tighten\n  cors: false, // { origin: ['https://app.example.com'], credentials: true } for a separate front end\n  rateLimit: { max: 300, windowMs: 60_000 }, // per IP per minute\n  csrf: {}, // double-submit cookie; kitr/http sends the token on every non-GET request\n})\n`,
      )
      attachToServer(
        ctx,
        'shield(server',
        "import { shield } from 'kitr/shield'",
        '// Security headers, CORS, rate limit and CSRF from config/shield.ts.\nshield(server)',
        { first: true },
      )
      c.addAgentsSection(
        'shield',
        `- \`shield(server)\` in \`server/main.ts\` applies \`config/shield.ts\`: security headers, CORS, rate limiting and CSRF. Rate-limited requests get 429 with RateLimit-* headers; CSRF failures get 403. Do not add helmet/cors by hand; tune the config instead.`,
      )
    },
    unconfigure(_ctx, c) {
      c.removeProvider('@kitr/shield/provider')
      c.removePackage('@kitr/shield')
      c.removePackages(['@kitr/shield'])
      c.removeAgentsSection('shield')
    },
  }),
  mail: r({
    name: 'mail',
    package: '@kitr/mail',
    description:
      'Write emails as React components, send them through your provider, and preview them in development.',
    configure(ctx, c) {
      c.installPackages(['@kitr/mail'])
      c.addProvider('@kitr/mail/provider')
      c.addPackage('@kitr/mail')
      c.addEnv({ RESEND_API_KEY: '', MAIL_FROM: 'App <hello@example.com>' }, 'Mail')
      ctx.write(
        'config/mail.ts',
        `import { createLogTransport, createResendTransport, defineConfig } from 'kitr/mail'\n\n/** Development logs every message; production needs a transport: Resend here, or createSmtpTransport(nodemailer, { host, auth }). */\nexport default defineConfig({\n  from: process.env.MAIL_FROM ?? 'App <hello@example.com>',\n  transport: process.env.RESEND_API_KEY\n    ? createResendTransport({ apiKey: process.env.RESEND_API_KEY })\n    : createLogTransport(),\n})\n`,
      )
      ctx.write(
        'server/mail/welcome.tsx',
        `import { defineMail } from 'kitr/mail'

export interface WelcomeProps {
  name: string
}

/** Send with \`mailer.send(welcomeMail, { name }, { to })\`; preview at /_kitr/mail/welcome in development. */
export const welcomeMail = defineMail<WelcomeProps>('welcome', {
  subject: ({ name }) => \`Welcome, \${name}\`,
  preview: { name: 'Ada' },
  render: ({ name }) => (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', lineHeight: 1.5 }}>
        <h1>Hello {name}</h1>
        <p>Thanks for joining.</p>
      </body>
    </html>
  ),
})
`,
      )
      attachToServer(
        ctx,
        'mailPreview(',
        "import { mailPreview } from 'kitr/mail'\nimport { welcomeMail } from './mail/welcome'",
        '// Rendered templates at /_kitr/mail in development.\nif (server.app.isDevelopment) mailPreview(server, [welcomeMail])',
      )
      c.addAgentsSection(
        'mail',
        `- Templates are React components in \`server/mail/*.tsx\` (\`kitr make:mail <name>\`, \`defineMail\`). Send from a job or controller with \`ctx.app.container.use('mailer').send(template, props, { to })\`. Development logs messages and previews them at \`/_kitr/mail\`; production needs \`RESEND_API_KEY\` (or an SMTP transport) in \`config/mail.ts\`.`,
      )
    },
    unconfigure(_ctx, c) {
      c.removeProvider('@kitr/mail/provider')
      c.removePackage('@kitr/mail')
      c.removePackages(['@kitr/mail'])
      c.removeAgentsSection('mail')
    },
  }),
  jobs: r({
    name: 'jobs',
    package: '@kitr/jobs',
    description: 'Run work in the background or on a schedule, with retries when it fails.',
    configure(ctx, c) {
      c.installPackages(['@kitr/jobs'])
      c.addProvider('@kitr/jobs/provider')
      c.addPackage('@kitr/jobs')
      ctx.write(
        'config/jobs.ts',
        `import { defineConfig } from 'kitr/jobs'\nimport { exampleJob } from '#server/jobs/example'\n\nexport default defineConfig({\n  // Every job the worker runs (kitr make:job <name> writes one in server/jobs/).\n  jobs: [exampleJob],\n  // In-memory queue by default: fine for one process. For several, pass a shared driver.\n  concurrency: 5,\n  worker: true, // false when a separate worker process runs the jobs\n})\n`,
      )
      ctx.write(
        'server/jobs/example.ts',
        `import { defineJob } from 'kitr/jobs'\nimport { z } from 'zod'\n\n/** Dispatch with \`useJobs(app).dispatch(exampleJob, { id })\`; it runs on the worker with retries. */\nexport const exampleJob = defineJob('example', {\n  schema: z.object({ id: z.string() }),\n  retries: 3,\n  // schedule: { every: '1h' },\n  async run({ id }, ctx) {\n    console.info(\`example job \${id} (attempt \${ctx.attempt})\`)\n  },\n})\n`,
      )
      c.addAgentsSection(
        'jobs',
        `- Background work is a job in \`server/jobs/*.ts\` (\`kitr make:job <name>\`, \`defineJob\` with a schema, retries and an optional schedule), listed in \`config/jobs.ts\`. Dispatch from controllers and actions with \`ctx.app.container.use('jobs').dispatch(job, payload)\`; never \`setTimeout\` work in a request.`,
      )
    },
    unconfigure(_ctx, c) {
      c.removeProvider('@kitr/jobs/provider')
      c.removePackage('@kitr/jobs')
      c.removePackages(['@kitr/jobs'])
      c.removeAgentsSection('jobs')
    },
  }),
  uploads: r({
    name: 'uploads',
    package: '@kitr/uploads',
    description:
      'Accept file uploads with size limits, store them on disk or in the cloud, and show progress in the browser.',
    configure(ctx, c) {
      const serverOnly = ctx.isServerOnly()
      c.installPackages(['@kitr/uploads'])
      c.addProvider('@kitr/uploads/provider')
      c.addPackage('@kitr/uploads')
      ctx.write(
        'config/uploads.ts',
        `import { defineConfig } from 'kitr/uploads'\n\nexport default defineConfig({\n  maxSize: 10 * 1024 * 1024,\n  accept: ['image/*', 'application/pdf'],\n  // Files go to storage/uploads and are served under publicPath. Pass a driver for S3/R2.\n  publicPath: '/uploads',\n})\n`,
      )
      attachToServer(
        ctx,
        'mountUploads(',
        "import { mountUploads } from 'kitr/uploads/server'",
        '// POST /api/uploads receives multipart files per config/uploads.ts; GET serves them.\nmountUploads(server)',
      )
      c.addAgentsSection(
        'uploads',
        serverOnly
          ? `- Files arrive at \`POST /api/uploads\` (mounted in \`server/main.ts\`); size and type rules live in \`config/uploads.ts\`. In a controller: \`ctx.app.container.use('uploads').receive(event)\`.`
          : `- Upload from components with \`useUpload()\` from \`kitr/uploads/react\` (progress, cancel, typed errors); the server side is \`POST /api/uploads\` mounted in \`server/main.ts\` with rules from \`config/uploads.ts\`. Check \`checkFile(file, rules)\` client-side before sending.`,
      )
    },
    unconfigure(_ctx, c) {
      c.removeProvider('@kitr/uploads/provider')
      c.removePackage('@kitr/uploads')
      c.removePackages(['@kitr/uploads'])
      c.removeAgentsSection('uploads')
    },
  }),
}
