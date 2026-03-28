'use client'

/**
 * Warehouse Simulation Page
 * ─────────────────────────────────────────────────────────────
 * Department overview with clickable cards to enter each department.
 */

import { useState } from 'react'
import dynamic from 'next/dynamic'
import Loader from '@/components/ui/Loader'
import AgentPanel from '@/components/ui/AgentPanel'
import { useAgentStore } from '@/lib/agentStore'
import { useBackendSocket } from '@/lib/useBackendSocket'
import type { ZoneName } from '@/lib/types'

const DepartmentOverview = dynamic(() => import('@/components/scene/DepartmentOverview'), { ssr: false })
const DepartmentScene    = dynamic(() => import('@/components/scene/DepartmentScene'), { ssr: false })

export default function WarehousePage() {
  const [loaded, setLoaded] = useState(false)
  const currentView = useAgentStore(s => s.currentView)
  const connected   = useAgentStore(s => s.connected)
  useBackendSocket()

  return (
    <>
      {!loaded && <Loader onComplete={() => setLoaded(true)} />}

      {/* Live backend connection indicator */}
      <div style={{
        position: 'fixed', top: '16px', right: '16px', zIndex: 9999,
        display: 'flex', alignItems: 'center', gap: '6px',
        fontFamily: 'var(--font-mono)', fontSize: '8px', letterSpacing: '0.16em',
        color: connected ? '#1aff88' : 'rgba(255,255,255,0.25)',
        pointerEvents: 'none',
      }}>
        <span style={{
          width: '6px', height: '6px', borderRadius: '50%',
          background: connected ? '#1aff88' : 'rgba(255,255,255,0.2)',
          boxShadow: connected ? '0 0 6px #1aff88' : 'none',
        }} />
        {connected ? 'LIVE' : 'SIM'}
      </div>

      {currentView === 'OVERVIEW' ? (
        // Scrollable layout: department cards + live agent panel below
        <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
          <DepartmentOverview />
          <AgentPanel />
        </div>
      ) : (
        // Fullscreen 3D scene when inside a department
        <div className="warehouse-fullscreen">
          <DepartmentScene department={currentView as ZoneName} />
        </div>
      )}
    </>
  )
}
