---
title: 3D
description: Render 3D scenes and models that stay smooth on phones and fall back when WebGL is missing.
order: 1
---

# 3D

Product viewers, configurators and hero scenes are now ordinary parts of a page. `@kitr/3d` renders them so they behave like the rest of it: nothing during server rendering, a fallback without WebGL, no drawing off screen, a still scene for reduced motion, and a lower resolution when a phone slows down.

It is [React Three Fiber](https://r3f.docs.pmnd.rs) and [drei](https://drei.docs.pmnd.rs), re-exported unchanged, on top of [three.js](https://threejs.org). Meshes, lights, `useFrame`, `useThree` and every drei helper work exactly as their docs show. kitr adds `<Scene>`, a `<Canvas>` with the behaviour above; `useModel()`, which loads compressed models with a decoder your app serves itself instead of a CDN; `useThemeColor()`, which hands three.js the colours of your theme; and `kitr 3d:decoders` with a `kitr doctor` check to keep that decoder in place.

It runs in the browser, inside React, on every kitr platform: web, desktop (Electron and Tauri) and mobile (Capacitor). For movement of ordinary DOM elements, such as a dialog opening or a list re-sorting, use [animation](/packages/animation) instead.

The examples on this page build the order page of Acme's store at `app.acme.com/orders/1042`: Grace ordered the Acme headset, and the page shows it in 3D so she can turn it around before it ships.

## Install

```sh
kitr add 3d
```

What `kitr add` does:

- Adds `@kitr/3d`, `three`, `@react-three/fiber` and `@react-three/drei` to `dependencies`, and `@types/three` to `devDependencies`, then installs them. Pass `--no-install` to skip the install.
- Adds `'@kitr/3d'` to `packages` in `kitrrc.ts`. It registers no provider.
- Adds a `## kitr: 3d` section to `AGENTS.md`: wrap every scene in `<Scene>` rather than a bare `<Canvas>`, import from `@kitr/3d` and `@kitr/3d/drei`, keep models in `public/models/` and load them with `useModel()`, take colours from the theme with `useThemeColor()`, and run `kitr 3d:decoders` for Draco-compressed models.

It writes no config file, adds no env variables or scripts and asks no questions. 3D needs React, so `kitr add` adds the [react](/packages/react) package first when the project has none, and refuses in a server-only project. No kit includes it.

`kitr remove 3d` takes `'@kitr/3d'` out of `kitrrc.ts`, removes the four dependencies and the `AGENTS.md` section, then lists files that still import `@kitr/3d`. It leaves `public/draco/` and your models in place.

`kitr doctor` flags imports from `@react-three/fiber` and `@react-three/drei` and suggests `@kitr/3d` and `@kitr/3d/drei`. `three` itself is imported directly, as `import { Color } from 'three'`, because its examples live under deep paths that no single entry can cover.

## Configure

`@kitr/3d` has no config file. Each scene is configured by the props of `<Scene>`:

```tsx
// app/components/headset-viewer.tsx
import { Scene } from '@kitr/3d'

export function HeadsetViewer() {
  return (
    <Scene
      className="viewer"
      camera={{ position: [0, 0.4, 2.2], fov: 40 }}
      fallback={<img src="/images/headset.jpg" alt="The Acme headset" />}
      frameloop="always"
      pauseWhenHidden
      reducedMotion="user"
      dpr={[1, 2]}
      adaptive
    >
      {/* ... */}
    </Scene>
  )
}
```

| Option | Default | Description |
| --- | --- | --- |
| `fallback` | nothing | Shown instead when there is no WebGL or the scene fails, such as an image of the scene |
| `loading` | nothing | 3D content shown while models and textures load, such as drei's `<Html>` with a message |
| `frameloop` | `'always'` | `'always'` draws every frame; `'demand'` draws only after something changes |
| `pauseWhenHidden` | `true` | Stop drawing while the scene is scrolled out of view, or the tab or app is in the background |
| `reducedMotion` | `'user'` | `'user'` draws on demand for visitors who ask for less motion, which stops `useFrame` animations. `'always'` does that for everyone, `'never'` for nobody |
| `dpr` | `[1, 2]` | The pixel ratio, or the `[min, max]` range it stays within |
| `adaptive` | `true` | Step the pixel ratio down within `dpr` when frames drop, and back up when they recover |
| `onError` | logs to the console | Called with the error when the scene fails and `fallback` is shown |
| `className`, `style` | `width: 100%`, `height: 100%` | Applied to the element around the canvas. The canvas fills it, so size the scene here |

Every other prop goes to React Three Fiber's [`<Canvas>`](https://r3f.docs.pmnd.rs/api/canvas): `camera`, `shadows`, `gl`, `scene`, `orthographic`, `flat`, `linear`, `events` and `onCreated`. There are no env variables.

## Show your first scene

A turning cube in the brand colour, lit from above. Give the scene a height, because a canvas fills its parent and a parent with no height shows nothing:

```tsx
// app/components/brand-cube.tsx
import { Scene, useFrame, useThemeColor } from '@kitr/3d'
import { useRef } from 'react'
import type { Mesh } from 'three'

function Cube() {
  const ref = useRef<Mesh>(null)
  const primary = useThemeColor('--kitr-color-primary')
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.6
  })
  return (
    <mesh ref={ref} rotation={[0.4, 0, 0]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color={primary} />
    </mesh>
  )
}

export function BrandCube() {
  return (
    <Scene style={{ height: 320 }} fallback={<img src="/images/cube.png" alt="The Acme cube" />}>
      <ambientLight intensity={0.6} />
      <directionalLight position={[2, 3, 2]} intensity={1.4} />
      <Cube />
    </Scene>
  )
}
```

Render `<BrandCube />` on any page. The server sends an empty 320-pixel box; in the browser it becomes a canvas with a cube turning at 0.6 radians a second in the theme's primary colour. On a device with no WebGL, the box shows `/images/cube.png` instead. Scroll it out of view and the frame loop stops, and `<div data-kitr-scene>` around the canvas reads `never`; scroll back and it reads `always` again.

## Load a model

Put `.glb` files in `public/models/` and load them with `useModel()`. It suspends while the file downloads, so the scene shows `loading` until it is ready:

```tsx
// app/components/headset-viewer.tsx
import { Scene, useModel } from '@kitr/3d'
import { Center, Html, OrbitControls } from '@kitr/3d/drei'

function Headset() {
  const model = useModel('/models/headset.glb')
  return (
    <Center>
      <primitive object={model.scene} />
    </Center>
  )
}

export function HeadsetViewer() {
  return (
    <Scene
      className="h-96 w-full"
      camera={{ position: [0, 0.4, 2.2], fov: 40 }}
      fallback={<img src="/images/headset.jpg" alt="The Acme headset" />}
      loading={<Html center>Loading the headset</Html>}
    >
      <ambientLight intensity={0.5} />
      <directionalLight position={[3, 4, 2]} intensity={1.2} />
      <Headset />
      <OrbitControls enablePan={false} minDistance={1.4} maxDistance={4} />
    </Scene>
  )
}
```

Grace can drag to turn the headset and pinch or scroll to zoom. `useModel()` caches by URL, so two viewers on the same page download the file once, and `model.nodes` and `model.materials` hold every named mesh and material from the file.

If the file is missing or broken, the error reaches `<Scene>`, which shows `fallback` and passes the error to `onError` (or logs it). The rest of the page keeps working; a bare `<Canvas>` would take the whole route down with it.

To start downloading before the viewer is on screen, for example when Grace hovers the link to her order, call `useModel.preload('/models/headset.glb')`.

## Load compressed models offline

Models exported with Draco compression, such as the output of `gltfjsx --transform`, need a decoder at run time. drei fetches it from Google's CDN by default, which fails in a desktop or mobile build without a network, under a strict Content Security Policy, and on any network that blocks the CDN. `useModel()` loads it from your own app at `/draco/` instead. Copy it there once:

```sh
kitr 3d:decoders
```

That copies `draco_decoder.js`, `draco_decoder.wasm` and `draco_wasm_wrapper.js` from the installed `three` into `public/draco/`. Commit them, and run the command again after upgrading `three`. The web build serves them with the rest of `public/`, and the desktop and mobile builds package them, so compressed models load with no network at all.

`kitr doctor` reads every `.glb` and `.gltf` under `public/` and warns when one uses Draco and `public/draco/` has no decoder:

```text
⚠ public/models/headset.glb is Draco-compressed but public/draco has no decoder, so useModel() will fail to load it
    fix: kitr 3d:decoders
```

To keep the decoder somewhere else, pass its folder: `useModel(url, { draco: '/static/draco/' })`. For a model with no Draco compression you can skip the decoder entirely with `{ draco: false }`. Meshopt compression needs no files; its decoder is bundled and `useModel()` enables it by default.

## Show a fallback without WebGL

Some devices cannot draw WebGL: older browsers, locked-down corporate machines, GPUs on the browser's blocklist, and headless test browsers. `<Scene>` checks once, after mounting, and shows `fallback` instead of an empty or broken canvas:

```tsx
// app/components/order-preview.tsx
import { Scene } from '@kitr/3d'

export function OrderPreview({ order }: { order: { id: string; image: string } }) {
  return (
    <Scene
      className="h-80"
      fallback={<img src={order.image} alt={`Order ${order.id}`} className="h-80 object-contain" />}
      onError={(error) => console.warn(`Order ${order.id} preview failed`, error)}
    >
      {/* ... */}
    </Scene>
  )
}
```

The same `fallback` shows when the scene throws while loading or drawing. To branch on WebGL outside a scene, for example to hide a "View in 3D" button, call `isWebGLAvailable()`. It returns `false` on the server, so call it in an effect or an event handler.

## Use theme colours

three.js materials take a colour string, but kitr's theme defines colours in `oklch()`, which three.js cannot parse. `useThemeColor()` reads a CSS variable, lets the browser convert it to `#rrggbb`, and reads it again whenever the theme changes:

```tsx
// app/components/headset-stand.tsx
import { useThemeColor } from '@kitr/3d'

export function HeadsetStand() {
  const surface = useThemeColor('--kitr-color-muted')
  const accent = useThemeColor('--kitr-color-primary', '#2563eb')
  return (
    <group>
      <mesh position={[0, -0.6, 0]}>
        <cylinderGeometry args={[0.5, 0.6, 0.1, 48]} />
        <meshStandardMaterial color={surface} />
      </mesh>
      <mesh position={[0, -0.54, 0.45]}>
        <boxGeometry args={[0.2, 0.02, 0.05]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.4} />
      </mesh>
    </group>
  )
}
```

When Grace switches to dark mode, `data-theme` on `<html>` changes, the hook re-reads both variables and the stand recolours without reloading the scene. The second argument is the colour to use on the server and when the variable is not set. Any CSS colour works, including variables you define yourself, such as `--acme-headset-trim`. To convert a colour once, outside React, call `toHexColor('oklch(55% 0.2 262)')`.

## Animate with useFrame

`useFrame` runs a function on every frame, with the time since the last one. Scale by `delta` so the speed is the same at 30, 60 and 120 frames a second:

```tsx
// app/components/floating-headset.tsx
import { useFrame, useModel } from '@kitr/3d'
import { useRef } from 'react'
import type { Group } from 'three'

export function FloatingHeadset() {
  const model = useModel('/models/headset.glb')
  const ref = useRef<Group>(null)
  useFrame(({ clock }, delta) => {
    if (!ref.current) return
    ref.current.rotation.y += delta * 0.4
    ref.current.position.y = Math.sin(clock.elapsedTime) * 0.05
  })
  return <primitive ref={ref} object={model.scene} />
}
```

Change the object directly through the ref. Don't call `setState` inside `useFrame`: that re-renders the React tree 60 times a second, where a ref change costs nothing.

For animations stored in the model file, use drei's `useAnimations(model.animations, ref)` from `@kitr/3d/drei`, then `actions['Unfold']?.play()`.

## Respect reduced motion

With `reducedMotion="user"`, visitors who turn on "reduce motion" get a still scene: `<Scene>` switches the frame loop to `'demand'`, so `useFrame` animations stop, while dragging with `OrbitControls` and any state change still redraw it. Nothing in your scene has to check the setting.

When a scene's movement is the point, such as a short product turn that starts on a button press, keep it but make it gentle, and read the same setting with `usePrefersReducedMotion()`:

```tsx
// app/components/turn-button.tsx
import { usePrefersReducedMotion } from '@kitr/3d'

export function TurnButton({ onTurn }: { onTurn: (speed: number) => void }) {
  const reduce = usePrefersReducedMotion()
  return (
    <button type="button" onClick={() => onTurn(reduce ? 0.2 : 1)}>
      Turn the headset
    </button>
  )
}
```

`<Scene reducedMotion="never">` keeps the frame loop running for everyone, for scenes where motion carries meaning, such as a live chart in 3D.

## Draw only when something changes

A scene that only moves when it is dragged, like the headset viewer, doesn't need 60 frames a second. `frameloop="demand"` draws once, then again only when something changes: a prop on a mesh, `OrbitControls` moving the camera, a model finishing its download. That saves battery on laptops and phones:

```tsx
// app/components/still-headset.tsx
import { Scene, useModel } from '@kitr/3d'
import { OrbitControls } from '@kitr/3d/drei'

function Headset() {
  const model = useModel('/models/headset.glb')
  return <primitive object={model.scene} />
}

export function StillHeadset() {
  return (
    <Scene frameloop="demand" className="h-80">
      <ambientLight intensity={0.6} />
      <Headset />
      <OrbitControls />
    </Scene>
  )
}
```

When you change three.js objects yourself, outside React, ask for a frame with `invalidate()` from `useThree()`.

## Keep it smooth on phones

Phones have screens with three times the pixels and a fraction of the GPU of a laptop. `<Scene>` caps the pixel ratio at 2 by default and, with `adaptive`, watches the frame rate through drei's `PerformanceMonitor`: when frames drop it steps the pixel ratio down by quarters towards 1, and when they recover it steps back up. The picture gets slightly softer instead of stuttering.

Set the range with `dpr`. A large hero scene that should favour frame rate:

```tsx
<Scene dpr={[0.75, 1.5]} className="h-[60vh]">
  {/* ... */}
</Scene>
```

A fixed `dpr={1}` turns adaptation off. Beyond resolution, keep models light: compress them with `npx gltfjsx model.glb --transform`, which also resizes textures, and prefer one baked lighting texture over many real-time lights and shadows.

Pausing while hidden matters most on phones, too. When Grace switches apps, the WebView reports the page as hidden and the scene stops drawing; when she comes back, it carries on from where it was.

## Handle clicks and hovers

Meshes take pointer events like DOM elements. Grace picks the headset colour by clicking a swatch on the model:

```tsx
// app/components/colour-swatch.tsx
import { useState } from 'react'

export function ColourSwatch({ colour, onPick }: { colour: string; onPick: (colour: string) => void }) {
  const [hovered, setHovered] = useState(false)
  return (
    <mesh
      scale={hovered ? 1.15 : 1}
      onClick={(event) => {
        event.stopPropagation()
        onPick(colour)
      }}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      <sphereGeometry args={[0.08, 32, 16]} />
      <meshStandardMaterial color={colour} />
    </mesh>
  )
}
```

`event.stopPropagation()` stops the click reaching meshes behind this one. Touch works the same way, so the swatch is tappable in the mobile build. For page text and buttons over the scene, use plain DOM next to `<Scene>` rather than inside it; it stays accessible to screen readers and keyboard users.

## Lighting without a network

drei's `<Environment preset="city" />` downloads its lighting file from a CDN when the scene loads. In a desktop or mobile build, or behind a strict CSP, put the `.hdr` file in `public/` and point to it instead:

```tsx
// app/components/studio-lighting.tsx
import { ContactShadows, Environment } from '@kitr/3d/drei'

export function StudioLighting() {
  return (
    <>
      <Environment files="/hdri/studio.hdr" />
      <ContactShadows position={[0, -0.65, 0]} opacity={0.4} blur={2.5} />
    </>
  )
}
```

Like `useModel()`, this keeps every file the scene needs inside the app, so the order page looks the same online, offline and on every platform.

## Commands

| Command | What it does |
| --- | --- |
| `kitr 3d:decoders` | Copies the Draco decoder from the installed `three` into `public/draco/`. `--out <folder>` copies it elsewhere |

```sh
kitr 3d:decoders --out public/static/draco
```

```text
  wrote public/static/draco/draco_decoder.js
  wrote public/static/draco/draco_decoder.wasm
  wrote public/static/draco/draco_wasm_wrapper.js
Draco decoder copied. useModel() loads it from /draco/.
```

With a custom folder, pass it to `useModel(url, { draco: '/static/draco/' })`.

`kitr doctor` warns when a model under `public/` is Draco-compressed and `public/draco/` has no decoder, and when a file imports `@react-three/fiber` or `@react-three/drei` instead of `@kitr/3d` and `@kitr/3d/drei`.

## Testing

Test what you put inside a scene with [`@react-three/test-renderer`](https://r3f.docs.pmnd.rs/api/testing), which renders React Three Fiber without a GPU and steps frames by hand. Add it once:

```sh
pnpm add -D @react-three/test-renderer
```

Then render a component, advance a few frames and assert on the three.js objects:

```tsx
// app/components/brand-cube.test.tsx
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { useFrame } from '@kitr/3d'
import { useRef } from 'react'
import type { Mesh } from 'three'
import { describe, expect, it } from 'vitest'

function Cube() {
  const ref = useRef<Mesh>(null)
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta
  })
  return (
    <mesh ref={ref}>
      <boxGeometry />
      <meshStandardMaterial color="#2563eb" />
    </mesh>
  )
}

describe('brand cube', () => {
  it('turns one radian a second', async () => {
    const renderer = await ReactThreeTestRenderer.create(<Cube />)
    const cube = renderer.scene.children[0]!

    await ReactThreeTestRenderer.act(async () => renderer.advanceFrames(2, 0.5))

    expect(cube.instance.rotation.y).toBeCloseTo(1)
    expect(cube.allChildren.map((child) => child.type)).toEqual(['BoxGeometry', 'MeshStandardMaterial'])
    await renderer.unmount()
  })
})
```

`<Scene>` itself needs a real browser to draw. In Vitest with happy-dom there is no WebGL, so a page that contains a scene renders its `fallback`, which makes page tests stable and lets you assert on it:

```tsx
// app/pages/order.test.tsx
import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { HeadsetViewer } from '#app/components/headset-viewer'

it('shows the photo where WebGL is missing', async () => {
  render(<HeadsetViewer />)
  expect(await screen.findByAltText('The Acme headset')).toBeTruthy()
})
```

For the real thing, a Playwright test against `kitr dev` runs Chromium with WebGL. Wait for `[data-kitr-scene="always"]` before taking a screenshot, and set `frameloop="demand"` in a test build so frames stop changing.

## Next steps

- [API reference](/packages/3d/api): every export kitr adds to `@kitr/3d`.
- [React Three Fiber](https://r3f.docs.pmnd.rs): the canvas, hooks, events and performance, all imported from `@kitr/3d`.
- [drei](https://drei.docs.pmnd.rs): controls, loaders, staging and helpers, imported from `@kitr/3d/drei`.
- [three.js manual](https://threejs.org/manual/): geometry, materials, lights and cameras.
- [Animation](/packages/animation): DOM and page animation with the same reduced-motion rules.
- [Theme](/packages/theme): the colour tokens `useThemeColor()` reads.
