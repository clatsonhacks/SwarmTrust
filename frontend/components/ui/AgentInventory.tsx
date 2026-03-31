'use client'

import { useState } from 'react'

export interface AgentInfo {
  robotId: string
  capabilities: string[]
  position: { x: number; y: number; z: number }
  behaviorState: 'IDLE' | 'MOVING' | 'EXECUTING' | 'WAITING' | 'WAITING_PAYMENT'
  currentTaskId: string | null
  reputationScore: number
  usdcBalance: string
  zone?: string
  walletAddress?: string
  lastUpdated: number
}

interface AgentInventoryProps {
  isOpen: boolean
  onClose: () => void
  agents: AgentInfo[]
  onSpawnAgent?: (capabilities: string[]) => void
}

const CAPABILITY_COLORS: Record<string, string> = {
  NAVIGATE: '#5cc8ff',
  SCAN:     '#cc44ff',
  LIFT:     '#ff9b2b',
  CARRY:    '#1aff88',
}

const STATE_META: Record<string, { color: string; bg: string }> = {
  IDLE:            { color: 'rgba(255,255,255,0.45)', bg: 'rgba(255,255,255,0.06)' },
  MOVING:          { color: '#5cc8ff',  bg: 'rgba(92,200,255,0.12)' },
  EXECUTING:       { color: '#ff9b2b',  bg: 'rgba(255,155,43,0.12)' },
  WAITING:         { color: '#cc44ff',  bg: 'rgba(204,68,255,0.12)' },
  WAITING_PAYMENT: { color: '#ff9b2b',  bg: 'rgba(255,155,43,0.12)' },
}

const ALL_CAPS = ['NAVIGATE', 'SCAN', 'LIFT', 'CARRY']

