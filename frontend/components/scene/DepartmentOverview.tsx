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
import CommunicationLog from '@/components/ui/CommunicationLog'
import { useCommunication } from '@/lib/useCommunication'

const DEPARTMENTS: ZoneName[] = ['INTAKE', 'STORAGE', 'STAGING', 'DISPATCH']

const STATE_COLORS: Record<string, string> = {
  IDLE:       'rgba(255,255,255,0.38)',
  MOVING:     '#5cc8ff',
  EXECUTING:  '#ff9b2b',
  MEETING:    '#c5ff2b',
  DELEGATING: '#cc44ff',
}

export default function DepartmentOverview() {
  const setView    = useAgentStore(s => s.setView)
  const agents     = useAgentStore(s => s.agents)
  const cardsRef   = useRef<HTMLDivElement>(null)
  const { commLog } = useCommunication()

  useEffect(() => {
    if (!cardsRef.current) return
    const cards = cardsRef.current.querySelectorAll('.dept-card')
    gsap.fromTo(cards,
      { opacity: 0, y: 40, scale: 0.95 },
      { opacity: 1, y: 0, scale: 1, duration: 0.6, stagger: 0.1, ease: 'power2.out' }
    )
  }, [])

  const getDeptAgents = (dept: ZoneName) => {
    const config = DEPARTMENT_CONFIGS[dept]
    return agents.filter(a => config.agentIds.includes(a.id))
  }

  const getStateCounts = (deptAgents: ReturnType<typeof getDeptAgents>) => {
    const counts: Record<string, number> = {}
    deptAgents.forEach(a => { counts[a.state] = (counts[a.state] ?? 0) + 1 })
    return counts
  }

  return (
    <div className="dept-overview">

      {/* ── Two-column split ── */}
      <div className="dept-split">

        {/* ── LEFT: header + cards + stats ── */}
        <div className="dept-left">
          <div className="dept-header">
            <p className="dept-section-label">01 — WAREHOUSE</p>
            <h1 className="dept-title">DeWare</h1>
            <p className="dept-subtitle">Select a department to view agents</p>
          </div>

          <div className="dept-grid" ref={cardsRef}>
            {DEPARTMENTS.map(dept => {
              const config      = DEPARTMENT_CONFIGS[dept]
              const deptAgents  = getDeptAgents(dept)
              const active      = deptAgents.some(a => a.state !== 'IDLE')
              const stateCounts = getStateCounts(deptAgents)

              return (
                <button
                  key={dept}
                  className="dept-card"
                  onClick={() => setView(dept)}
                  style={{ '--dept-glow': config.glow } as React.CSSProperties}
                >
                  <div className={`dept-card-icon${active ? ' active' : ''}`} style={{ background: config.glow, color: config.glow }}>
                    <span className="dept-card-count">{deptAgents.length}</span>
                  </div>
                  <div className="dept-card-content">
                    <h2 className="dept-card-name">{config.title}</h2>
                    <p className="dept-card-desc">{config.description}</p>
                    <div className="dept-card-states">
                      {Object.entries(stateCounts).map(([state, count]) => (
                        <span
                          key={state}
                          className="dept-card-state-pill"
                          style={{ color: STATE_COLORS[state] ?? 'rgba(255,255,255,0.2)' }}
                        >
                          {count} {state}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="dept-card-enter">
                    ENTER <span className="dept-card-arrow">→</span>
                  </div>
                </button>
              )
            })}
          </div>

          <div className="dept-stats">
            <div className="dept-stat">
              <span className="dept-stat-label">Total Agents</span>
              <span className="dept-stat-value">{agents.length}</span>
            </div>
            <div className="dept-stat">
              <span className="dept-stat-label">Departments</span>
              <span className="dept-stat-value">{DEPARTMENTS.length}</span>
            </div>
            <div className="dept-stat">
              <span className="dept-stat-label">Status</span>
              <span className="dept-stat-value live">LIVE</span>
            </div>
          </div>
        </div>

        {/* ── DIVIDER ── */}
        <div className="dept-divider" />

        {/* ── RIGHT: comm log ── */}
        <div className="dept-right" style={{ alignItems: 'stretch', paddingTop: '0', maxHeight: '80vh', overflow: 'hidden' }}>
          {commLog.length > 0
            ? <CommunicationLog entries={commLog} embedded />
            : (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                gap: '12px',
                opacity: 0.3,
              }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.2em', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>
                  03 — Comm Log
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'rgba(255,255,255,0.25)', letterSpacing: '0.06em' }}>
                  Waiting for agents…
                </span>
              </div>
            )
          }
        </div>

      </div>
    </div>
  )
}
