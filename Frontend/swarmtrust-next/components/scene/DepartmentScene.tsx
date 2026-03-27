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
import { useGLTF, Environment, Html, useAnimations, OrbitControls } from '@react-three/drei'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
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

  // Clone and compute foot offset so the model's bottom sits exactly at y=0
  const [clonedScene, agentFloorOffset] = useMemo(() => {
    const clone = SkeletonUtils.clone(scene)
    const box = new THREE.Box3().setFromObject(clone)
    return [clone, -box.min.y]
  }, [scene])

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
      {/* agentFloorOffset aligns the model's feet to y=0 of this group */}
      <primitive object={clonedScene} scale={0.3} position={[0, agentFloorOffset * 0.3, 0]} />
      <mesh ref={ringRef} position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.2, 0.35, 32]} />
        <meshBasicMaterial color={agentColor} transparent opacity={0} side={THREE.DoubleSide} />
      </mesh>
      <Html position={[0, 1.2, 0]} center style={{ pointerEvents: 'none' }}>
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

  // Compute bounding box so the model's floor lands exactly at world y=0,
  // and make roof/upper meshes transparent so agents are visible from above.
  const [clonedScene, floorOffset] = useMemo(() => {
    const clone = scene.clone()

    const box = new THREE.Box3().setFromObject(clone)
    const buildingHeight = box.max.y - box.min.y
    // Anything in the top 35% of the building is treated as roof
    const roofThreshold = box.min.y + buildingHeight * 0.65

    clone.traverse((child) => {
      const mesh = child as THREE.Mesh
      if (!mesh.isMesh) return
      mesh.castShadow = true
      mesh.receiveShadow = true

      // Check where this mesh sits vertically
      const meshBox = new THREE.Box3().setFromObject(mesh)
      if (meshBox.min.y > roofThreshold) {
        // Clone the material so we don't mutate the shared original
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
        mesh.material = mats.map(m => {
          const cloned = (m as THREE.Material).clone() as THREE.MeshStandardMaterial
          cloned.transparent = true
          cloned.opacity = 0.15
          cloned.depthWrite = false
          return cloned
        })
        if (!Array.isArray(mesh.material)) mesh.material = mesh.material
      }
    })

    return [clone, -box.min.y]
  }, [scene])

  // Wrap in a group so scale doesn't fight with the position offset
  return (
    <group scale={2}>
      <primitive
        object={clonedScene}
        position={[0, floorOffset, 0]}
        rotation={[0, 0, 0]}
      />
    </group>
  )
}

