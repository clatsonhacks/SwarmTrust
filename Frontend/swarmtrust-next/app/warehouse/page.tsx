'use client'

/**
 * Warehouse Simulation Page
 * ─────────────────────────────────────────────────────────────
 * Department overview with clickable cards to enter each department.
 */

import { useState } from 'react'
import dynamic from 'next/dynamic'
import Loader from '@/components/ui/Loader'
import { useAgentStore } from '@/lib/agentStore'
import type { ZoneName } from '@/lib/types'

const DepartmentOverview = dynamic(() => import('@/components/scene/DepartmentOverview'), { ssr: false })
const DepartmentScene = dynamic(() => import('@/components/scene/DepartmentScene'), { ssr: false })

export default function WarehousePage() {
  const [loaded, setLoaded] = useState(false)
  const currentView = useAgentStore(s => s.currentView)

  return (
    <>
      {!loaded && <Loader onComplete={() => setLoaded(true)} />}

      <div className="warehouse-fullscreen">
        {currentView === 'OVERVIEW' ? (
          <DepartmentOverview />
        ) : (
          <DepartmentScene department={currentView as ZoneName} />
        )}
      </div>
    </>
  )
}
