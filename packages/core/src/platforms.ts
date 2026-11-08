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

/** Every platform type named in `kitrrc.ts` (`'web' | 'server'`), or any string before `kitr types` has run. */
export type PlatformTypeName = keyof KitrPlatforms extends never
  ? string
  : KitrPlatforms[keyof KitrPlatforms] extends { type: infer T }
    ? T & string
    : string

/** The platform names whose type is `T`: `PlatformNamesOf<'web'>` is `'site' | 'admin'`. */
export type PlatformNamesOf<T extends string> = {
  [N in keyof KitrPlatforms]: KitrPlatforms[N] extends { type: T } ? N & string : never
}[keyof KitrPlatforms]

/** The platform this bundle was built for, from `import.meta.env.KITR_PLATFORM` / `KITR_PLATFORM_TYPE` (set by `kitr dev|build <name>`), else `process.env`. */
export function buildPlatform(): {
  name: PlatformName | undefined
  type: PlatformTypeName | undefined
} {
  const meta = (import.meta as unknown as { env?: Record<string, string | undefined> }).env
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
    ?.env
  const name = meta?.KITR_PLATFORM || env?.KITR_PLATFORM || undefined
  const type = meta?.KITR_PLATFORM_TYPE || env?.KITR_PLATFORM_TYPE || undefined
  return { name: name as PlatformName | undefined, type: type as PlatformTypeName | undefined }
}

/** Keys a per-platform table may use: a platform name from `kitrrc.ts`, a platform type, or `default`. */
export type BuildPlatformKey = PlatformName | PlatformTypeName | (string & {})

/**
 * Resolve a per-platform table at build time, so the choice costs nothing at run time and needs
 * no app instance. The platform name wins over its type, then `default`:
 *
 *   export const Route = createFileRoute('/feed')({ ...ssrRoute({ www: true, default: false }) })
 */
export function forBuildPlatform<T>(
  table: Partial<Record<BuildPlatformKey, T>> & { default: T },
): T {
  const { name, type } = buildPlatform()
  const t = table as Record<string, T | undefined>
  if (name !== undefined && name in table) return t[name] as T
  if (type !== undefined && type in table) return t[type] as T
  return table.default
}
