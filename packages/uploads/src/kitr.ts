import { definePackage } from '@kitr/core/package'

/** `kitr add uploads`: file uploads with size limits, on disk or in the cloud, with progress in the browser. */
export default definePackage({
  name: 'uploads',
  requires: ['server'],
  add(ctx) {
    const serverOnly = ctx.isServerOnly
    ctx.provider.add('@kitr/uploads/provider')
    ctx.config(
      'uploads',
      `import { defineConfig } from 'kitr/uploads'\n\nexport default defineConfig({\n  maxSize: 10 * 1024 * 1024,\n  accept: ['image/*', 'application/pdf'],\n  // Files go to storage/uploads and are served by mountUploads() under publicPath. Pass a driver for S3/R2.\n  publicPath: '/api/uploads',\n})\n`,
    )
    ctx.server.attach({
      marker: 'mountUploads(',
      import: "import { mountUploads } from 'kitr/uploads/server'",
      line: '// POST /api/uploads receives multipart files per config/uploads.ts; GET serves them.\nmountUploads(server)',
    })
    ctx.agents.add(
      'uploads',
      serverOnly
        ? `- Files arrive at \`POST /api/uploads\` (mounted in \`server/main.ts\`); size and type rules live in \`config/uploads.ts\`. In a controller: \`ctx.app.container.use('uploads').receive(event)\`.`
        : `- Upload from components with \`useUpload()\` from \`kitr/uploads/react\` (progress, cancel, typed errors); the server side is \`POST /api/uploads\` mounted in \`server/main.ts\` with rules from \`config/uploads.ts\`. Check \`checkFile(file, rules)\` client-side before sending.`,
    )
  },
  remove(ctx) {
    ctx.provider.remove('@kitr/uploads/provider')
    ctx.agents.remove('uploads')
  },
  vite: { serverOnlyConfig: true },
})
