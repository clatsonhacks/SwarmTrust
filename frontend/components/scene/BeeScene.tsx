'use client'

/**
 * BeeScene.tsx
 * ─────────────────────────────────────────────────────────────
 * A flying bee that follows scroll position.
 * The bee flies along a 3D path as the user scrolls down the page.
 */

import { useRef, useEffect, useMemo } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useGLTF, useAnimations, Environment } from '@react-three/drei'
import { SkeletonUtils } from 'three-stdlib'
import * as THREE from 'three'

// Scroll progress store (updated from outside R3F)
let scrollProgress = 0

export function setScrollProgress(value: number) {
  scrollProgress = value
}

function Bee() {
  const groupRef = useRef<THREE.Group>(null!)

  // Load bee model - user needs to add bee.glb to public/models/
  const { scene, animations } = useGLTF('/models/bee.glb')
  const clonedScene = useMemo(() => SkeletonUtils.clone(scene), [scene])
  const { actions } = useAnimations(animations, clonedScene)

  // Log available animations
  useEffect(() => {
    if (animations.length > 0) {
      console.log('[Bee] Available animations:', animations.map(a => a.name))
      // Play the first available animation (flying)
      const firstAction = Object.values(actions)[0]
      if (firstAction) {
        firstAction.reset().play()
      }
    }
  }, [animations, actions])

  // Define the flight path (bezier curve through 3D space)
  const flightPath = useMemo(() => {
    return new THREE.CatmullRomCurve3([
      new THREE.Vector3(-5, 2, 8),    // Start: top-left, close to camera
      new THREE.Vector3(0, 3, 5),     // Rise up, center
      new THREE.Vector3(4, 1.5, 3),   // Dip right
      new THREE.Vector3(-2, 4, 0),    // Swing left, higher
      new THREE.Vector3(3, 2, -3),    // Move back right
      new THREE.Vector3(0, 5, -8),    // End: center, far back, high
    ])
  }, [])

  useFrame(() => {
    if (!groupRef.current) return

    // Get position along the path based on scroll
    const point = flightPath.getPointAt(scrollProgress)
    const tangent = flightPath.getTangentAt(scrollProgress)

    // Smoothly interpolate position
    groupRef.current.position.lerp(point, 0.1)

    // Make the bee face the direction of movement
    const lookAt = point.clone().add(tangent)
    groupRef.current.lookAt(lookAt)

    // Add a slight bobbing motion
    const time = Date.now() * 0.003
    groupRef.current.position.y += Math.sin(time) * 0.05

    // Slight wing tilt based on movement
    groupRef.current.rotation.z = Math.sin(time * 2) * 0.1
  })

  return (
    <group ref={groupRef} scale={0.5}>
      <primitive object={clonedScene} />
    </group>
  )
}

function Scene() {
  const { camera } = useThree()

  useEffect(() => {
    camera.position.set(0, 2, 10)
    camera.lookAt(0, 2, 0)
  }, [camera])

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 10, 5]} intensity={1.2} />
      <pointLight position={[-5, 5, 5]} intensity={0.5} color="#c5ff2b" />

      <Bee />

      <Environment preset="sunset" />
    </>
  )
}

export default function BeeScene() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleScroll = () => {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight
      const progress = Math.min(1, Math.max(0, window.scrollY / scrollHeight))
      setScrollProgress(progress)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll() // Initial call

    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div ref={containerRef} className="bee-scene-wrap">
      <Canvas
        camera={{ fov: 45, near: 0.1, far: 100 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'transparent' }}
      >
        <Scene />
      </Canvas>
    </div>
  )
}

// Preload the model
useGLTF.preload('/models/bee.glb')
