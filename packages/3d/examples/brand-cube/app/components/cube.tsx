import { useFrame, useThemeColor } from '@kitr/3d'
import { useRef } from 'react'
import type { Mesh } from 'three'

/** A cube in the theme's blue, turning `speed` radians a second. */
export function Cube({ speed }: { speed: number }) {
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