export default function AgentInventory({ isOpen, onClose, agents, onSpawnAgent }: AgentInventoryProps) {
  const [selected,      setSelected]      = useState<string | null>(null)
  const [showSpawn,     setShowSpawn]     = useState(false)
  const [selectedCaps,  setSelectedCaps]  = useState<string[]>(['NAVIGATE'])

  const agent = selected ? agents.find(a => a.robotId === selected) : null

  const toggleCap = (cap: string) =>
    setSelectedCaps(prev => prev.includes(cap) ? prev.filter(c => c !== cap) : [...prev, cap])

  const handleSpawn = () => {
    if (selectedCaps.length > 0 && onSpawnAgent) {
      onSpawnAgent(selectedCaps)
      setShowSpawn(false)
      setSelectedCaps(['NAVIGATE'])
    }
  }

  if (!isOpen) return null

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(6px)',
          zIndex: 500,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <div
          onClick={e => e.stopPropagation()}
          style={{
            width: '95%', maxWidth: '1100px', maxHeight: '88vh',
            background: 'var(--bg)',
            border: '0.5px solid rgba(255,255,255,0.12)',
            borderRadius: '6px',
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div style={{
            padding: '16px 24px',
            borderBottom: '0.5px solid rgba(255,255,255,0.08)',
            display: 'flex', alignItems: 'center', gap: '16px',
            flexShrink: 0,
          }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)' }}>
              Agent Inventory
            </span>
            <span style={{ flex: 1, height: '0.5px', background: 'rgba(255,255,255,0.06)' }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--accent)' }}>
              {agents.length} agents
            </span>
            <button
              onClick={() => setShowSpawn(true)}
              style={{
                fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.16em',
                textTransform: 'uppercase', padding: '6px 14px',
                background: 'rgba(197,255,43,0.08)',
                border: '0.5px solid rgba(197,255,43,0.3)',
                color: 'var(--accent)', borderRadius: '3px', cursor: 'pointer',
              }}
            >
              + Spawn
            </button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: '16px', padding: '0 0 0 8px', lineHeight: 1 }}>✕</button>
          </div>

          {/* Content */}
          <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

            {/* Agent grid */}
            <div style={{
              flex: 1, padding: '20px', overflowY: 'auto',
              display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
              gap: '10px', alignContent: 'start',
            }}>
              {agents.map(ag => {
                const meta = STATE_META[ag.behaviorState] ?? STATE_META.IDLE
                const isSel = selected === ag.robotId
                return (
                  <div
                    key={ag.robotId}
                    onClick={() => setSelected(isSel ? null : ag.robotId)}
                    style={{
                      padding: '14px',
                      background: isSel ? 'rgba(197,255,43,0.05)' : 'rgba(255,255,255,0.02)',
                      border: `0.5px solid ${isSel ? 'rgba(197,255,43,0.3)' : 'rgba(255,255,255,0.08)'}`,
                      borderRadius: '4px',
                      cursor: 'pointer',
                      transition: 'border-color 0.2s, background 0.2s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#ece7de', fontWeight: 600, letterSpacing: '0.06em' }}>
                        {ag.robotId}
                      </span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '7px', letterSpacing: '0.12em', padding: '2px 7px', background: meta.bg, color: meta.color, borderRadius: '2px' }}>
                        {ag.behaviorState}
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '10px' }}>
                      {(ag.capabilities || []).map(cap => (
                        <span key={cap} style={{
                          fontFamily: 'var(--font-mono)', fontSize: '8px', letterSpacing: '0.08em',
                          padding: '2px 6px',
                          border: `0.5px solid ${CAPABILITY_COLORS[cap] ?? 'rgba(255,255,255,0.2)'}`,
                          color: CAPABILITY_COLORS[cap] ?? 'rgba(255,255,255,0.5)',
                          borderRadius: '2px',
                        }}>
                          {cap}
                        </span>
                      ))}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '10px', borderTop: '0.5px solid rgba(255,255,255,0.06)' }}>
                      <div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '7px', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '2px' }}>REP</div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: '#ece7de' }}>{ag.reputationScore}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '7px', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '2px' }}>USDC</div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: '#1aff88' }}>{parseFloat(ag.usdcBalance).toFixed(2)}</div>
                      </div>
                      {ag.zone && (
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '7px', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '2px' }}>ZONE</div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'rgba(255,255,255,0.55)' }}>{ag.zone}</div>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
              {agents.length === 0 && (
                <div style={{ gridColumn: '1/-1', textAlign: 'center', paddingTop: '60px', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'rgba(255,255,255,0.2)' }}>
                  No agents in inventory
                </div>
              )}
            </div>

            {/* Detail panel */}
            {agent && (
              <div style={{ width: '300px', flexShrink: 0, borderLeft: '0.5px solid rgba(255,255,255,0.06)', padding: '20px', overflowY: 'auto' }}>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: '20px' }}>
                  Agent Details
                </p>

                {[
                  { label: 'Agent ID',    value: agent.robotId },
                  { label: 'Task',        value: agent.currentTaskId ?? 'None' },
                  { label: 'Zone',        value: agent.zone ?? '—' },
                  { label: 'Position',    value: `${agent.position.x.toFixed(1)}, ${agent.position.y.toFixed(1)}, ${agent.position.z.toFixed(1)}` },
                  { label: 'Reputation',  value: `${agent.reputationScore} / 100` },
                  { label: 'USDC',        value: `${parseFloat(agent.usdcBalance).toFixed(4)}` },
                  { label: 'Wallet',      value: agent.walletAddress ? `${agent.walletAddress.slice(0,6)}…${agent.walletAddress.slice(-4)}` : '—' },
                ].map(({ label, value }) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '8px 0', borderBottom: '0.5px solid rgba(255,255,255,0.05)' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)' }}>{label}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#ece7de', textAlign: 'right', maxWidth: '160px', wordBreak: 'break-all' }}>{value}</span>
                  </div>
                ))}

                {/* Rep bar */}
                <div style={{ marginTop: '16px', height: '2px', background: 'rgba(255,255,255,0.06)', borderRadius: '1px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${agent.reputationScore}%`, background: '#1aff88', transition: 'width 0.4s ease' }} />
                </div>

                {/* Capabilities */}
                <div style={{ marginTop: '20px' }}>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: '10px' }}>Capabilities</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {(agent.capabilities || []).map(cap => (
                      <div key={cap} style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        padding: '8px 10px',
                        background: 'rgba(255,255,255,0.02)',
                        border: `0.5px solid ${CAPABILITY_COLORS[cap] ?? 'rgba(255,255,255,0.1)'}`,
                        borderRadius: '3px',
                      }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: CAPABILITY_COLORS[cap] ?? '#ece7de' }}>{cap}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Spawn modal */}
      {showSpawn && (
        <div onClick={() => setShowSpawn(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)', zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '420px', background: 'var(--bg)', border: '0.5px solid rgba(255,255,255,0.12)', borderRadius: '6px', padding: '28px' }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', marginBottom: '6px' }}>Spawn Agent</p>
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'rgba(255,255,255,0.45)', marginBottom: '24px' }}>Select capabilities for the new agent</p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '24px' }}>
              {ALL_CAPS.map(cap => {
                const active = selectedCaps.includes(cap)
                return (
                  <button
                    key={cap}
                    onClick={() => toggleCap(cap)}
                    style={{
                      padding: '14px',
                      background: active ? `${CAPABILITY_COLORS[cap]}14` : 'rgba(255,255,255,0.02)',
                      border: `0.5px solid ${active ? CAPABILITY_COLORS[cap] : 'rgba(255,255,255,0.1)'}`,
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.12em',
                      color: active ? CAPABILITY_COLORS[cap] : 'rgba(255,255,255,0.4)',
                      transition: 'all 0.15s',
                    }}
                  >
                    {cap}
                  </button>
                )
              })}
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowSpawn(false)} style={{ flex: 1, padding: '10px', background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={handleSpawn} disabled={selectedCaps.length === 0} style={{ flex: 1, padding: '10px', background: 'var(--accent)', border: 'none', borderRadius: '4px', color: '#070810', fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700, cursor: 'pointer', opacity: selectedCaps.length === 0 ? 0.4 : 1 }}>
                Spawn
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
