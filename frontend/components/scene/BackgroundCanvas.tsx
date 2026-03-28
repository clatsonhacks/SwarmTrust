'use client'

/**
 * BackgroundCanvas.tsx
 * ─────────────────────────────────────────────────────────────
 * Lightweight version of the warehouse scene used as a live
 * background on the overview page. No heavy prop models.
 */

import { useRef, useMemo } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Stars, Environment } from '@react-three/drei'
import { Suspense } from 'react'
import * as THREE from 'three'
import AmongAgent from './AmongAgent'
import TrustBeam  from './TrustBeam'
import { useAgentStore } from '@/lib/agentStore'

function DustParticles() {
  const ref = useRef<THREE.Points>(null!)
  const count = 200

  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      pos[i * 3]     = (Math.random() - 0.5) * 50
      pos[i * 3 + 1] = Math.random() * 12
      pos[i * 3 + 2] = (Math.random() - 0.5) * 40
    }
    return pos
  }, [])

  useFrame(({ clock }) => {
    if (!ref.current) return
    const time = clock.getElapsedTime()
    const arr  = ref.current.geometry.attributes.position.array as Float32Array
    for (let i = 0; i < count; i++) {
      arr[i * 3 + 1] += Math.sin(time + i) * 0.001
    }
    ref.current.geometry.attributes.position.needsUpdate = true
  })

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={0.06} color="#c5ff2b" transparent opacity={0.18} sizeAttenuation />
    </points>
  )
}

function BgScene() {
  const { camera } = useThree()
  const tick   = useAgentStore(s => s.tick)
  const agents = useAgentStore(s => s.agents)
  const beams  = useAgentStore(s => s.activeBeams)

  useFrame(({ clock }, delta) => {
    tick(delta)
    const t = clock.getElapsedTime()
    camera.position.x = Math.sin(t * 0.03) * 22
    camera.position.z = Math.cos(t * 0.03) * 22
    camera.position.y = 14
    camera.lookAt(0, 1, 0)
  })

  return (
    <>
      <Environment preset="warehouse" />
      <fog attach="fog" args={['#0a0c14', 25, 60]} />

      <ambientLight intensity={1.2} color="#6b7280" />
      <directionalLight position={[15, 30, 15]} intensity={2.5} castShadow shadow-mapSize={[1024, 1024]} />
      <pointLight position={[-12, 8, -8]} intensity={1.5} color="#5cc8ff" distance={30} />
      <pointLight position={[12,  8, -8]} intensity={1.5} color="#c5ff2b" distance={30} />
      <pointLight position={[-12, 8,  8]} intensity={1.2} color="#ff9b2b" distance={30} />
      <pointLight position={[12,  8,  8]} intensity={1.2} color="#cc44ff" distance={30} />

      <Stars radius={80} depth={50} count={1500} factor={3} saturation={0.1} fade speed={0.2} />

      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, -0.01, 0]}>
        <planeGeometry args={[60, 50]} />
        <meshStandardMaterial color="#1e2128" roughness={0.85} metalness={0.15} />
      </mesh>

      <DustParticles />

      {agents.map(agent => (
        <AmongAgent
          key={agent.id}
          id={agent.id}
          name={agent.name}
          color={agent.color}
          position={agent.position}
          state={agent.state}
          task={agent.task}
          phase={agent.phase}
        />
      ))}

      {beams.map(beam => {
        const from = agents.find(a => a.id === beam.from)
        const to   = agents.find(a => a.id === beam.to)
        if (!from || !to) return null
        return (
          <TrustBeam
            key={beam.id}
            from={[from.position[0], 1.5, from.position[2]]}
            to={[to.position[0],     1.5, to.position[2]]}
            progress={beam.progress}
            color="#5cc8ff"
          />
        )
      })}
    </>
  )
}

export default function BackgroundCanvas() {
  return (
    <Canvas
      dpr={[1, 1.5]}
      shadows
      camera={{ position: [28, 28, 28], fov: 42 }}
      gl={{ antialias: true, alpha: false }}
      style={{ background: '#070810' }}
    >
      <Suspense fallback={null}>
        <BgScene />
      </Suspense>
    </Canvas>
  )
}
