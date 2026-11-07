import type { MarkName } from '#app/components/creator-marks'
import platformsJson from '#app/generated/platforms.json'

export interface PlatformEntry {
  type: string
  name: string
  shell: string
  /** The short line under the name on a tile. */
  label: string
  color: string
  side: 'client' | 'server'
  tagline: string
  summary: string
  targets: string[]
  command: string
  builtOn: string[]
  highlights: Array<{ title: string; text: string }>
  /** Highlighted at build time. */
  code: string
  run: Array<[string, string]>
  native: string[]
  nativeLabel: string
  alternative?: string
  /** False while the platform package is kept off npm (`"private": true`). */
  available: boolean
  packages: { native: string[]; other: string[] }
  kits: Array<{ name: string; available: boolean }>
  docs: Array<{ title: string; url: string; description?: string }>
  guides: Array<{ title: string; description?: string; url: string }>
  resources: Array<{ title: string; url: string; text: string }>
}

export interface BuilderChoice {
  id: string
  type: string
  line: string
  cmd: string
  dev: string
  on?: boolean
  group?: string
  available: boolean
}

export interface BuilderLine {
  html: string
  /** Shown while a choice of this platform type is on. */
  type?: string
  /** Shown while this choice is on. */
  id?: string
}

const data = platformsJson as unknown as {
  platforms: PlatformEntry[]
  builder: { pre: string; lines: BuilderLine[]; choices: BuilderChoice[] }
  unpublished: string[]
}

export const platforms = data.platforms
export const builder = data.builder
/** Packages kept off npm for now; the platform pages leave them out. */
export const unpublished = new Set(data.unpublished)

export const findPlatform = (type: string) => platforms.find((p) => p.type === type)

/** Projects credited on each platform tile. */
export const platformMarks: Record<string, MarkName[]> = {
  web: ['vite', 'tanstack'],
  server: ['h3'],
  desktop: ['electron'],
  tauri: ['tauri'],
  mobile: ['capacitor'],
}
