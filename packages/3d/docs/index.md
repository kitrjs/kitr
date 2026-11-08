---
title: 3D
description: Render 3D scenes and models that stay smooth on phones and fall back when WebGL is missing.
order: 1
---

# 3D

Product viewers, configurators and hero scenes should behave like the rest of the page. `@kitr/3d` renders nothing during server rendering, shows a fallback without WebGL, stops drawing off screen, holds still for reduced motion and lowers the resolution when a phone slows down.

> [!SUMMARY]
> Render 3D scenes and models that stay smooth on phones and fall back when WebGL is missing. Add it with `kitr add 3d`; the overview is at [/packages/3d](/packages/3d).

It is [React Three Fiber](https://r3f.docs.pmnd.rs) and [drei](https://drei.docs.pmnd.rs), re-exported unchanged, on top of [three.js](https://threejs.org). kitr adds four things:

- `<Scene>`, a `<Canvas>` with the behaviour above.
- `useModel()`, which loads compressed models with a decoder your app serves itself.
- `useThemeColor()`, which hands three.js the colours of your theme.
- `kitr 3d:decoders`, with a `kitr doctor` check, to keep that decoder in place.

It runs in the browser, inside React, on every kitr platform. For ordinary DOM movement, use [animation](/packages/animation).

The examples build the order page of Acme's store at `app.acme.com/orders/1042`: Grace ordered the Acme headset and turns it around in 3D before it ships.

## Install

```sh
kitr add 3d
```

<details>
<summary>Everything kitr add changes</summary>

What `kitr add` does:

- Adds `@kitr/3d`, `three`, `@react-three/fiber` and `@react-three/drei` to `dependencies`, and `@types/three` to `devDependencies`, then installs them. Pass `--no-install` to skip the install.
- Adds `'@kitr/3d'` to `packages` in `kitrrc.ts`. It registers no provider.
- Adds a `## kitr: 3d` section to `AGENTS.md`: wrap every scene in `<Scene>` rather than a bare `<Canvas>`, import from `@kitr/3d` and `@kitr/3d/drei`, keep models in `public/models/` and load them with `useModel()`, take colours from the theme with `useThemeColor()`, and run `kitr 3d:decoders` for Draco-compressed models.

It writes no config file and asks no questions. It adds the [react](/packages/react) package first when the project has none, and refuses in a server-only project.

`kitr remove 3d` takes `'@kitr/3d'` out of `kitrrc.ts`, removes the four dependencies and the `AGENTS.md` section, then lists files that still import `@kitr/3d`. It leaves `public/draco/` and your models in place.

</details>

`kitr doctor` flags imports from `@react-three/fiber` and `@react-three/drei`; use `@kitr/3d` and `@kitr/3d/drei`. Import `three` itself directly: `import { Color } from 'three'`.

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

Every other prop goes to React Three Fiber's [`<Canvas>`](https://r3f.docs.pmnd.rs/api/canvas): `camera`, `shadows`, `gl`, `scene`, `orthographic`, `flat`, `linear`, `events` and `onCreated`.

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

The server sends an empty 320-pixel box. In the browser it becomes a canvas with a cube turning in the theme's primary colour, or `/images/cube.png` where WebGL is missing. Scroll it out of view and `<div data-kitr-scene>` around the canvas reads `never`; scroll back and it reads `always`.

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

Grace can drag to turn the headset and pinch or scroll to zoom. `useModel()` caches by URL, so two viewers download the file once. `model.nodes` and `model.materials` hold every named mesh and material.

If the file is missing or broken, `<Scene>` shows `fallback` and passes the error to `onError`; the rest of the page keeps working. To download early, for example when Grace hovers the link to her order, call `useModel.preload('/models/headset.glb')`.

## Load compressed models offline

Draco-compressed models, such as the output of `gltfjsx --transform`, need a decoder at run time. drei fetches it from a CDN, which fails offline, under a strict Content Security Policy and on networks that block the CDN. `useModel()` loads it from your app at `/draco/` instead. Copy it there once:

```sh
kitr 3d:decoders
```

That copies the three decoder files from the installed `three` into `public/draco/`. Commit them, and run the command again after upgrading `three`.

`kitr doctor` reads every `.glb` and `.gltf` under `public/` and warns when one uses Draco and `public/draco/` has no decoder:

```text
⚠ public/models/headset.glb is Draco-compressed but public/draco has no decoder, so useModel() will fail to load it
    fix: kitr 3d:decoders
```

<details>
<summary>Other decoder locations and Meshopt</summary>

To keep the decoder somewhere else, pass its folder: `useModel(url, { draco: '/static/draco/' })`. For a model with no Draco compression, skip the decoder with `{ draco: false }`. Meshopt compression needs no files; `useModel()` enables it by default.

</details>

## Show a fallback without WebGL

Older browsers, locked-down machines, blocklisted GPUs and headless test browsers cannot draw WebGL. `<Scene>` checks once, after mounting, and shows `fallback` instead of a broken canvas:

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

The same `fallback` shows when the scene throws. To branch on WebGL outside a scene, for example to hide a "View in 3D" button, call `isWebGLAvailable()` in an effect or event handler; it returns `false` on the server.

## Use theme colours

kitr's theme defines colours in `oklch()`, which three.js cannot parse. `useThemeColor()` reads a CSS variable, lets the browser convert it to `#rrggbb`, and reads it again when the theme changes:

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

When Grace switches to dark mode, the stand recolours without reloading the scene. The second argument is the colour for the server and for an unset variable. Any CSS variable works, including your own. To convert once, outside React, call `toHexColor('oklch(55% 0.2 262)')`.

## Animate with useFrame

`useFrame` runs on every frame with the time since the last one. Scale by `delta` so speed is the same at any frame rate:

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

> [!WARNING]
> Change objects through the ref. Calling `setState` inside `useFrame` re-renders the React tree 60 times a second.

For animations stored in the model file, use drei's `useAnimations(model.animations, ref)`, then `actions['Unfold']?.play()`.

## Respect reduced motion

With `reducedMotion="user"`, visitors who ask for less motion get a still scene. `<Scene>` switches to `'demand'`, so `useFrame` animations stop while dragging and state changes still redraw. Your scene does not check the setting.

When movement is the point, such as a product turn on a button press, keep it gentle with `usePrefersReducedMotion()`:

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

Use `reducedMotion="never"` only where motion carries meaning, such as a live chart in 3D.

## Draw only when something changes

A scene that only moves when dragged doesn't need 60 frames a second. `frameloop="demand"` draws once, then only when something changes, which saves battery:

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

`<Scene>` caps the pixel ratio at 2. With `adaptive`, it steps the ratio down towards 1 when frames drop and back up when they recover, so the picture softens instead of stuttering.

Set the range with `dpr`. A hero scene that favours frame rate:

```tsx
<Scene dpr={[0.75, 1.5]} className="h-[60vh]">
  {/* ... */}
</Scene>
```

A fixed `dpr={1}` turns adaptation off. Keep models light: compress with `npx gltfjsx model.glb --transform`, and prefer one baked lighting texture over many real-time lights. When Grace switches apps, the scene stops drawing and resumes when she returns.

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

`event.stopPropagation()` stops the click reaching meshes behind. Touch works the same way. Put page text and buttons in plain DOM next to `<Scene>`, so screen readers and keyboard users reach them.

## Lighting without a network

drei's `<Environment preset="city" />` downloads its lighting file from a CDN. For offline or strict-CSP builds, put the `.hdr` file in `public/` and point to it:

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

## Testing

[`@react-three/test-renderer`](https://r3f.docs.pmnd.rs/api/testing) renders React Three Fiber without a GPU and steps frames by hand. Add it once:

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

`<Scene>` needs a real browser to draw. In Vitest with happy-dom there is no WebGL, so a page with a scene renders its `fallback`, which you can assert on:

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

In Playwright against `kitr dev`, wait for `[data-kitr-scene="always"]` before a screenshot, and use `frameloop="demand"` so frames stop changing.

## Next steps

- [API reference](/packages/3d/api): every export of `@kitr/3d`.
- [drei](https://drei.docs.pmnd.rs): controls, loaders and helpers, imported from `@kitr/3d/drei`.
- [Theme](/packages/theme): the colour tokens `useThemeColor()` reads.
