import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { copyDecoders, dracoModels, gltfExtensions, hasDecoders } from '../src/decoders'
import threeD from '../src/kitr'

const here = resolve(__dirname, '..')
const dirs: string[] = []
const tmp = () => {
  const dir = mkdtempSync(join(tmpdir(), 'kitr-3d-'))
  dirs.push(dir)
  return dir
}
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

/** A minimal .glb: the 12-byte header and one JSON chunk. */
function glb(json: object): Buffer {
  let text = JSON.stringify(json)
  while (text.length % 4) text += ' '
  const body = Buffer.from(text, 'utf8')
  const header = Buffer.alloc(20)
  header.write('glTF', 0, 'latin1')
  header.writeUInt32LE(2, 4)
  header.writeUInt32LE(20 + body.length, 8)
  header.writeUInt32LE(body.length, 12)
  header.write('JSON', 16, 'latin1')
  return Buffer.concat([header, body])
}

describe('Draco decoders', () => {
  it('copies the decoder from the installed three', () => {
    const out = join(tmp(), 'public/draco')
    const files = copyDecoders(here, out)
    expect(files).toHaveLength(3)
    expect(existsSync(join(out, 'draco_decoder.wasm'))).toBe(true)
    expect(existsSync(join(out, 'draco_wasm_wrapper.js'))).toBe(true)
  })

  it('reads extensionsUsed from .glb and .gltf files', () => {
    const dir = tmp()
    writeFileSync(join(dir, 'headset.glb'), glb({ extensionsUsed: ['KHR_draco_mesh_compression'] }))
    writeFileSync(
      join(dir, 'desk.gltf'),
      JSON.stringify({ extensionsUsed: ['EXT_meshopt_compression'] }),
    )
    writeFileSync(join(dir, 'broken.glb'), 'not a model')
    expect(gltfExtensions(join(dir, 'headset.glb'))).toEqual(['KHR_draco_mesh_compression'])
    expect(gltfExtensions(join(dir, 'desk.gltf'))).toEqual(['EXT_meshopt_compression'])
    expect(gltfExtensions(join(dir, 'broken.glb'))).toEqual([])
  })
})

describe('kitr doctor', () => {
  it('warns when a Draco model has no decoder next to it, and stops once it does', async () => {
    const root = tmp()
    mkdirSync(join(root, 'public/models'), { recursive: true })
    writeFileSync(
      join(root, 'public/models/headset.glb'),
      glb({ extensionsUsed: ['KHR_draco_mesh_compression'] }),
    )
    writeFileSync(join(root, 'public/models/desk.glb'), glb({ extensionsUsed: [] }))
    expect(dracoModels(root)).toEqual(['public/models/headset.glb'])
    const project = { root } as never
    expect(await threeD.doctor!(project)).toEqual([
      {
        level: 'warn',
        message:
          'public/models/headset.glb is Draco-compressed but public/draco has no decoder, so useModel() will fail to load it',
        fix: 'kitr 3d:decoders',
      },
    ])
    copyDecoders(here, join(root, 'public/draco'))
    expect(hasDecoders(root)).toBe(true)
    expect(await threeD.doctor!(project)).toEqual([])
  })

  it('says nothing for a project without models', async () => {
    expect(await threeD.doctor!({ root: tmp() } as never)).toEqual([])
  })
})

describe('setup module', () => {
  it('adds three, React Three Fiber and drei, and mounts 3d:decoders', async () => {
    const deps: unknown[] = []
    const ctx = {
      deps: { add: (...d: unknown[]) => deps.push(...d), remove: () => {} },
      agents: { add: () => {}, remove: () => {} },
    }
    threeD.add!(ctx as never)
    expect(deps).toEqual([
      'three',
      '@react-three/fiber',
      '@react-three/drei',
      { name: '@types/three', dev: true },
    ])
    const commands = (await threeD.commands!()) as Record<string, { meta: { name: string } }>
    expect(commands.decoders!.meta.name).toBe('3d:decoders')
    expect(threeD.wraps).toEqual({
      '@react-three/fiber': '@kitr/3d',
      '@react-three/drei': '@kitr/3d/drei',
    })
  })
})
