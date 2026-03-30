'use client'

import { useRef, useEffect, useMemo, useState, Suspense } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useGLTF, Environment, Html, useAnimations, OrbitControls, useProgress } from '@react-three/drei'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import * as THREE from 'three'
import { SkeletonUtils } from 'three-stdlib'
import { useAgentStore, DEPARTMENT_CONFIGS } from '@/lib/agentStore'
import type { ZoneName, AgentState } from '@/lib/types'
import TrustBeam from './TrustBeam'

// ── Loading indicator ─────────────────────────────────────────────────
function Loader() {
  const { progress } = useProgress()
  return (
    <Html center>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
        color: '#fff',
        fontFamily: 'monospace',
      }}>
        <div style={{
          width: 200,
          height: 6,
          background: 'rgba(255,255,255,0.2)',
          borderRadius: 3,
          overflow: 'hidden',
        }}>
          <div style={{
            width: `${progress}%`,
            height: '100%',
            background: 'linear-gradient(90deg, #00ff88, #00ffff)',
            borderRadius: 3,
            transition: 'width 0.2s ease',
          }} />
        </div>
        <div style={{ fontSize: 14, letterSpacing: '0.1em' }}>
          LOADING {progress.toFixed(0)}%
        </div>
      </div>
    </Html>
  )
}

// ── Role-specific waypoints ───────────────────────────────────────────
interface Waypoint {
  pos: [number, number, number]
  task: string
  execTime: number
}

function getWaypoints(type: string, dept: ZoneName, cx: number, cz: number, s: number, groundY: number = 1): Waypoint[] {
  // Each department gets unique tasks even if agent type overlaps
  // groundY ensures agents are above ground level
  const W = (ox: number, oz: number, task: string, execTime: number): Waypoint =>
    ({ pos: [cx + s * ox, groundY, cz + s * oz], task, execTime })

  const byDept: Partial<Record<ZoneName, Waypoint[]>> = {
    INTAKE: [
      W(-0.8, -0.8, 'Scanning incoming pallet',    4.5),
      W( 0.7, -0.4, 'Logging manifest #A7',         3.0),
      W( 0.2,  0.9, 'Barcode check — row 1',        4.0),
      W(-0.5,  0.5, 'Flagging damaged crate',       3.5),
      W( 0.9,  0.2, 'Receiving freight #12',        5.0),
    ],
    STORAGE: [
      W(-0.7, -0.7, 'Auditing shelf B-4',           4.0),
      W( 0.8, -0.3, 'Restacking row 7',             5.0),
      W( 0.3,  0.8, 'Cycle count zone C',           3.5),
      W(-0.6,  0.5, 'Moving overstock to bay 3',    5.5),
      W( 0.5, -0.8, 'FIFO rotation — cold aisle',   4.5),
    ],
    STAGING: [
      W(-0.7,  0.6, 'Order pick #ORD-882',          3.5),
      W( 0.6, -0.7, 'Verifying SKU list',           4.0),
      W( 0.0,  0.9, 'Packing station — line 2',     3.0),
      W(-0.8, -0.5, 'QA scan before dispatch',      5.0),
      W( 0.7,  0.4, 'Label print & apply',          2.5),
    ],
    DISPATCH: [
      W( 0.0,  0.9, 'Loading dock 3 — truck ETA',   4.0),
      W(-0.7,  0.0, 'Routing cart to bay 6',        3.0),
      W( 0.6, -0.7, 'Final weight check',           3.5),
      W( 0.0, -0.9, 'Handoff to carrier agent',     5.0),
      W( 0.8,  0.5, 'Dispatch confirmation',        2.5),
    ],
  }

  // Fall back to generic role tasks if dept not matched
  const generic: Record<string, Waypoint[]> = {
    SCOUT:   [W(-0.7,-0.7,'Patrol sweep',3.5), W(0.7,0.4,'Area scan',4.0), W(-0.3,0.8,'Log report',3.0)],
    LIFTER:  [W(0.6,0.6,'Lift cargo',5.0), W(-0.5,-0.6,'Collect item',3.5), W(0.4,-0.8,'Place load',4.0)],
    CARRIER: [W(0,-0.9,'Carry to exit',4.0), W(-0.7,0,'Load cart',3.0), W(0.6,-0.6,'Final drop',5.0)],
  }

  return byDept[dept] ?? generic[type] ?? [W(0, 0, 'Standby', 3.0)]
}