// ── Main department scene content ────────────────────────────────────
function DepartmentSceneContent({
  department,
  resetRef,
}: {
  department: ZoneName
  resetRef: React.MutableRefObject<(() => void) | null>
}) {
  const { camera } = useThree()
  const controlsRef = useRef<OrbitControlsImpl>(null!)
  const tick   = useAgentStore(s => s.tick)
  const agents = useAgentStore(s => s.agents)
  const beams  = useAgentStore(s => s.activeBeams)
  const config = DEPARTMENT_CONFIGS[department]

  // Load the warehouse model here too so we can read its actual dimensions
  const { scene: warehouseScene } = useGLTF(config.environmentModel)

  // Compute warehouse world-space bounds (scale=2 applied in WarehouseEnvironment)
  const warehouseBounds = useMemo(() => {
    const box = new THREE.Box3().setFromObject(warehouseScene)
    const center = new THREE.Vector3()
    const size   = new THREE.Vector3()
    box.getCenter(center)
    box.getSize(size)
    // WarehouseEnvironment wraps in <group scale={2}> and offsets by floorOffset
    // so the floor is at world y=0. Scale all X/Z by 2 to get world coords.
    return {
      cx: center.x * 2,
      cz: center.z * 2,
      // interior safe radius: use the smaller of width/depth, pull back from walls
      spread: Math.min(size.x, size.z) * 2 * 0.18,
      // camera orbit radius and height relative to building size
      camR: Math.max(size.x, size.z) * 2 * 0.55,
      camH: size.y * 2 * 0.65,
    }
  }, [warehouseScene])

  const deptAgents = useMemo(() =>
    agents.filter(a => config.agentIds.includes(a.id)),
    [agents, config.agentIds]
  )

  // Agents spread inside the actual warehouse footprint
  const getLocalPosition = (index: number): [number, number, number] => {
    const { cx, cz, spread } = warehouseBounds
    const total = deptAgents.length
    if (total === 1) return [cx, 0, cz]
    const angle = (index / total) * Math.PI * 2
    return [
      cx + Math.cos(angle) * spread,
      0,
      cz + Math.sin(angle) * spread,
    ]
  }

  // Set initial camera position and wire up the reset callback
  useEffect(() => {
    const { cx, cz, camR, camH } = warehouseBounds
    camera.position.set(cx + camR * 0.7, camH, cz + camR * 0.7)
    camera.lookAt(cx, 0, cz)

    // Wait one frame for OrbitControls to pick up the new position, then save state
    setTimeout(() => {
      controlsRef.current?.saveState()
      // Expose reset to the outer button
      resetRef.current = () => controlsRef.current?.reset()
    }, 100)
  }, [camera, warehouseBounds, resetRef])

  useFrame((_, delta) => {
    tick(delta)
  })

  const deptBeams = beams.filter(b =>
    config.agentIds.includes(b.from) || config.agentIds.includes(b.to)
  )

  const beamElements = deptBeams.map(beam => {
    const fromIdx = deptAgents.findIndex(a => a.id === beam.from)
    const toIdx   = deptAgents.findIndex(a => a.id === beam.to)
    if (fromIdx === -1 || toIdx === -1) return null
    const fp = getLocalPosition(fromIdx)
    const tp = getLocalPosition(toIdx)
    return (
      <TrustBeam
        key={beam.id}
        from={[fp[0], 0.5, fp[2]]}
        to={[tp[0], 0.5, tp[2]]}
        progress={beam.progress}
        color={config.glow}
      />
    )
  })

  return (
    <>
      <Environment preset="warehouse" />
      <fog attach="fog" args={['#0a0c14', 40, 100]} />

      <ambientLight intensity={2} color="#ffffff" />
      <directionalLight
        position={[10, 25, 10]}
        intensity={2.5}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-far={80}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
      />
      <pointLight position={[warehouseBounds.cx, 6, warehouseBounds.cz]} intensity={4} color={config.glow} distance={30} />
      <pointLight position={[warehouseBounds.cx - 6, 4, warehouseBounds.cz - 6]} intensity={2} color={config.glow} distance={20} />
      <pointLight position={[warehouseBounds.cx + 6, 4, warehouseBounds.cz + 6]} intensity={2} color={config.glow} distance={20} />

      <OrbitControls
        ref={controlsRef}
        makeDefault
        target={[warehouseBounds.cx, 0, warehouseBounds.cz]}
        enablePan
        enableZoom
        enableRotate
        rotateSpeed={0.35}
        zoomSpeed={0.5}
        panSpeed={0.5}
        minDistance={2}
        maxDistance={warehouseBounds.camR * 1.8}
        minPolarAngle={0.05}
        maxPolarAngle={Math.PI * 0.80}
      />

      <WarehouseEnvironment department={department} />

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
  const setView  = useAgentStore(s => s.setView)
  const config   = DEPARTMENT_CONFIGS[department]
  const resetRef = useRef<(() => void) | null>(null)

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

      {/* Reset camera button — always visible, bottom-right of canvas */}
      <button
        onClick={() => resetRef.current?.()}
        style={{
          position: 'absolute',
          bottom: 20,
          right: 20,
          zIndex: 10,
          background: 'rgba(0,0,0,0.6)',
          color: config.glow,
          border: `1px solid ${config.glow}`,
          borderRadius: 6,
          padding: '6px 14px',
          fontSize: 12,
          fontFamily: 'monospace',
          cursor: 'pointer',
          letterSpacing: '0.05em',
        }}
      >
        ⌖ Reset View
      </button>

      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{ antialias: true }}
        camera={{ fov: 60, near: 0.1, far: 500, position: [0, 10, 15] }}
        style={{ cursor: 'grab' }}
        onMouseDown={e => (e.currentTarget.style.cursor = 'grabbing')}
        onMouseUp={e => (e.currentTarget.style.cursor = 'grab')}
      >
        <Suspense fallback={null}>
          <DepartmentSceneContent department={department} resetRef={resetRef} />
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
