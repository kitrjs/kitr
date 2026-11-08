---
title: Overview
description: Render 3D scenes and models that stay smooth on phones and fall back when WebGL is missing.
order: 0
---

# 3D

A product page that lets a customer turn the item around, a configurator that recolours it, a hero scene on the landing page: 3D has become an ordinary part of web and app interfaces. The hard part is not drawing the scene. It is making the scene behave like the rest of the page: rendering nothing on the server, showing something useful when the device has no WebGL, not burning battery while the tab is hidden, and staying smooth on a mid-range phone.

`@kitr/3d` is that behavior, wrapped around the libraries most React teams already use for 3D.

## What it is

`@kitr/3d` is a React component library for 3D scenes. You put a `<Scene>` on the page, add meshes, lights and controls inside it, and load models with `useModel()`. The scene draws only when something changes, pauses when it is off screen or the app is in the background, lowers its resolution when a phone starts dropping frames, and shows a still frame for visitors who ask their operating system for less motion.

It runs in the browser, inside React, on every kitr platform: web, desktop (Electron and Tauri) and mobile (Capacitor). It renders nothing during server rendering, so pages that use it still prerender and hydrate cleanly.

## Install

```sh
kitr add 3d
```

This installs `@kitr/3d` with three.js, React Three Fiber and drei, adds it to `packages` in `kitrrc.ts` and adds a note for coding agents to `AGENTS.md`. There is no provider and no config file. The guide's [Install](/packages/3d/guide#install) section lists every change.

## Quick start

A turning cube in the brand colour. Give the scene a height, because a canvas fills its parent:

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

Render `<BrandCube />` on any page. The server sends an empty 320-pixel box; in the browser it becomes a canvas with a cube turning in the theme's primary colour. Without WebGL the box shows the fallback image, and when the scene scrolls out of view the frame loop stops. The guide continues from here: [Show your first scene](/packages/3d/guide#show-your-first-scene).

## Built on

`@kitr/3d` re-exports [React Three Fiber](https://r3f.docs.pmnd.rs) and [drei](https://drei.docs.pmnd.rs) unchanged, on top of [three.js](https://threejs.org). Everything those libraries document works exactly as written, imported from `@kitr/3d` and `@kitr/3d/drei`.

| Library | What it gives you | What kitr adds |
| --- | --- | --- |
| [three.js](https://threejs.org) | Geometry, materials, lights, cameras and the WebGL renderer. | Nothing: it is the engine underneath. |
| [React Three Fiber](https://r3f.docs.pmnd.rs) | A React renderer for three.js: `<mesh>`, `useFrame`, `useThree`, events. | `<Scene>`, a `<Canvas>` with kitr's defaults for SSR, visibility, reduced motion and performance. |
| [drei](https://drei.docs.pmnd.rs) | Controls, loaders, staging and dozens of helpers. | `useModel()`, which loads compressed models with a decoder your app serves itself, and `useThemeColor()`, which hands three.js the colors of your [theme](/packages/theme). |

The `kitr 3d:decoders` command and a `kitr doctor` check keep the Draco and KTX2 decoders in your `public/` folder, so models load with no CDN and no network.

## Problems it solves

- **Scenes that break server rendering.** `<Scene>` renders nothing on the server and mounts on the client, so prerendered and server-rendered pages keep working. See [Show your first scene](/packages/3d/guide#show-your-first-scene).
- **Devices without WebGL.** Older browsers, locked-down corporate machines and some WebViews have no WebGL. `<Scene>` shows the fallback you give it instead of a blank box. See [Show a fallback without WebGL](/packages/3d/guide#show-a-fallback-without-webgl).
- **Battery drain from hidden scenes.** The scene stops drawing when it scrolls off screen or the app goes to the background, and draws on demand instead of every frame. See [Draw only when something changes](/packages/3d/guide#draw-only-when-something-changes).
- **Dropped frames on phones.** When the frame rate falls, the scene lowers its pixel ratio and recovers when it can. See [Keep it smooth on phones](/packages/3d/guide#keep-it-smooth-on-phones).
- **Motion that some visitors cannot tolerate.** Visitors with reduced motion set get a still scene, with the same rules [animation](/packages/animation) follows. See [Respect reduced motion](/packages/3d/guide#respect-reduced-motion).
- **Models that depend on a third-party CDN.** Compressed models need a decoder, and the default is to fetch it from Google's CDN. `kitr 3d:decoders` copies it into your app. See [Load compressed models offline](/packages/3d/guide#load-compressed-models-offline).
- **Colors that drift from the design system.** `useThemeColor()` reads your theme tokens, so a product in dark mode is lit with the same palette as the page. See [Use theme colours](/packages/3d/guide#use-theme-colours).

For movement of ordinary DOM elements, such as a dialog opening or a list re-sorting, use [animation](/packages/animation) instead; three.js is for scenes with a camera.

## Further reading

- [Guide](/packages/3d/guide): install, configure and every task, from the first scene to lighting without a network.
- [API reference](/packages/3d/api): every export kitr adds to `@kitr/3d`.
- [React Three Fiber docs](https://r3f.docs.pmnd.rs): the canvas, hooks, events and performance guide.
- [drei docs](https://drei.docs.pmnd.rs): controls, loaders, staging and helpers.
- [three.js manual](https://threejs.org/manual/): geometry, materials, lights and cameras.
- [Animation](/packages/animation) and [Theme](/packages/theme): the packages it shares rules and colors with.
