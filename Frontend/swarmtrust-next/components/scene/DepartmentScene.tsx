'use client'

/**
 * DepartmentScene.tsx
 * ─────────────────────────────────────────────────────────────
 * Per-department 3D scene with:
 *   • Warehouse environment (camera inside)
 *   • Department-specific agent models with proper animations
 *   • Agents working inside the warehouse
 */

import { useRef, useEffect, useMemo, Suspense } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useGLTF, Environment, Html, useAnimations } from '@react-three/drei'
import * as THREE from 'three'
import { SkeletonUtils } from 'three-stdlib'
import { useAgentStore, DEPARTMENT_CONFIGS } from '@/lib/agentStore'
import type { ZoneName, AgentState } from '@/lib/types'
import TrustBeam from './TrustBeam'

// ── Department Agent with proper animations ─────────────────────────
function DepartmentAgent({
  id, name, color, localPosition, state, department, index
}: {
  id: string
  name: string
  color: string
  localPosition: [number, number, number]
  state: AgentState
  department: ZoneName
  index: number
}) {
  const groupRef = useRef<THREE.Group>(null!)
  const ringRef = useRef<THREE.Mesh>(null!)
  const agentColor = useMemo(() => new THREE.Color(color), [color])
  const currentAction = useRef<string | null>(null)

  const config = DEPARTMENT_CONFIGS[department]
  const { scene, animations } = useGLTF(config.agentModel)
  const clonedScene = useMemo(() => SkeletonUtils.clone(scene), [scene])
  const { actions, mixer } = useAnimations(animations, clonedScene)

  // Log available animations on mount
  useEffect(() => {
    const animNames = Object.keys(actions)
    console.log(`[${name}] Available animations:`, animNames)
    console.log(`[${name}] Animation details:`, animations.map(a => ({
      name: a.name,
      duration: a.duration,
      tracks: a.tracks.length
    })))
  }, [actions, animations, name])

  // Play animations based on agent state
  useEffect(() => {
    const animNames = Object.keys(actions)
    if (animNames.length === 0) return

    // Find best animation for current state
    let targetAnim: string | null = null

    const findAnim = (keywords: string[]) => {
      for (const keyword of keywords) {
        const found = animNames.find(n => n.toLowerCase().includes(keyword.toLowerCase()))
        if (found) return found
      }
      return null
    }

    switch (state) {
      case 'MOVING':
        targetAnim = findAnim(['walk', 'run', 'move', 'locomotion', 'forward', 'Walk'])
        break
      case 'EXECUTING':
        targetAnim = findAnim(['jump', 'work', 'action', 'interact', 'small Jump', 'Jump'])
        break
      case 'MEETING':
        targetAnim = findAnim(['jump', 'talk', 'wave', 'small Jump', 'idle'])
        break
      case 'IDLE':
      default:
        targetAnim = findAnim(['idle', 'stand', 'wait', 'Walk', 'walk'])
        break
    }

    // Fallback to first animation if no match
    if (!targetAnim && animNames.length > 0) {
      targetAnim = animNames[0]
    }

    // Play the animation
    if (targetAnim && targetAnim !== currentAction.current) {
      // Fade out current
      if (currentAction.current && actions[currentAction.current]) {
        actions[currentAction.current]?.fadeOut(0.3)
      }
      // Fade in new
      if (actions[targetAnim]) {
        actions[targetAnim]?.reset().fadeIn(0.3).play()
      }
      currentAction.current = targetAnim
    }
  }, [state, actions])

  // Setup shadows
  useEffect(() => {
    clonedScene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true
        child.receiveShadow = true
      }
    })
  }, [clonedScene])

  // Animation for agent movement and effects
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()

    // Rotate agent to face movement direction or center
    if (groupRef.current) {
      const targetRotation = Math.atan2(-localPosition[0], -localPosition[2])
      groupRef.current.rotation.y = THREE.MathUtils.lerp(
        groupRef.current.rotation.y,
        targetRotation,
        0.05
      )
    }

    // Ring pulse when executing
    if (state === 'EXECUTING' && ringRef.current) {
      ringRef.current.scale.setScalar(1 + Math.sin(t * 3) * 0.3)
      ;(ringRef.current.material as THREE.MeshBasicMaterial).opacity = 0.5 + Math.sin(t * 3) * 0.2
    } else if (ringRef.current) {
      ;(ringRef.current.material as THREE.MeshBasicMaterial).opacity = 0
    }
  })

  const statusText =
    state === 'IDLE' ? 'IDLE' :
    state === 'MOVING' ? 'MOVING' :
    state === 'EXECUTING' ? 'EXEC' :
    state === 'MEETING' ? 'SCRUM' :
    state === 'DELEGATING' ? 'DELEGATING' : state

  const statusClass =
    state === 'MOVING' ? 'moving' :
    state === 'EXECUTING' ? 'executing' :
    state === 'MEETING' ? 'meeting' : ''

  return (
    <group ref={groupRef} position={localPosition}>
      <primitive object={clonedScene} scale={0.15} />
      <mesh ref={ringRef} position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.15, 0.25, 32]} />
        <meshBasicMaterial color={agentColor} transparent opacity={0} side={THREE.DoubleSide} />
      </mesh>
      <Html position={[0, 0.6, 0]} center style={{ pointerEvents: 'none' }}>
        <div className="agent-tag">
          <div className="agent-tag-name">{name}</div>
          <div className={`agent-tag-status ${statusClass}`}>{statusText}</div>
        </div>
      </Html>
    </group>
  )
}

