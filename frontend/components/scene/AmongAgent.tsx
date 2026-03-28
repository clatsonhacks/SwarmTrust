'use client'

/**
 * AmongAgent.tsx
 * ────────────────────────────────────────────────────────────
 * Renders a single agent using a Blender .glb model.
 *
 * The model should have animations named: Idle, Walk, Work, Talk
 * See README for Blender export checklist.
 *
 * Animation states (driven by agent.state prop):
 *   IDLE       → plays Idle animation
 *   MOVING     → plays Walk animation
 *   EXECUTING  → plays Work animation, pulsing ring under feet
 *   MEETING    → plays Talk animation
 *   DELEGATING → plays Idle animation
 */

import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, useGLTF, useAnimations } from '@react-three/drei'
import * as THREE from 'three'
import { SkeletonUtils } from 'three-stdlib'
import type { AgentState } from '@/lib/types'

interface AmongAgentProps {
  id:       string
  name:     string
  color:    string
  position: [number, number, number]
  state:    AgentState
  task:     string
  phase:    number    // random offset so agents don't all bob in sync
}

export default function AmongAgent({
  id, name, color, position, state, task, phase,
}: AmongAgentProps) {
  const groupRef = useRef<THREE.Group>(null!)
  const ringRef  = useRef<THREE.Mesh>(null!)

  // Memoize color object so it isn't recreated every render
  const agentColor = useMemo(() => new THREE.Color(color), [color])

  // Load the .glb model
  const { scene, animations } = useGLTF('/models/combat_steampunk_robot.glb')
  const clonedScene = useMemo(() => SkeletonUtils.clone(scene), [scene])
  const { actions } = useAnimations(animations, clonedScene)

  // Log available animations (check browser console)
  useEffect(() => {
    if (animations.length > 0) {
      console.log(`[${name}] Available animations:`, animations.map(a => a.name))
    }
  }, [animations, name])

  // Play the animation (model has single "Animation" clip)
  useEffect(() => {
    if (actions['Animation']) {
      actions['Animation'].reset().fadeIn(0.2).play()
    }
  }, [actions])

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()

    // Ring pulsing when EXECUTING
    if (state === 'EXECUTING' && ringRef.current) {
      ringRef.current.scale.setScalar(1 + Math.sin(t * 3) * 0.25)
      ;(ringRef.current.material as THREE.MeshBasicMaterial).opacity =
        0.25 + Math.sin(t * 3) * 0.15
    } else if (ringRef.current) {
      ;(ringRef.current.material as THREE.MeshBasicMaterial).opacity = 0
    }
  })

  const statusClass =
    state === 'MOVING'    ? 'moving'    :
    state === 'EXECUTING' ? 'executing' :
    state === 'MEETING'   ? 'meeting'   : ''

  const statusText =
    state === 'IDLE'      ? 'IDLE'      :
    state === 'MOVING'    ? 'MOVING'    :
    state === 'EXECUTING' ? 'EXEC'      :
    state === 'MEETING'   ? 'SCRUM'     :
    state === 'DELEGATING'? 'DELEGATING': state

  return (
    <group ref={groupRef} position={position} scale={0.15}>

      {/* ── AGENT MODEL ─────────────────────────────────── */}
      <primitive object={clonedScene} />

      {/* ── GROUND RING (visible when EXECUTING) ──────── */}
      <mesh ref={ringRef} position={[0, 0.1, 0]} rotation={[-Math.PI/2, 0, 0]}>
        <ringGeometry args={[3, 4, 32]} />
        <meshBasicMaterial
          color={agentColor}
          transparent
          opacity={0}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* ── HTML NAME TAG ─────────────────────────────── */}
      <Html
        position={[0, 12, 0]}
        center
        occlude
        style={{ pointerEvents: 'none' }}
      >
        <div className="agent-tag">
          <div className="agent-tag-name">{name}</div>
          <div className={`agent-tag-status ${statusClass}`}>{statusText}</div>
        </div>
      </Html>

    </group>
  )
}
