---
title: Overview
description: Render 3D scenes and models that stay smooth on phones and fall back when WebGL is missing.
order: 0
---

# 3D

## What it is

`@kitr/3d` renders 3D scenes in React. Put a `<Scene>` on the page, add meshes and lights, load models with `useModel()`. It draws only when something changes, pauses off screen, and goes still for people who ask for less motion.

Runs in the browser on every kitr platform. Renders nothing on the server, so pages still prerender.

## Install

```sh
kitr add 3d
```

Adds `@kitr/3d` with three.js, React Three Fiber and drei. No provider, no config file. [Every change](/packages/3d/guide#install).

## Quick start

A turning cube in the brand colour. Give the scene a height:

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

The cube turns in the theme's primary colour. Without WebGL the fallback shows instead. Off screen, drawing stops. Next in the guide: [Show your first scene](/packages/3d/guide#show-your-first-scene).

## Built on

| Library | What it gives you | What kitr adds |
| --- | --- | --- |
| [three.js](https://threejs.org) | Geometry, materials, lights, cameras and the WebGL renderer. | Nothing: it is the engine underneath. |
| [React Three Fiber](https://r3f.docs.pmnd.rs) | A React renderer for three.js: `<mesh>`, `useFrame`, `useThree`, events. | `<Scene>`, a `<Canvas>` with kitr's defaults for SSR, visibility, reduced motion and performance. |
| [drei](https://drei.docs.pmnd.rs) | Controls, loaders, staging and dozens of helpers. | `useModel()`, which loads compressed models with a decoder your app serves itself, and `useThemeColor()`, which hands three.js the colors of your [theme](/packages/theme). |

`kitr 3d:decoders` keeps the Draco and KTX2 decoders in `public/`, so models load with no CDN.

## Problems it solves

- **Scenes that break server rendering.** [Show your first scene](/packages/3d/guide#show-your-first-scene).
- **Devices without WebGL.** [Show a fallback without WebGL](/packages/3d/guide#show-a-fallback-without-webgl).
- **Battery drain from hidden scenes.** [Draw only when something changes](/packages/3d/guide#draw-only-when-something-changes).
- **Dropped frames on phones.** [Keep it smooth on phones](/packages/3d/guide#keep-it-smooth-on-phones).
- **Motion that some visitors cannot tolerate.** [animation](/packages/animation).
- **Models that depend on a third-party CDN.** [Load compressed models offline](/packages/3d/guide#load-compressed-models-offline).
- **Colors that drift from the design system.** [Use theme colours](/packages/3d/guide#use-theme-colours).

For movement of ordinary DOM elements, such as a dialog opening or a list re-sorting, use [animation](/packages/animation) instead; three.js is for scenes with a camera.

## Further reading

- [Guide](/packages/3d/guide).
- [API reference](/packages/3d/api).
- [React Three Fiber docs](https://r3f.docs.pmnd.rs).
- [drei docs](https://drei.docs.pmnd.rs).
- [three.js manual](https://threejs.org/manual/).
- [Animation](/packages/animation) and [Theme](/packages/theme).
