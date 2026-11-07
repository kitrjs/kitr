import { useGLTF } from '@react-three/drei'
import type { ObjectMap } from '@react-three/fiber'
import type { AnimationClip, Camera, Group } from 'three'

/** Where `kitr 3d:decoders` puts the Draco decoder, served by the app itself. */
export const DEFAULT_DECODER_PATH = '/draco/'

/** Options of `useModel()`. */
export interface UseModelOptions {
  /**
   * Where the Draco decoder files live, or `false` for models that are not Draco-compressed.
   * Default `'/draco/'`, the folder `kitr 3d:decoders` fills, so compressed models load offline,
   * in desktop and mobile builds and under a strict CSP, without Google's CDN.
   */
  draco?: string | false
  /** Decode Meshopt-compressed models. Default `true`; the decoder is bundled, so it costs no request. */
  meshopt?: boolean
}

/** A loaded glTF: the scene graph, its animations and cameras, plus its `nodes` and `materials` by name. */
export interface Model extends ObjectMap {
  /** The default scene, ready for `<primitive object={model.scene} />`. */
  scene: Group
  /** Every scene in the file. */
  scenes: Group[]
  /** Animation clips, for drei's `useAnimations(model.animations, ref)`. */
  animations: AnimationClip[]
  /** Cameras defined in the file. */
  cameras: Camera[]
  /** The file's `asset` block: generator, version, copyright. */
  asset: { generator?: string; version?: string; copyright?: string }
  /** Custom data the exporter stored on the file. */
  userData: Record<string, unknown>
}

/**
 * Load a `.glb` or `.gltf` model, suspending until it is ready: drei's `useGLTF` with the Draco
 * decoder served by the app instead of a CDN. Cached by URL, so two components showing the same
 * model download it once.
 */
export function useModel(url: string, options: UseModelOptions = {}): Model {
  const draco = options.draco ?? DEFAULT_DECODER_PATH
  return useGLTF(url, draco === false ? false : draco, options.meshopt ?? true) as unknown as Model
}

/** Start downloading a model before it is shown, such as on hover over the link to its page. */
useModel.preload = (url: string, options: UseModelOptions = {}): void => {
  const draco = options.draco ?? DEFAULT_DECODER_PATH
  useGLTF.preload(url, draco === false ? false : draco, options.meshopt ?? true)
}

/** Drop a model from the cache, so the next `useModel(url)` downloads it again. */
useModel.clear = (url: string): void => useGLTF.clear(url)
