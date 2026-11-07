import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, relative, resolve } from 'node:path'

/** The Draco decoder files three.js ships, which `DRACOLoader` fetches at run time. */
export const DRACO_FILES = [
  'draco_decoder.js',
  'draco_decoder.wasm',
  'draco_wasm_wrapper.js',
] as const

/** The folder under the project root that `kitr 3d:decoders` fills by default. */
export const DEFAULT_DECODER_DIR = 'public/draco'

/** The Draco decoder folder inside the project's installed `three`. Throws when three is not installed. */
export function dracoSource(root: string): string {
  try {
    const file = createRequire(resolve(root, 'package.json')).resolve(
      'three/examples/jsm/libs/draco/gltf/draco_decoder.js',
    )
    return dirname(file)
  } catch {
    throw new Error(
      'three is not installed in this project. Run `kitr add 3d` or `pnpm add three`.',
    )
  }
}

/** Copy the Draco decoder from the installed `three` into `out` (default `public/draco`). Returns the files written. */
export function copyDecoders(root: string, out = DEFAULT_DECODER_DIR): string[] {
  const from = dracoSource(root)
  const to = resolve(root, out)
  mkdirSync(to, { recursive: true })
  return DRACO_FILES.map((file) => {
    copyFileSync(join(from, file), join(to, file))
    return relative(root, join(to, file))
  })
}

/** Are the decoder files present in `dir` (default `public/draco`)? */
export function hasDecoders(root: string, dir = DEFAULT_DECODER_DIR): boolean {
  return DRACO_FILES.every((file) => existsSync(resolve(root, dir, file)))
}

/** The `extensionsUsed` of a `.glb` or `.gltf` file's JSON, or `[]` when it cannot be read. */
export function gltfExtensions(file: string): string[] {
  try {
    const data = readFileSync(file)
    let json: string
    if (data.subarray(0, 4).toString('latin1') === 'glTF') {
      // GLB: a 12-byte header, then the JSON chunk's length, its type and the JSON itself.
      const length = data.readUInt32LE(12)
      json = data.subarray(20, 20 + length).toString('utf8')
    } else {
      json = data.toString('utf8')
    }
    const parsed = JSON.parse(json) as { extensionsUsed?: string[] }
    return parsed.extensionsUsed ?? []
  } catch {
    return []
  }
}

/** Model files under `dir` (default `public`) that need the Draco decoder, as paths from the project root. */
export function dracoModels(root: string, dir = 'public', depth = 4): string[] {
  const out: string[] = []
  const walk = (folder: string, level: number) => {
    if (level > depth || !existsSync(folder)) return
    for (const name of readdirSync(folder)) {
      if (name.startsWith('.') || name === 'node_modules') continue
      const path = join(folder, name)
      if (statSync(path).isDirectory()) walk(path, level + 1)
      else if (
        /\.(glb|gltf)$/i.test(name) &&
        gltfExtensions(path).includes('KHR_draco_mesh_compression')
      )
        out.push(relative(root, path))
    }
  }
  walk(resolve(root, dir), 0)
  return out.sort()
}
