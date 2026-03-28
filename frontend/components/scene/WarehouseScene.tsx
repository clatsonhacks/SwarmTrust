'use client'

/**
 * WarehouseScene.tsx
 * ─────────────────────────────────────────────────────────────
 * Industrial warehouse simulation with:
 *   • Industry props pack (multiple instances)
 *   • 5 robot agents driven by agentStore
 *   • Trust beams for active payments
 *   • Meeting torus ring
 *   • Atmospheric lighting
 */

import { useRef, useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Stars, useGLTF, Environment } from '@react-three/drei'
import * as THREE from 'three'
import AmongAgent from './AmongAgent'
import TrustBeam  from './TrustBeam'
import { useAgentStore } from '@/lib/agentStore'

// ── Single Industry Prop Instance ─────────────────────────────
function IndustryProp({ position, rotation = 0, scale = 0.02 }: {
  position: [number, number, number]
  rotation?: number
  scale?: number
}) {
  const { scene } = useGLTF('/models/uploads_files_2758299_Industry+Props+Pack.glb')

  const clonedScene = useMemo(() => {
    const clone = scene.clone()
    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true
        child.receiveShadow = true
      }
    })
    return clone
  }, [scene])

  return (
    <primitive
      object={clonedScene}
      position={position}
      scale={scale}
      rotation={[0, rotation, 0]}
    />
  )
}

// ── Multiple props placed around the warehouse ─────────────────
function IndustryProps() {
  const propPlacements: Array<{ pos: [number, number, number], rot: number, scale: number }> = [
    // Props forming warehouse perimeter
    // Back wall
    { pos: [-12, 0, -14], rot: 0, scale: 0.05 },
    { pos: [0, 0, -14], rot: 0.1, scale: 0.06 },
    { pos: [12, 0, -14], rot: -0.1, scale: 0.05 },

    // Left wall
    { pos: [-16, 0, -6], rot: Math.PI / 2, scale: 0.05 },
    { pos: [-16, 0, 6], rot: Math.PI / 2, scale: 0.055 },

    // Right wall
    { pos: [16, 0, -6], rot: -Math.PI / 2, scale: 0.05 },
    { pos: [16, 0, 6], rot: -Math.PI / 2, scale: 0.05 },

    // Front
    { pos: [-10, 0, 14], rot: Math.PI, scale: 0.055 },
    { pos: [10, 0, 14], rot: Math.PI, scale: 0.05 },

    // Interior props (smaller, scattered around)
    { pos: [-6, 0, -4], rot: 0.5, scale: 0.03 },
    { pos: [6, 0, -4], rot: -0.3, scale: 0.025 },
    { pos: [-6, 0, 4], rot: 0.2, scale: 0.028 },
    { pos: [6, 0, 4], rot: -0.4, scale: 0.03 },

    // Corner details
    { pos: [-14, 0, -10], rot: Math.PI / 4, scale: 0.035 },
    { pos: [14, 0, -10], rot: -Math.PI / 4, scale: 0.035 },
    { pos: [-14, 0, 10], rot: Math.PI * 0.75, scale: 0.03 },
    { pos: [14, 0, 10], rot: -Math.PI * 0.75, scale: 0.035 },
  ]

  return (
    <>
      {propPlacements.map((p, i) => (
        <IndustryProp key={i} position={p.pos} rotation={p.rot} scale={p.scale} />
      ))}
    </>
  )
}

// ── Meeting torus (appears during scrum) ──────────────────────
function MeetingRing({ active }: { active: boolean }) {
  const ref = useRef<THREE.Mesh>(null!)
  useFrame(({ clock }) => {
    if (!ref.current) return
    const mat = ref.current.material as THREE.MeshBasicMaterial
    const target = active ? 0.6 : 0
    mat.opacity += (target - mat.opacity) * 0.06
    ref.current.rotation.y = clock.getElapsedTime() * 0.4
  })
  return (
    <mesh ref={ref} position={[0, 0.15, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <torusGeometry args={[3.5, 0.08, 8, 60]} />
      <meshBasicMaterial color="#c5ff2b" transparent opacity={0} />
    </mesh>
  )
}

// ── Atmospheric fog particles ─────────────────────────────────
function DustParticles() {
  const ref = useRef<THREE.Points>(null!)
  const count = 300

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
    const posArray = ref.current.geometry.attributes.position.array as Float32Array
    for (let i = 0; i < count; i++) {
      posArray[i * 3 + 1] += Math.sin(time + i) * 0.001
    }
    ref.current.geometry.attributes.position.needsUpdate = true
  })

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.06}
        color="#c5ff2b"
        transparent
        opacity={0.2}
        sizeAttenuation
      />
    </points>
  )
}

