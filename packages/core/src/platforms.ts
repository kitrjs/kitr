/**
 * The platforms of the project, by name, as `kitr types` writes them to `.kitr/platforms.d.ts`
 * from `kitrrc.ts`:
 *
 *   declare module '@kitr/core' {
 *     interface KitrPlatforms {
 *       site: { type: 'web'; options: { mode: 'ssr'; port: 3000 } }
 *       api: { type: 'server'; options: {} }
 *     }
 *   }
 *
 * `app.platform` and `usePlatform().name` are then `'site' | 'api'` instead of `string`, and a
 * component can branch on the name with the compiler checking every case.
 */
// biome-ignore lint/suspicious/noEmptyInterface: augmentation target
export interface KitrPlatforms {}

/** A platform name from `kitrrc.ts`, or any string before `kitr types` has run. */
export type PlatformName = keyof KitrPlatforms extends never ? string : keyof KitrPlatforms & string

/** The platform type (`web`, `server`...) of a named platform. */
export type PlatformTypeOf<N extends PlatformName> = N extends keyof KitrPlatforms
  ? KitrPlatforms[N] extends { type: infer T }
    ? T
    : string
  : string
