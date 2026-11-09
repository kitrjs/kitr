import { Scene, useFrame, useThemeColor } from '@kitr/3d'
import { useRef, useState } from 'react'
import type { Mesh } from 'three'

export const meta = {
  title: 'A cube in the theme colour',
  description: 'A spinning cube coloured by a CSS variable. It pauses when scrolled out of view.',
  storage: false,
}

// Tailwind utilities on the kitr tokens, so the example looks the same in any kitr app.
const button =
  'min-h-[38px] cursor-pointer rounded-lg border px-3.5 font-semibold disabled:cursor-default disabled:opacity-50 border-border bg-background text-foreground'

function Cube({ speed }: { speed: number }) {
  const ref = useRef<Mesh>(null)
  const primary = useThemeColor('--blue', '#2d6cf0')
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * speed
  })
  return (
    <mesh ref={ref} rotation={[0.4, 0, 0]}>
      <boxGeometry args={[1.4, 1.4, 1.4]} />
      <meshStandardMaterial color={primary} />
    </mesh>
  )
}

export default function BrandCube() {
  const [speed, setSpeed] = useState(0.6)
  return (
    <div className="flex flex-col gap-3 text-[15px]">
      <div className="flex flex-wrap gap-2">
        <button type="button" className={button} onClick={() => setSpeed(0.6)}>
          Slow
        </button>
        <button type="button" className={button} onClick={() => setSpeed(2.4)}>
          Fast
        </button>
        <button type="button" className={button} onClick={() => setSpeed(0)}>
          Stop
        </button>
      </div>
      <Scene
        style={{ height: 220 }}
        fallback={
          <p className="m-0 text-muted-foreground">
            WebGL is not available here, so the cube stays still.
          </p>
        }
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[2, 3, 2]} intensity={1.4} />
        <Cube speed={speed} />
      </Scene>
    </div>
  )
}