// ── Department Agent — owns its own patrol simulation ─────────────────
function DepartmentAgent({
  id, name, color, waypoints, speed, agentScale, department, startIndex,
}: {
  id: string
  name: string
  color: string
  waypoints: Waypoint[]
  speed: number
  agentScale: number
  department: ZoneName
  startIndex: number
}) {
  const groupRef = useRef<THREE.Group>(null!)
  const ringRef  = useRef<THREE.Mesh>(null!)
  const agentColor = useMemo(() => new THREE.Color(color), [color])
  const currentAnimRef = useRef<string | null>(null)

  // Simulation state — all in refs so useFrame doesn't re-render React
  const wpIndexRef    = useRef(startIndex % Math.max(waypoints.length, 1))
  const phaseRef      = useRef<'IDLE' | 'MOVING' | 'EXECUTING'>('IDLE')
  const timerRef      = useRef(startIndex * 2.0 + 1.0)
  const execDurRef    = useRef(0)   // full duration of current exec, for progress %

  // React state only for the HTML overlay (updates only on phase transitions)
  const [displayState, setDisplayState] = useState<AgentState>('IDLE')
  const [displayTask,  setDisplayTask]  = useState(waypoints[wpIndexRef.current]?.task ?? '')

  // Load agent model
  const config = DEPARTMENT_CONFIGS[department]
  const { scene, animations } = useGLTF(config.agentModel)
  const [clonedScene, agentFloorOffset] = useMemo(() => {
    const clone = SkeletonUtils.clone(scene)

    // Normalize root
    clone.position.set(0, 0, 0)
    clone.rotation.set(0, 0, 0)
    clone.scale.set(1, 1, 1)

    // Some GLBs (nora.glb) are exported from Blender without applying transforms,
    // leaving an Armature child with scale=100 and a large translation offset.
    // This makes the model appear 30× too large and 250 world units above the floor.
    // Fix: any child node with an extreme scale gets reset to identity.
    clone.traverse(child => {
      const s = child.scale
      if (Math.abs(s.x) > 10 || Math.abs(s.y) > 10 || Math.abs(s.z) > 10) {
        child.scale.set(1, 1, 1)
        child.position.set(0, 0, 0)
      }
    })

    clone.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(clone)

    // Sanity-clamp: if the bbox is still unreasonable, just sit at floor
    const floorOffset = (!box.isEmpty() && box.min.y > -200 && box.min.y < 200)
      ? -box.min.y * agentScale
      : 0

    return [clone, floorOffset]
  }, [scene])
  const { actions } = useAnimations(animations, clonedScene)

  // Shadows
  useEffect(() => {
    clonedScene.traverse(child => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true
        child.receiveShadow = true
      }
    })
  }, [clonedScene])

  // Drive animations from displayState
  useEffect(() => {
    const names = Object.keys(actions)
    if (!names.length) return
    const find = (...kws: string[]) =>
      kws.map(k => names.find(n => n.toLowerCase().includes(k.toLowerCase()))).find(Boolean) ?? null

    const target =
      displayState === 'MOVING'    ? find('walk', 'run', 'locomotion', 'forward') :
      displayState === 'EXECUTING' ? find('work', 'action', 'interact', 'jump') :
                                     find('idle', 'stand', 'wait', 'walk')
    const anim = target ?? names[0]
    if (anim && anim !== currentAnimRef.current) {
      if (currentAnimRef.current) actions[currentAnimRef.current]?.fadeOut(0.3)
      actions[anim]?.reset().fadeIn(0.3).play()
      currentAnimRef.current = anim
    }
  }, [displayState, actions])

  useFrame(({ clock }, delta) => {
    if (!groupRef.current || !waypoints.length) return
    const t = clock.getElapsedTime()

    if (phaseRef.current === 'IDLE') {
      timerRef.current -= delta
      if (timerRef.current <= 0) {
        wpIndexRef.current = (wpIndexRef.current + 1) % waypoints.length
        phaseRef.current = 'MOVING'
        setDisplayState('MOVING')
        setDisplayTask(waypoints[wpIndexRef.current].task)
      }

    } else if (phaseRef.current === 'MOVING') {
      const wp = waypoints[wpIndexRef.current]
      const pos = groupRef.current.position
      const dx = wp.pos[0] - pos.x
      const dz = wp.pos[2] - pos.z
      const dist = Math.sqrt(dx * dx + dz * dz)

      if (dist > 0.12) {
        const step = speed * delta
        pos.x += (dx / dist) * step
        pos.z += (dz / dist) * step
        groupRef.current.rotation.y = THREE.MathUtils.lerp(
          groupRef.current.rotation.y,
          Math.atan2(dx, dz),
          0.12,
        )
        // Walk bob — up/down + slight side sway
        groupRef.current.position.y = Math.abs(Math.sin(t * speed * 1.8)) * 0.05
        groupRef.current.rotation.z = Math.sin(t * speed * 1.8) * 0.04
      } else {
        pos.x = wp.pos[0]
        pos.z = wp.pos[2]
        phaseRef.current  = 'EXECUTING'
        timerRef.current  = wp.execTime
        execDurRef.current = wp.execTime
        // Reset any walk lean before starting exec
        groupRef.current.rotation.x = 0
        groupRef.current.rotation.z = 0
        setDisplayState('EXECUTING')
      }

    } else if (phaseRef.current === 'EXECUTING') {
      timerRef.current -= delta
      const progress = 1 - timerRef.current / Math.max(execDurRef.current, 0.001)

      // ── Procedural lift cycle ──────────────────────────────────────
      // 0–25 %  : approach — lean forward, squat down
      // 25–55 % : strain up — rise, straighten, micro-shake
      // 55–80 % : hold high — slight sway while carrying
      // 80–100%  : place down — lower, straighten fully
      if (progress < 0.25) {
        const p = progress / 0.25
        groupRef.current.position.y = -p * 0.12
        groupRef.current.rotation.x =  p * 0.28   // lean forward
      } else if (progress < 0.55) {
        const p = (progress - 0.25) / 0.30
        groupRef.current.position.y = -0.12 + p * 0.22   // rise up
        groupRef.current.rotation.x = 0.28 - p * 0.20   // straighten
        // micro-shake — straining under weight
        groupRef.current.position.x += (Math.random() - 0.5) * 0.003
        groupRef.current.position.z += (Math.random() - 0.5) * 0.003
      } else if (progress < 0.80) {
        const p = (progress - 0.55) / 0.25
        groupRef.current.position.y = 0.10 + Math.sin(p * Math.PI * 2) * 0.02   // sway while holding
        groupRef.current.rotation.x = 0.08 - p * 0.05
        groupRef.current.rotation.z = Math.sin(p * Math.PI * 3) * 0.04           // side rock
      } else {
        const p = (progress - 0.80) / 0.20
        groupRef.current.position.y = 0.10 - p * 0.10   // place down
        groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, 0, 0.1)
        groupRef.current.rotation.z = THREE.MathUtils.lerp(groupRef.current.rotation.z, 0, 0.1)
      }

      if (timerRef.current <= 0) {
        // Clean reset
        groupRef.current.position.y = 0
        groupRef.current.rotation.x = 0
        groupRef.current.rotation.z = 0
        phaseRef.current = 'IDLE'
        timerRef.current = 0.5 + Math.random() * 1.5
        setDisplayState('IDLE')
      }
    }

    // Ring pulse on EXECUTING
    if (phaseRef.current === 'EXECUTING' && ringRef.current) {
      ringRef.current.scale.setScalar(1 + Math.sin(t * 3) * 0.3)
      ;(ringRef.current.material as THREE.MeshBasicMaterial).opacity = 0.5 + Math.sin(t * 3) * 0.2
    } else if (ringRef.current) {
      ;(ringRef.current.material as THREE.MeshBasicMaterial).opacity = 0
    }
  })

  const statusClass =
    displayState === 'MOVING'    ? 'moving'    :
    displayState === 'EXECUTING' ? 'executing' : ''

  const statusText =
    displayState === 'MOVING'    ? 'MOVING'    :
    displayState === 'EXECUTING' ? 'EXEC'      : 'IDLE'

  const startPos = waypoints[startIndex % waypoints.length]?.pos ?? [0, 0, 0]

  return (
    <group ref={groupRef} position={startPos}>
      <primitive object={clonedScene} scale={agentScale} position={[0, agentFloorOffset, 0]} />
      <mesh ref={ringRef} position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.2, 0.35, 32]} />
        <meshBasicMaterial color={agentColor} transparent opacity={0} side={THREE.DoubleSide} />
      </mesh>
      <Html position={[0, 1.2, 0]} center style={{ pointerEvents: 'none' }}>
        <div className="agent-tag">
          <div className="agent-tag-name">{name}</div>
          <div className={`agent-tag-status ${statusClass}`}>{statusText}</div>
          {displayState !== 'IDLE' && (
            <div style={{
              fontSize: 9,
              color: '#fff',
              fontWeight: 'bold',
              marginTop: 2,
              maxWidth: 120,
              textAlign: 'center',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {displayTask}
            </div>
          )}
        </div>
      </Html>
    </group>
  )
}

