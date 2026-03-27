'use client'

/**
 * SimCanvas.tsx
 * ─────────────────────────────────────────────────────────────
 * Wraps the R3F <Canvas> so it can be dynamically imported
 * (ssr: false) from page.tsx. R3F doesn't support SSR.
 *
 * Performance settings:
 *   dpr={[1, 2]}  → cap at 2× for high-DPI screens
 *   shadows       → enable shadow maps
 *   gl.antialias  → smooth edges
 */

import { Canvas } from '@react-three/fiber'
import { Suspense } from 'react'
import WarehouseScene from './WarehouseScene'

export default function SimCanvas() {
  return (
    <Canvas
      dpr={[1, 2]}
      shadows
      camera={{ position: [28, 28, 28], fov: 42 }}
      gl={{ antialias: true, alpha: false }}
      style={{ background: '#070810' }}
    >
      {/*
        Suspense: while WarehouseScene loads (fonts, textures, etc.)
        we render nothing. You could replace null with a loader mesh.
      */}
      <Suspense fallback={null}>
        <WarehouseScene />
      </Suspense>
    </Canvas>
  )
}
