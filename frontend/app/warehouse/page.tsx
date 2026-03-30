'use client'

/**
 * Warehouse Simulation Page
 * ─────────────────────────────────────────────────────────────
 * Department overview with clickable cards to enter each department.
 * Now with Among Us-style communication system!
 */

import { useState } from 'react'
import dynamic from 'next/dynamic'
import Loader from '@/components/ui/Loader'
import AgentPanel from '@/components/ui/AgentPanel'
import ToastNotification from '@/components/ui/ToastNotification'
import CommunicationLog from '@/components/ui/CommunicationLog'
import AlertOverlay from '@/components/ui/AlertOverlay'
import { useAgentStore } from '@/lib/agentStore'
import { useBackendSocket } from '@/lib/useBackendSocket'
import { useCommunication } from '@/lib/useCommunication'
import type { ZoneName } from '@/lib/types'

const DepartmentOverview = dynamic(() => import('@/components/scene/DepartmentOverview'), { ssr: false })
const DepartmentScene    = dynamic(() => import('@/components/scene/DepartmentScene'), { ssr: false })

export default function WarehousePage() {
  const [loaded, setLoaded] = useState(false)
  const [alertOpen, setAlertOpen] = useState(false)
  const [alertData, setAlertData] = useState({ title: '', message: '', icon: '⚠️' })

  const currentView = useAgentStore(s => s.currentView)
  const connected   = useAgentStore(s => s.connected)

  useBackendSocket()
  const { commLog, toasts, removeToast } = useCommunication()

  // Demo alert after 15 seconds
  useState(() => {
    const timer = setTimeout(() => {
      setAlertData({
        title: 'Zone Capacity Alert',
        message: 'Storage zone has reached 85% capacity. Consider reallocation to prevent bottlenecks.',
        icon: '📦'
      })
      setAlertOpen(true)
    }, 15000)
    return () => clearTimeout(timer)
  })

  return (
    <>
      {!loaded && <Loader onComplete={() => setLoaded(true)} />}

      {/* Toast Notifications */}
      <div style={{
        position: 'fixed',
        top: '80px',
        left: '24px',
        zIndex: 200,
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        maxWidth: '400px',
      }}>
        {toasts.map((toast) => (
          <ToastNotification key={toast.id} toast={toast} onDismiss={removeToast} />
        ))}
      </div>

      {/* Alert Overlay */}
      <AlertOverlay
        isOpen={alertOpen}
        title={alertData.title}
        message={alertData.message}
        icon={alertData.icon}
        onClose={() => setAlertOpen(false)}
      />

      {/* Communication Log */}
      <CommunicationLog entries={commLog} />

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
        <div style={{ minHeight: '100vh', background: 'var(--bg)', paddingBottom: '240px' }}>
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