// ── Warehouse Environment ─────────────────────────────────────────────
function WarehouseEnvironment({ department }: { department: ZoneName }) {
  const config = DEPARTMENT_CONFIGS[department]
  const { scene } = useGLTF(config.environmentModel)

  const [clonedScene, floorOffset] = useMemo(() => {
    const clone = scene.clone()
    const box = new THREE.Box3().setFromObject(clone)
    const buildingHeight = box.max.y - box.min.y
    const roofThreshold = box.min.y + buildingHeight * 0.65

    clone.traverse(child => {
      const mesh = child as THREE.Mesh
      if (!mesh.isMesh) return
      mesh.castShadow = true
      mesh.receiveShadow = true

      const meshBox = new THREE.Box3().setFromObject(mesh)
      if (meshBox.min.y > roofThreshold) {
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
        mesh.material = mats.map(m => {
          const c = (m as THREE.Material).clone() as THREE.MeshStandardMaterial
          c.transparent = true
          c.opacity = 0.15
          c.depthWrite = false
          return c
        })
      }
    })

    return [clone, -box.min.y]
  }, [scene])

  return (
    <group scale={2}>
      <primitive object={clonedScene} position={[0, floorOffset, 0]} rotation={[0, 0, 0]} />
    </group>
  )
}

// ── Zone Label (floating 3D text) ─────────────────────────────────────
function ZoneLabel({
  text,
  position,
  color,
  subtitle
}: {
  text: string
  position: [number, number, number]
  color: string
  subtitle?: string
}) {
  const groupRef = useRef<THREE.Group>(null!)

  useFrame(({ clock, camera }) => {
    if (groupRef.current) {
      // Gentle float animation
      groupRef.current.position.y = position[1] + Math.sin(clock.getElapsedTime() * 0.8) * 0.1
      // Always face camera
      groupRef.current.quaternion.copy(camera.quaternion)
    }
  })

  return (
    <group ref={groupRef} position={position}>
      <Html center style={{ pointerEvents: 'none' }}>
        <div style={{
          background: `linear-gradient(135deg, ${color}22, ${color}44)`,
          border: `2px solid ${color}`,
          borderRadius: 12,
          padding: '12px 24px',
          backdropFilter: 'blur(10px)',
          boxShadow: `0 0 30px ${color}66`,
        }}>
          <div style={{
            color: color,
            fontSize: 28,
            fontWeight: 800,
            fontFamily: 'monospace',
            letterSpacing: '0.15em',
            textShadow: `0 0 20px ${color}`,
          }}>
            {text}
          </div>
          {subtitle && (
            <div style={{
              color: '#ffffff99',
              fontSize: 11,
              fontFamily: 'monospace',
              letterSpacing: '0.1em',
              marginTop: 4,
              textAlign: 'center',
            }}>
              {subtitle}
            </div>
          )}
        </div>
      </Html>
    </group>
  )
}

