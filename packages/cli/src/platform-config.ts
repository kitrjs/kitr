import { readdirSync, statSync } from 'node:fs'
import { resolvePackageName, shortPackageName } from '@kitr/core/package'
import type { ProjectContext, RcInfo } from './context'

/**
 * Which config files each platform's build uses. The shared `config/<name>.ts` files ship to
 * every platform; `config/<platform>/<name>.ts` replaces one of them for that platform; a
 * package in the platform's `without` list takes its file out. The Vite plugin applies the
 * same rules to `virtual:kitr/config`.
 */
export interface PlatformConfigLayout {
  /** The config directory, project-relative (`config`). */
  dir: string
  /** Shared file names (`theme` for `config/theme.ts`), sorted. */
  shared: string[]
  platforms: Record<string, PlatformConfigFiles>
  /** Folders under config/ whose name is not a platform. */
  strayDirs: string[]
}

export interface PlatformConfigFiles {
  /** `without` as written in kitrrc.ts. */
  without: string[]
  /** Shared names this platform replaces with `config/<platform>/<name>.ts`. */
  overrides: string[]
  /** Shared names this platform leaves out (from `without`). */
  dropped: string[]
  /** What the build imports: each name and the project-relative file it comes from. */
  files: Array<{ name: string; source: string }>
}

/** `without` entries of a platform, as read statically from kitrrc.ts. */
export function withoutOf(rc: RcInfo, platform: string): string[] {
  const value = rc.platforms[platform]?.options?.without
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []
}

/** `analytics` or `@kitr/analytics` → the `config/<name>.ts` name, `analytics`. */
export function configNameOf(pkg: string): string {
  return shortPackageName(resolvePackageName(pkg))
}

function tsFiles(full: string): string[] {
  return readdirSync(full)
    .filter((f) => /^[a-z0-9-]+\.ts$/.test(f) && f !== 'index.ts')
    .filter((f) => statSync(`${full}/${f}`).isFile())
    .map((f) => f.replace(/\.ts$/, ''))
    .sort()
}

export function readPlatformConfig(ctx: ProjectContext, rc = ctx.readRc()): PlatformConfigLayout {
  const dir = rc.directories.config ?? 'config'
  const layout: PlatformConfigLayout = { dir, shared: [], platforms: {}, strayDirs: [] }
  const names = Object.keys(rc.platforms)
  const exists = ctx.exists(dir)
  if (exists) {
    layout.shared = tsFiles(ctx.path(dir))
    for (const entry of readdirSync(ctx.path(dir)).sort())
      if (statSync(ctx.path(dir, entry)).isDirectory() && !names.includes(entry))
        layout.strayDirs.push(entry)
  }
  for (const name of names) {
    const without = withoutOf(rc, name)
    const dropped = without.map(configNameOf).filter((n) => layout.shared.includes(n))
    const own = exists && ctx.exists(dir, name) ? tsFiles(ctx.path(dir, name)) : []
    const overrides = own.filter((n) => layout.shared.includes(n) && !dropped.includes(n))
    const files = layout.shared
      .filter((n) => !dropped.includes(n))
      .map((n) => ({
        name: n,
        source: overrides.includes(n) ? `${dir}/${name}/${n}.ts` : `${dir}/${n}.ts`,
      }))
    layout.platforms[name] = { without, overrides, dropped, files }
  }
  return layout
}
