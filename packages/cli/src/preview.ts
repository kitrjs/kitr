import { resolvePackageName } from '@kitr/core/package'
import { kitManifests, manifests } from './manifests.gen'

/**
 * Preview packages are official packages that are not published yet (`"private": true` in their
 * package.json): deferred until they meet the release bar. They stay in the monorepo with their
 * docs and tests, but `kitr add` and `kitr new` refuse them unless previews are switched on with
 * `--preview` or `KITR_PREVIEW=1`, because npm has nothing to install.
 */
export function isPreview(name: string): boolean {
  const pkg = resolvePackageName(name)
  return [...Object.values(manifests), ...Object.values(kitManifests)].some(
    (m) => m.package === pkg && m.preview === true,
  )
}

/** Is the official kit with this short name (`desktop`) a preview? */
export function isPreviewKit(name: string): boolean {
  return kitManifests[name]?.preview === true
}

/** Whether previews are switched on for this process. */
export function previewsEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.KITR_PREVIEW === '1' || env.KITR_PREVIEW === 'true'
}

/** Switch previews on for this process (what `--preview` does). */
export function enablePreviews(): void {
  process.env.KITR_PREVIEW = '1'
}

/** Throws for a preview package or kit unless previews are on. */
export function assertReleased(name: string, what: 'package' | 'kit' = 'package'): void {
  if (!isPreview(name) || previewsEnabled()) return
  throw new Error(
    `${resolvePackageName(name)} is a preview ${what}: it is not published yet. Pass --preview (or set KITR_PREVIEW=1) to use it from a kitr checkout.`,
  )
}

/** Short names of the official packages that are released (not previews). */
export const releasedPackageNames = (names: string[]): string[] =>
  names.filter((n) => !isPreview(n) || previewsEnabled())
