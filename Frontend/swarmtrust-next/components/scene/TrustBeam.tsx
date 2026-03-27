'use client'

/**
 * TrustBeam.tsx
 * ─────────────────────────────────────────────────────────────
 * Renders an arc from agent A to agent B — the visual for x402 payments.
 *
 * How it works:
 *   1. Compute a quadratic bezier (3 control points) in 3D space
 *   2. Sample N points along the curve → THREE.BufferGeometry
 *   3. A small sphere "dot" travels along the arc
 *   4. The line and dot fade out as `progress` approaches 1
 */

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface TrustBeamProps {
  from:     [number, number, number]
  to:       [number, number, number]
  progress: number   // 0 → 1 (driven by store)
  color?:   string
}

export default function TrustBeam({
  from, to, progress, color = '#5cc8ff',
}: TrustBeamProps) {
  const lineRef = useRef<THREE.Line>(null!)
  const dotRef  = useRef<THREE.Mesh>(null!)

  // Build the arc points once (positions don't change mid-flight)
  const { points, geo } = useMemo(() => {
    const STEPS  = 32
    const A      = new THREE.Vector3(...from)
    const B      = new THREE.Vector3(...to)
    const mid    = A.clone().lerp(B, 0.5)
    mid.y       += 4.5   // arc height

    const curve  = new THREE.QuadraticBezierCurve3(A, mid, B)
    const pts    = curve.getPoints(STEPS)
    const geo    = new THREE.BufferGeometry().setFromPoints(pts)
    return { points: pts, geo }
  }, [from[0], from[1], from[2], to[0], to[1], to[2]])

  // Every frame: move dot + fade out
  useFrame(() => {
    const t = Math.min(progress, 1)
    const idx = Math.min(Math.floor(t * (points.length - 1)), points.length - 1)
    if (dotRef.current) {
      dotRef.current.position.copy(points[idx])
    }
    const opacity = 1 - Math.pow(t, 2)
    if (lineRef.current) {
      ;(lineRef.current.material as THREE.LineBasicMaterial).opacity = opacity * 0.7
    }
    if (dotRef.current) {
      ;(dotRef.current.material as THREE.MeshBasicMaterial).opacity = opacity
    }
  })

  return (
    <group>
      {/* Arc line */}
      <primitive object={new THREE.Line(
        geo,
        new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.7 })
      )} ref={lineRef} />

      {/* Travelling dot */}
      <mesh ref={dotRef} position={from}>
        <sphereGeometry args={[0.16, 8, 8]} />
        <meshBasicMaterial color={color} transparent opacity={1} />
      </mesh>
    </group>
  )
}
