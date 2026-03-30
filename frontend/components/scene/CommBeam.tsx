'use client'

import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Line } from '@react-three/drei'

interface CommBeamProps {
  from: [number, number, number]
  to: [number, number, number]
  color: string
}

export default function CommBeam({ from, to, color }: CommBeamProps) {
  const materialRef = useRef<THREE.LineBasicMaterial>(null!)

  const points = useMemo(() => [
    [from[0], from[1] + 1, from[2]],
    [to[0], to[1] + 1, to[2]]
  ] as [number, number, number][], [from, to])

  useFrame(({ clock }) => {
    if (!materialRef.current) return

    const t = clock.getElapsedTime()
    // Pulsing opacity
    materialRef.current.opacity = 0.5 + Math.sin(t * 4) * 0.3
  })

  return (
    <Line
      points={points}
      color={color}
      lineWidth={3}
      transparent
      opacity={0.7}
    >
      <lineBasicMaterial ref={materialRef} attach="material" />
    </Line>
  )
}
