---
title: API
description: Every export of kitr/3d, with its signature.
order: 2
---

# API

Every export of `kitr/3d`, `kitr/3d/drei`, read from the published type definitions. The [guide](/packages/3d) shows them in use.

## kitr/3d

Re-exports `@react-three/fiber` unchanged, plus the following.

### isWebGLAvailable

```ts
function isWebGLAvailable(): boolean;
```

Can this browser draw WebGL? False on the server, in old or locked-down browsers, on machines
with blocklisted GPU drivers and in test DOMs. Checked once, then cached.

### resetWebGLCheck

```ts
function resetWebGLCheck(): void;
```

Forget the cached answer of `isWebGLAvailable()`. For tests that stub `getContext`.

### Scene

```ts
function Scene({ children, fallback, loading, frameloop, pauseWhenHidden, reducedMotion, dpr, adaptive, onError, className, style, ...canvas }: SceneProps): import("react").JSX.Element;
```

A React Three Fiber `<Canvas>` that behaves well on a real page: it renders only in the
browser (nothing during SSR), shows `fallback` when WebGL is missing or the scene throws,
stops drawing while off screen or in the background, keeps still for visitors who ask for
less motion, and trades resolution for frame rate on slow devices.

### toHexColor

```ts
function toHexColor(value: string): string;
```

Turn any CSS colour (`oklch(55% 0.2 262)`, `color-mix(...)`, a named colour) into the `#rrggbb`
three.js understands, by letting the browser paint it. Returns the input when there is no
canvas to paint on.

### useModel

```ts
function useModel(url: string, options?: UseModelOptions): Model;
```

Load a `.glb` or `.gltf` model, suspending until it is ready: drei's `useGLTF` with the Draco
decoder served by the app instead of a CDN. Cached by URL, so two components showing the same
model download it once.

### usePrefersReducedMotion

```ts
function usePrefersReducedMotion(): boolean;
```

Has the visitor asked the operating system for less motion? Updates when they change it.

### useThemeColor

```ts
function useThemeColor(variable: `--${string}`, fallback?: string): string;
```

The value of a CSS colour variable, ready for a three.js material: `useThemeColor('--kitr-color-primary')`.
Re-reads when the theme changes (a `data-theme`, `class` or `style` change on `<html>`, or the
system colour scheme), so a scene follows dark mode with the rest of the page. Returns
`fallback` on the server and when the variable is not set.

### DEFAULT_DECODER_PATH

```ts
const DEFAULT_DECODER_PATH = "/draco/";
```

Where `kitr 3d:decoders` puts the Draco decoder, served by the app itself.

### Model

```ts
interface Model extends ObjectMap {
  /** The default scene, ready for `<primitive object={model.scene} />`. */
  scene: Group;
  /** Every scene in the file. */
  scenes: Group[];
  /** Animation clips, for drei's `useAnimations(model.animations, ref)`. */
  animations: AnimationClip[];
  /** Cameras defined in the file. */
  cameras: Camera[];
  /** The file's `asset` block: generator, version, copyright. */
  asset: {
    generator?: string;
    version?: string;
    copyright?: string;
  };
  /** Custom data the exporter stored on the file. */
  userData: Record<string, unknown>;
}
```

A loaded glTF: the scene graph, its animations and cameras, plus its `nodes` and `materials` by name.

### SceneProps

```ts
interface SceneProps extends Omit<CanvasProps, 'frameloop' | 'fallback' | 'dpr' | 'children'> {
  children?: ReactNode;
  /**
   * Shown instead of the scene when it cannot run: no WebGL, or an error while loading or
   * drawing (a missing model, a lost GPU). An image of the scene is the usual choice. Default: nothing.
   */
  fallback?: ReactNode;
  /** 3D content shown while models and textures load, such as drei's `<Html>` with a spinner. Default: nothing. */
  loading?: ReactNode;
  /** `'always'` draws every frame (default); `'demand'` draws only when something changes. */
  frameloop?: 'always' | 'demand';
  /** Stop drawing while the scene is scrolled out of view or the tab or app is in the background. Default `true`. */
  pauseWhenHidden?: boolean;
  /**
   * With `'user'` (the default), visitors who ask for less motion get a still scene: it draws on
   * demand, so `useFrame` animations stop while controls and state changes still redraw it.
   */
  reducedMotion?: SceneReducedMotion;
  /** Pixel ratio, or the `[min, max]` range it stays within. Default `[1, 2]`. */
  dpr?: number | [
    number,
    number
  ];
  /** Lower the pixel ratio when frames drop and raise it again when they recover. Default `true`. */
  adaptive?: boolean;
  /** Called when the scene fails and the fallback is shown. */
  onError?: (error: Error) => void;
  /** Class of the element around the canvas. The canvas fills it, so size the scene here. */
  className?: string;
  /** Style of the element around the canvas. */
  style?: CSSProperties;
}
```

Props of `<Scene>`: React Three Fiber's `<Canvas>` props, plus how the scene behaves around the page.

### UseModelOptions

```ts
interface UseModelOptions {
  /**
   * Where the Draco decoder files live, or `false` for models that are not Draco-compressed.
   * Default `'/draco/'`, the folder `kitr 3d:decoders` fills, so compressed models load offline,
   * in desktop and mobile builds and under a strict CSP, without Google's CDN.
   */
  draco?: string | false;
  /** Decode Meshopt-compressed models. Default `true`; the decoder is bundled, so it costs no request. */
  meshopt?: boolean;
}
```

Options of `useModel()`.

### SceneReducedMotion

```ts
type SceneReducedMotion = 'user' | 'always' | 'never';
```

How a scene treats the visitor's "reduce motion" setting.

## kitr/3d/drei

Re-exports `@react-three/drei`, `camera-controls` unchanged, plus the following.

<!-- GENERATED by scripts/api-docs.mjs from the type definitions. Do not edit. -->