// ── Floor Glow Zone ───────────────────────────────────────────────────
function FloorGlowZone({
  position,
  color,
  radius = 3
}: {
  position: [number, number, number]
  color: string
  radius?: number
}) {
  const ringRef = useRef<THREE.Mesh>(null!)
  const glowColor = useMemo(() => new THREE.Color(color), [color])

  useFrame(({ clock }) => {
    if (ringRef.current) {
      const t = clock.getElapsedTime()
      // Pulsing glow
      const scale = 1 + Math.sin(t * 1.5) * 0.1
      ringRef.current.scale.set(scale, scale, 1)
      ;(ringRef.current.material as THREE.MeshBasicMaterial).opacity = 0.3 + Math.sin(t * 2) * 0.15
    }
  })

  return (
    <group position={position}>
      {/* Outer glow ring */}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[radius * 0.8, radius, 64]} />
        <meshBasicMaterial color={glowColor} transparent opacity={0.3} side={THREE.DoubleSide} />
      </mesh>
      {/* Inner solid circle */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <circleGeometry args={[radius * 0.8, 64]} />
        <meshBasicMaterial color={glowColor} transparent opacity={0.08} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

// ── Floating Particles ────────────────────────────────────────────────
function FloatingParticles({ color, count = 50, spread = 8 }: { color: string; count?: number; spread?: number }) {
  const particlesRef = useRef<THREE.Points>(null!)

  const particles = useMemo(() => {
    const positions = new Float32Array(count * 3)
    const speeds = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * spread
      positions[i * 3 + 1] = Math.random() * 4
      positions[i * 3 + 2] = (Math.random() - 0.5) * spread
      speeds[i] = 0.2 + Math.random() * 0.5
    }
    return { positions, speeds }
  }, [count, spread])

  useFrame(({ clock }) => {
    if (particlesRef.current) {
      const positions = particlesRef.current.geometry.attributes.position.array as Float32Array
      const t = clock.getElapsedTime()
      for (let i = 0; i < count; i++) {
        // Gentle upward drift
        positions[i * 3 + 1] += particles.speeds[i] * 0.005
        // Reset when too high
        if (positions[i * 3 + 1] > 5) positions[i * 3 + 1] = 0
        // Slight horizontal sway
        positions[i * 3] += Math.sin(t + i) * 0.002
      }
      particlesRef.current.geometry.attributes.position.needsUpdate = true
    }
  })

  return (
    <points ref={particlesRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={particles.positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        color={color}
        size={0.08}
        transparent
        opacity={0.6}
        sizeAttenuation
      />
    </points>
  )
}

// ── Status Icon (floating emoji/icon above workspace) ─────────────────
function StatusIcon({
  position,
  icon,
  label
}: {
  position: [number, number, number]
  icon: string
  label: string
}) {
  const groupRef = useRef<THREE.Group>(null!)

  useFrame(({ clock }) => {
    if (groupRef.current) {
      groupRef.current.position.y = position[1] + Math.sin(clock.getElapsedTime() * 1.2) * 0.15
      groupRef.current.rotation.y = Math.sin(clock.getElapsedTime() * 0.5) * 0.2
    }
  })

  return (
    <group ref={groupRef} position={position}>
      <Html center style={{ pointerEvents: 'none' }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 4,
        }}>
          <div style={{
            fontSize: 32,
            filter: 'drop-shadow(0 0 10px rgba(255,255,255,0.5))',
          }}>
            {icon}
          </div>
          <div style={{
            fontSize: 10,
            color: '#fff',
            fontFamily: 'monospace',
            background: 'rgba(0,0,0,0.6)',
            padding: '2px 8px',
            borderRadius: 4,
            letterSpacing: '0.05em',
          }}>
            {label}
          </div>
        </div>
      </Html>
    </group>
  )
}

// ── Corner Markers ────────────────────────────────────────────────────
function CornerMarkers({ cx, cz, spread, color }: { cx: number; cz: number; spread: number; color: string }) {
  const corners = [
    [cx - spread, 0.05, cz - spread],
    [cx + spread, 0.05, cz - spread],
    [cx - spread, 0.05, cz + spread],
    [cx + spread, 0.05, cz + spread],
  ] as [number, number, number][]

  return (
    <>
      {corners.map((pos, i) => (
        <mesh key={i} position={pos} rotation={[-Math.PI / 2, 0, Math.PI / 4]}>
          <planeGeometry args={[0.4, 0.4]} />
          <meshBasicMaterial color={color} transparent opacity={0.8} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </>
  )
}

// ── Animated lighting ────────────────────────────────────────────────
function AnimatedLights({ cx, cz, glowColor }: { cx: number; cz: number; glowColor: string }) {
  const ambientRef    = useRef<THREE.AmbientLight>(null!)
  const overheadRef   = useRef<THREE.PointLight>(null!)
  const accentARef    = useRef<THREE.PointLight>(null!)
  const accentBRef    = useRef<THREE.PointLight>(null!)
  const sweepRef      = useRef<THREE.SpotLight>(null!)
  const sweepTargetRef= useRef<THREE.Object3D>(null!)

  // Flicker state — occasional random drop-outs like old fluorescents
  const flickerTimer  = useRef(0)
  const flickerActive = useRef(false)

  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime()

    // ── Overhead flicker (fluorescent tube effect) ──
    flickerTimer.current -= delta
    if (flickerTimer.current <= 0) {
      flickerActive.current = Math.random() < 0.15  // 15% chance of a flicker event
      flickerTimer.current  = flickerActive.current
        ? 0.05 + Math.random() * 0.1   // short flicker duration
        : 2.5  + Math.random() * 4.0   // longer quiet period
    }
    if (overheadRef.current) {
      const base = 3.5
      if (flickerActive.current) {
        // Rapid stutter
        overheadRef.current.intensity = Math.random() < 0.5 ? 0.4 : base * 1.3
      } else {
        // Gentle hum variation (subtle sine + tiny noise)
        overheadRef.current.intensity = base + Math.sin(t * 1.3) * 0.3 + Math.sin(t * 7.1) * 0.1
      }
    }

    // ── Ambient breathe — very subtle ──
    if (ambientRef.current) {
      ambientRef.current.intensity = 1.6 + Math.sin(t * 0.4) * 0.2
    }

    // ── Accent lights pulse (opposite phase so they trade off) ──
    if (accentARef.current) {
      accentARef.current.intensity = 1.8 + Math.sin(t * 0.9) * 0.8
    }
    if (accentBRef.current) {
      accentBRef.current.intensity = 1.8 + Math.sin(t * 0.9 + Math.PI) * 0.8
    }

    // ── Sweeping spotlight — slow orbit around the warehouse floor ──
    if (sweepRef.current && sweepTargetRef.current) {
      const r = 7
      sweepRef.current.position.x = cx + Math.cos(t * 0.18) * r
      sweepRef.current.position.z = cz + Math.sin(t * 0.18) * r
      sweepRef.current.position.y = 8
      sweepTargetRef.current.position.set(cx, 0, cz)
      sweepRef.current.intensity = 2.5 + Math.sin(t * 0.6) * 0.8
    }
  })

  return (
    <>
      <ambientLight ref={ambientRef} intensity={1.6} color="#e8eef5" />

      {/* Main overhead — flickering fluorescent */}
      <pointLight ref={overheadRef} position={[cx, 6, cz]} intensity={3.5} color="#fff8e7" distance={32} decay={1.5} />

      {/* Accent pair — pulsing out of phase */}
      <pointLight ref={accentARef} position={[cx - 6, 4, cz - 6]} intensity={1.8} color={glowColor} distance={22} decay={2} />
      <pointLight ref={accentBRef} position={[cx + 6, 4, cz + 6]} intensity={1.8} color={glowColor} distance={22} decay={2} />

      {/* Sweeping spotlight */}
      <spotLight
        ref={sweepRef}
        position={[cx + 7, 8, cz]}
        intensity={2.5}
        color={glowColor}
        angle={0.35}
        penumbra={0.6}
        distance={30}
        decay={1.8}
        castShadow={false}
      />
      <object3D ref={sweepTargetRef} position={[cx, 0, cz]} />

      {/* Static fill light from opposite corner so shadows aren't pitch black */}
      <pointLight position={[cx - 8, 5, cz + 8]} intensity={0.8} color="#3a4a6a" distance={25} decay={2} />
    </>
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
  const tick    = useAgentStore(s => s.tick)
  const agents  = useAgentStore(s => s.agents)
  const beams   = useAgentStore(s => s.activeBeams)
  const config  = DEPARTMENT_CONFIGS[department]

  const { scene: warehouseScene } = useGLTF(config.environmentModel)

  const warehouseBounds = useMemo(() => {
    const box = new THREE.Box3().setFromObject(warehouseScene)
    const center = new THREE.Vector3()
    const size   = new THREE.Vector3()
    box.getCenter(center)
    box.getSize(size)

    // Use camera target from config as agent center, or fall back to scene center
    const deptCenter = config.cameraTarget || [center.x, 0, center.z]

    return {
      cx:      deptCenter[0],
      cz:      deptCenter[2],
      groundY: deptCenter[1] + 1,  // Agent ground level (slightly above target)
      spread:  5,  // Fixed spread for agent waypoints
      camR:    Math.max(size.x, size.z) * 0.55,
      camH:    size.y * 0.65,
    }
  }, [warehouseScene, config.cameraTarget])

  const deptAgents = useMemo(() =>
    agents.filter(a => config.agentIds.includes(a.id)),
    [agents, config.agentIds],
  )

  // Animated camera fly-in on mount
  const cameraAnimRef = useRef({ progress: 0, active: true })

  // Get camera position from config or fallback to computed
  const targetCamPos = config.cameraPos || [warehouseBounds.cx + 10, 8, warehouseBounds.cz + 10] as [number, number, number]
  const targetCamTarget = config.cameraTarget || [warehouseBounds.cx, 0, warehouseBounds.cz] as [number, number, number]

  useEffect(() => {
    // Start position: far outside, high up
    camera.position.set(targetCamPos[0] + 30, targetCamPos[1] + 20, targetCamPos[2] + 30)
    camera.lookAt(targetCamTarget[0], targetCamTarget[1], targetCamTarget[2])
    // Reset animation state
    cameraAnimRef.current = { progress: 0, active: true }

    setTimeout(() => {
      controlsRef.current?.saveState()
      resetRef.current = () => controlsRef.current?.reset()
    }, 2500) // Save state after fly-in completes
  }, [camera, targetCamPos, targetCamTarget, resetRef])

  // Animate camera flying into the department area
  useFrame((_, delta) => {
    tick(delta)

    const anim = cameraAnimRef.current
    if (!anim.active) return

    anim.progress += delta * 0.5 // ~2 second animation

    if (anim.progress >= 1) {
      anim.active = false
      anim.progress = 1
    }

    // Easing function (ease-out cubic)
    const t = 1 - Math.pow(1 - anim.progress, 3)

    // Start: far outside & high | End: department camera position
    const startPos = { x: targetCamPos[0] + 30, y: targetCamPos[1] + 20, z: targetCamPos[2] + 30 }
    const endPos = { x: targetCamPos[0], y: targetCamPos[1], z: targetCamPos[2] }

    camera.position.x = startPos.x + (endPos.x - startPos.x) * t
    camera.position.y = startPos.y + (endPos.y - startPos.y) * t
    camera.position.z = startPos.z + (endPos.z - startPos.z) * t

    // Update controls target
    if (controlsRef.current) {
      controlsRef.current.target.set(targetCamTarget[0], targetCamTarget[1], targetCamTarget[2])
      controlsRef.current.update()
    }
  })

  // Beams between agents in this dept
  const getAgentPos = (agentId: string): [number, number, number] => {
    const idx = deptAgents.findIndex(a => a.id === agentId)
    if (idx === -1) return [warehouseBounds.cx, warehouseBounds.groundY, warehouseBounds.cz]
    const wps = getWaypoints(
      deptAgents[idx].type, department,
      warehouseBounds.cx, warehouseBounds.cz, warehouseBounds.spread, warehouseBounds.groundY
    )
    return wps[idx % wps.length]?.pos ?? [warehouseBounds.cx, warehouseBounds.groundY, warehouseBounds.cz]
  }

  const beamElements = beams
    .filter(b => config.agentIds.includes(b.from) || config.agentIds.includes(b.to))
    .map(beam => {
      const fp = getAgentPos(beam.from)
      const tp = getAgentPos(beam.to)
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

      <AnimatedLights cx={warehouseBounds.cx} cz={warehouseBounds.cz} glowColor={config.glow} />
      <directionalLight
        position={[10, 25, 10]} intensity={2} castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-far={80}
        shadow-camera-left={-30} shadow-camera-right={30}
        shadow-camera-top={30}  shadow-camera-bottom={-30}
      />

      <OrbitControls
        ref={controlsRef}
        makeDefault
        target={[targetCamTarget[0], targetCamTarget[1], targetCamTarget[2]]}
        enablePan enableZoom enableRotate
        rotateSpeed={0.5} zoomSpeed={0.8} panSpeed={0.6}
        minDistance={3}
        maxDistance={80}
        minPolarAngle={0.1}
        maxPolarAngle={Math.PI * 0.85}
      />

      <WarehouseEnvironment department={department} />

      {/* Zone Label - floating above workspace */}
      <ZoneLabel
        text={config.title.toUpperCase()}
        position={[warehouseBounds.cx, 5, warehouseBounds.cz]}
        color={config.glow}
        subtitle={`${config.agentIds.length} AGENTS ACTIVE`}
      />

      {/* Floor Glow Zone - marks the work area */}
      <FloorGlowZone
        position={[warehouseBounds.cx, 0, warehouseBounds.cz]}
        color={config.glow}
        radius={warehouseBounds.spread * 1.2}
      />

      {/* Floating Particles - ambient effect */}
      <FloatingParticles
        color={config.glow}
        count={40}
        spread={warehouseBounds.spread * 1.5}
      />

      {/* Corner Markers */}
      <CornerMarkers
        cx={warehouseBounds.cx}
        cz={warehouseBounds.cz}
        spread={warehouseBounds.spread}
        color={config.glow}
      />

      {/* Status Icons */}
      <StatusIcon
        position={[warehouseBounds.cx - 3, 3, warehouseBounds.cz - 3]}
        icon="📦"
        label="CARGO"
      />
      <StatusIcon
        position={[warehouseBounds.cx + 3, 3, warehouseBounds.cz + 3]}
        icon="🤖"
        label="SWARM"
      />

      {deptAgents.map((agent, idx) => {
        const agentScale = config.agentScale ?? 0.3
        // Outdoor agents patrol outside the warehouse — use a larger spread
        const spreadMul = config.outdoor ? 1.4 : 1.0
        const wps   = getWaypoints(
          agent.type, department,
          warehouseBounds.cx, warehouseBounds.cz,
          warehouseBounds.spread * spreadMul,
          warehouseBounds.groundY,
        )
        const speed = agent.type === 'SCOUT' ? 3.5 : agent.type === 'CARRIER' ? 4.0 : 2.8
        return (
          <DepartmentAgent
            key={agent.id}
            id={agent.id}
            name={agent.name}
            color={agent.color}
            waypoints={wps}
            speed={speed}
            agentScale={agentScale}
            department={department}
            startIndex={idx}
          />
        )
      })}

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

      {/* Control buttons */}
      <div style={{
        position: 'absolute', bottom: 20, right: 20, zIndex: 10,
        display: 'flex', gap: 10,
      }}>
        <button
          onClick={() => resetRef.current?.()}
          style={{
            background: 'rgba(0,0,0,0.6)', color: config.glow,
            border: `1px solid ${config.glow}`, borderRadius: 6,
            padding: '6px 14px', fontSize: 12, fontFamily: 'monospace',
            cursor: 'pointer', letterSpacing: '0.05em',
          }}
        >
          ⌖ Reset View
        </button>
      </div>

      <Canvas
        shadows dpr={[1, 2]} gl={{ antialias: true }}
        camera={{ fov: 60, near: 0.1, far: 500, position: [0, 10, 15] }}
        style={{ cursor: 'grab' }}
        onMouseDown={e => e.currentTarget.style.cursor = 'grabbing'}
        onMouseUp={e => e.currentTarget.style.cursor = 'grab'}
      >
        <Suspense fallback={<Loader />}>
          <DepartmentSceneContent department={department} resetRef={resetRef} />
        </Suspense>
      </Canvas>
    </div>
  )
}

// Preload models
useGLTF.preload('/models/21948_autosave.glb')
useGLTF.preload('/models/box-02_robot.glb')
useGLTF.preload('/models/turret_droid.glb')
useGLTF.preload('/models/combat_steampunk_robot.glb')
useGLTF.preload('/models/nora.glb')
