'use client'

/**
 * DepartmentOverview.tsx
 * ─────────────────────────────────────────────────────────────
 * Grid of 4 clickable department cards.
 * Click to enter a specific department view.
 */

import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { useAgentStore, DEPARTMENT_CONFIGS } from '@/lib/agentStore'
import type { ZoneName } from '@/lib/types'

const DEPARTMENTS: ZoneName[] = ['INTAKE', 'STORAGE', 'STAGING', 'DISPATCH']

export default function DepartmentOverview() {
  const setView = useAgentStore(s => s.setView)
  const agents  = useAgentStore(s => s.agents)
  const cardsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!cardsRef.current) return
    const cards = cardsRef.current.querySelectorAll('.dept-card')
    gsap.fromTo(cards,
      { opacity: 0, y: 40, scale: 0.95 },
      { opacity: 1, y: 0, scale: 1, duration: 0.6, stagger: 0.1, ease: 'power2.out' }
    )
  }, [])

  const getAgentCount = (dept: ZoneName) => {
    const config = DEPARTMENT_CONFIGS[dept]
    return config.agentIds.length
  }

  return (
    <div className="dept-overview">
      <div className="dept-header">
        <h1 className="dept-title">DeWare</h1>
        <p className="dept-subtitle">Select a department to view agents</p>
      </div>

      <div className="dept-grid" ref={cardsRef}>
        {DEPARTMENTS.map(dept => {
          const config = DEPARTMENT_CONFIGS[dept]
          const agentCount = getAgentCount(dept)

          return (
            <button
              key={dept}
              className="dept-card"
              onClick={() => setView(dept)}
              style={{ '--dept-glow': config.glow } as React.CSSProperties}
            >
              <div className="dept-card-icon" style={{ background: config.glow }}>
                <span className="dept-card-count">{agentCount}</span>
              </div>
              <div className="dept-card-content">
                <h2 className="dept-card-name">{config.title}</h2>
                <p className="dept-card-desc">{config.description}</p>
              </div>
              <div className="dept-card-arrow">→</div>
            </button>
          )
        })}
      </div>

      <div className="dept-stats">
        <div className="dept-stat">
          <span className="dept-stat-value">{agents.length}</span>
          <span className="dept-stat-label">Total Agents</span>
        </div>
        <div className="dept-stat">
          <span className="dept-stat-value">4</span>
          <span className="dept-stat-label">Departments</span>
        </div>
        <div className="dept-stat">
          <span className="dept-stat-value live">LIVE</span>
          <span className="dept-stat-label">Status</span>
        </div>
      </div>
    </div>
  )
}