// ── Main scene ────────────────────────────────────────────────
export default function WarehouseScene() {
  const { camera } = useThree()
  const tick         = useAgentStore(s => s.tick)
  const agents       = useAgentStore(s => s.agents)
  const beams        = useAgentStore(s => s.activeBeams)
  const meetingActive = useAgentStore(s => s.meetingActive)
  const endMeeting   = useAgentStore(s => s.endMeeting)
  const addLog       = useAgentStore(s => s.addLog)

  const meetingRef = useRef(false)
  const meetingElapsed = useRef(0)

  useEffect(() => {
    if (meetingActive && !meetingRef.current) {
      meetingRef.current   = true
      meetingElapsed.current = 0
    }
    if (!meetingActive) {
      meetingRef.current = false
    }
  }, [meetingActive])

  useFrame(({ clock }, delta) => {
    tick(delta)

    // Camera orbit - closer and lower for better view
    const t = clock.getElapsedTime()
    camera.position.x = Math.sin(t * 0.03) * 22 + 0
    camera.position.z = Math.cos(t * 0.03) * 22 + 0
    camera.position.y = 14
    camera.lookAt(0, 1, 0)

    if (meetingActive && meetingRef.current) {
      meetingElapsed.current += delta
      if (meetingElapsed.current > 10) {
        agents.forEach((a, i) => {
          setTimeout(() => {
            const msgs = [
              `completed ${Math.floor(Math.random()*4+1)} tasks`,
              `processed ${Math.floor(Math.random()*6+2)} pallets`,
              `delegated ${Math.floor(Math.random()*3+1)} sub-tasks · rep +${Math.floor(Math.random()*3+1)}`,
              `pathfinding nominal · ${Math.floor(Math.random()*15+85)}% trust`,
            ]
            addLog(
              `<b style="color:${a.color}">${a.name}</b> [scrum]: ${msgs[i % msgs.length]}`,
              'meeting'
            )
          }, i * 500)
        })
        endMeeting()
        meetingElapsed.current = 0
      }
    }
  })

  const beamElements = beams.map(beam => {
    const fromAgent = agents.find(a => a.id === beam.from)
    const toAgent   = agents.find(a => a.id === beam.to)
    if (!fromAgent || !toAgent) return null
    return (
      <TrustBeam
        key={beam.id}
        from={[fromAgent.position[0], 1.5, fromAgent.position[2]]}
        to={[toAgent.position[0],     1.5, toAgent.position[2]]}
        progress={beam.progress}
        color="#5cc8ff"
      />
    )
  })

  return (
    <>
      {/* ── ENVIRONMENT & LIGHTING ── */}
      <Environment preset="warehouse" />
      <fog attach="fog" args={['#0a0c14', 25, 60]} />

      <ambientLight intensity={1.2} color="#6b7280" />
      <directionalLight
        position={[15, 30, 15]}
        intensity={2.5}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={1}
        shadow-camera-far={80}
        shadow-camera-left={-35}
        shadow-camera-right={35}
        shadow-camera-top={35}
        shadow-camera-bottom={-35}
      />

      {/* Industrial lighting */}
      <pointLight position={[-12, 8, -8]} intensity={1.5} color="#5cc8ff" distance={30} />
      <pointLight position={[12, 8, -8]} intensity={1.5} color="#c5ff2b" distance={30} />
      <pointLight position={[-12, 8, 8]} intensity={1.2} color="#ff9b2b" distance={30} />
      <pointLight position={[12, 8, 8]} intensity={1.2} color="#cc44ff" distance={30} />
      <pointLight position={[0, 10, 0]} intensity={2} color="#ffffff" distance={25} />

      {/* ── STARS (background) ── */}
      <Stars
        radius={80}
        depth={50}
        count={1500}
        factor={3}
        saturation={0.1}
        fade
        speed={0.2}
      />

      {/* ── WAREHOUSE FLOOR ── */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, -0.01, 0]}>
        <planeGeometry args={[60, 50]} />
        <meshStandardMaterial
          color="#1e2128"
          roughness={0.85}
          metalness={0.15}
        />
      </mesh>

      {/* ── INDUSTRY PROPS (multiple instances around warehouse) ── */}
      <IndustryProps />

      {/* ── DUST PARTICLES ── */}
      <DustParticles />

      {/* ── MEETING RING ── */}
      <MeetingRing active={meetingActive} />

      {/* ── AGENTS ── */}
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

      {/* ── TRUST BEAMS ── */}
      {beamElements}
    </>
  )
}

// Preload the models
useGLTF.preload('/models/uploads_files_2758299_Industry+Props+Pack.glb')
