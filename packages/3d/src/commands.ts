import { copyDecoders, DEFAULT_DECODER_DIR } from './decoders'

/**
 * `kitr 3d:decoders`. A plain command object (citty's shape), so this module needs no CLI
 * dependency; the kitr CLI mounts it when `@kitr/3d` is in kitrrc.ts.
 */
// kitr-allow-module-state: lookup table built once at import, never mutated
export const decoders = {
  meta: {
    name: '3d:decoders',
    description:
      'Copy the Draco decoder from the installed three into public/draco, so compressed models load without a CDN.',
  },
  args: {
    out: {
      type: 'string',
      description: 'Folder to copy into, from the project root',
      default: DEFAULT_DECODER_DIR,
    },
  },
  run({ args }: { args: { out?: string } }) {
    const files = copyDecoders(process.cwd(), args.out ?? DEFAULT_DECODER_DIR)
    for (const file of files) console.log(`  wrote ${file}`)
    console.log('Draco decoder copied. useModel() loads it from /draco/.')
  },
}