// ── Warehouse Environment ─────────────────────────────────────────────
function WarehouseEnvironment({ department }: { department: ZoneName }) {
  const config = DEPARTMENT_CONFIGS[department]
  const { scene } = useGLTF(config.environmentModel)

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

  // Warehouse positioned at ground level, agents work inside
  return (
    <primitive
      object={clonedScene}
      position={[0, 0, 0]}
      scale={2}
      rotation={[0, 0, 0]}
    />
  )
}

// ── Main department scene content ────────────────────────────────────
function DepartmentSceneContent({ department }: { department: ZoneName }) {
  const { camera } = useThree()
  const tick = useAgentStore(s => s.tick)
  const agents = useAgentStore(s => s.agents)
  const beams = useAgentStore(s => s.activeBeams)
  const config = DEPARTMENT_CONFIGS[department]
  const timeRef = useRef(0)

  const deptAgents = useMemo(() =>
    agents.filter(a => config.agentIds.includes(a.id)),
    [agents, config.agentIds]
  )

  // TOP-DOWN camera view looking at workspace
  useEffect(() => {
    camera.position.set(0, 15, 8)
    camera.lookAt(0, 0, 0)
  }, [camera])

  useFrame(({ clock }, delta) => {
    tick(delta)
    timeRef.current = clock.getElapsedTime()

    // Top-down view with slight orbit
    const t = clock.getElapsedTime()
    const orbitRadius = 12
    camera.position.x = Math.sin(t * 0.03) * orbitRadius
    camera.position.z = Math.cos(t * 0.03) * orbitRadius
    camera.position.y = 18  // High up for top-down view
    camera.lookAt(0, 0, 0)
  })

  // Position agents inside the warehouse workspace
  const getLocalPosition = (index: number): [number, number, number] => {
    const total = deptAgents.length
    if (total === 1) return [0, 0, 0]

    // Spread agents in workspace area - small radius to stay inside warehouse
    const angle = (index / total) * Math.PI * 2
    const radius = 1.5
    return [
      Math.cos(angle) * radius,
      0,  // On the ground
      Math.sin(angle) * radius
    ]
  }

  const deptBeams = beams.filter(beam =>
    config.agentIds.includes(beam.from) || config.agentIds.includes(beam.to)
  )

  const beamElements = deptBeams.map(beam => {
    const fromIdx = deptAgents.findIndex(a => a.id === beam.from)
    const toIdx = deptAgents.findIndex(a => a.id === beam.to)
    if (fromIdx === -1 || toIdx === -1) return null
    const fromPos = getLocalPosition(fromIdx)
    const toPos = getLocalPosition(toIdx)
    return (
      <TrustBeam
        key={beam.id}
        from={[fromPos[0], 0.3, fromPos[2]]}
        to={[toPos[0], 0.3, toPos[2]]}
        progress={beam.progress}
        color={config.glow}
      />
    )
  })

  return (
    <>
      <Environment preset="warehouse" />
      <fog attach="fog" args={['#0a0c14', 30, 80]} />

      {/* Lighting for top-down view */}
      <ambientLight intensity={1.5} color="#ffffff" />
      <directionalLight
        position={[10, 25, 10]}
        intensity={2}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-far={60}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
      />
      {/* Accent lights for department color */}
      <pointLight position={[0, 8, 0]} intensity={3} color={config.glow} distance={25} />
      <pointLight position={[-8, 5, -8]} intensity={2} color={config.glow} distance={20} />
      <pointLight position={[8, 5, 8]} intensity={2} color={config.glow} distance={20} />

      {/* Warehouse environment model */}
      <WarehouseEnvironment department={department} />

      {/* Agents working inside */}
      {deptAgents.map((agent, idx) => (
        <DepartmentAgent
          key={agent.id}
          id={agent.id}
          name={agent.name}
          color={agent.color}
          localPosition={getLocalPosition(idx)}
          state={agent.state}
          department={department}
          index={idx}
        />
      ))}

      {beamElements}
    </>
  )
}

// ── Main export ──────────────────────────────────────────────────────
export default function DepartmentScene({ department }: { department: ZoneName }) {
  const setView = useAgentStore(s => s.setView)
  const config = DEPARTMENT_CONFIGS[department]

  return (
    <div className="dept-scene-wrap">
      <div className="dept-scene-header">
        <button className="dept-back-btn" onClick={() => setView('OVERVIEW')}>
          ← Back
        </button>
        <h2 className="dept-scene-title" style={{ color: config.glow }}>
          {config.title}
        </h2>
        <div className="dept-scene-badge" style={{ background: config.glow }}>
          {config.agentIds.length} Agents
        </div>
      </div>

      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{ antialias: true }}
        camera={{ fov: 50, near: 0.1, far: 500, position: [0, 18, 12] }}
      >
        <Suspense fallback={null}>
          <DepartmentSceneContent department={department} />
        </Suspense>
      </Canvas>
    </div>
  )
}

// Preload models
useGLTF.preload('/models/warehouse.glb')
useGLTF.preload('/models/box-02_robot.glb')
useGLTF.preload('/models/monowheel_bot__vgdc.glb')
useGLTF.preload('/models/turret_droid.glb')
useGLTF.preload('/models/nora.glb')
