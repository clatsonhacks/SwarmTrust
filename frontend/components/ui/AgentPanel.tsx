'use client'

import { useAgentStore, ZONES } from '@/lib/agentStore'

function RepBar({ value, color }: { value: number; color: string }) {
  return (
    <div style={{ width: '100%', height: '2px', background: 'rgba(255,255,255,0.06)', borderRadius: '1px', overflow: 'hidden', marginTop: '8px' }}>
      <div style={{ width: `${value}%`, height: '100%', background: color, borderRadius: '1px', transition: 'width 0.6s ease' }} />
    </div>
  )
}

const STATE_META: Record<string, { color: string; bg: string }> = {
  IDLE:          { color: 'rgba(255,255,255,0.45)', bg: 'rgba(255,255,255,0.06)' },
  MOVING:        { color: '#5cc8ff',  bg: 'rgba(92,200,255,0.12)' },
  EXECUTING:     { color: '#ff9b2b',  bg: 'rgba(255,155,43,0.12)' },
  MEETING:       { color: '#c5ff2b',  bg: 'rgba(197,255,43,0.12)' },
  DELEGATING:    { color: '#cc44ff',  bg: 'rgba(204,68,255,0.12)' },
  COMMUNICATING: { color: '#ff6b9d',  bg: 'rgba(255,107,157,0.12)' },
}

function StateBadge({ state }: { state: string }) {
  const meta = STATE_META[state] ?? STATE_META.IDLE
  return (
    <span style={{
      fontFamily: 'var(--font-mono)',
      fontSize: '8px',
      letterSpacing: '0.14em',
      padding: '3px 8px',
      background: meta.bg,
      color: meta.color,
      borderRadius: '2px',
      fontWeight: 600,
      whiteSpace: 'nowrap',
    }}>
      {state}
    </span>
  )
}

const STAT_ACCENT = ['rgba(255,255,255,0.5)', 'var(--accent)', '#5cc8ff']

const LOG_BORDER: Record<string, string> = {
  payment: '#60a5fa',
  chain:   '#cc44ff',
  meeting: '#c5ff2b',
  info:    'rgba(255,255,255,0.12)',
}

export default function AgentPanel() {
  const agents    = useAgentStore(s => s.agents)
  const log       = useAgentStore(s => s.log)
  const tasksDone = useAgentStore(s => s.tasksDone)
  const totalUSDC = useAgentStore(s => s.totalUSDC)
  const totalTx   = useAgentStore(s => s.totalTx)
  const simTime   = useAgentStore(s => s.simTime)

  const m = Math.floor(simTime / 60)
  const s = Math.floor(simTime % 60)
  const timeStr = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`

  const zoneCounts = Object.fromEntries(Object.keys(ZONES).map(k => [k, 0]))
  agents.forEach(a => { if (a.zone in zoneCounts) zoneCounts[a.zone]++ })
  const maxZone = Math.max(...Object.values(zoneCounts), 1)

  const stats = [
    { label: 'Tasks Done',  value: String(tasksDone) },
    { label: 'USDC Paid',   value: `$${totalUSDC.toFixed(3)}` },
    { label: 'On-chain Tx', value: String(totalTx) },
  ]

  return (
    <section id="sim" style={{ background: 'var(--bg)', borderTop: '0.5px solid var(--b-lo)', padding: '56px 48px', display: 'flex', flexDirection: 'column' }}>

      {/* Heading */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '44px' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.75)', fontWeight: 700 }}>
          02 — Live Simulation
        </span>
        <span style={{ flex: 1, height: '0.5px', background: 'var(--b-lo)' }} />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--accent)', letterSpacing: '0.1em' }}>{timeStr}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', alignItems: 'stretch', flex: 1, minHeight: 0 }}>

        {/* ── LEFT: AGENTS ── */}
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.65)', fontWeight: 700, marginBottom: '16px', flexShrink: 0 }}>
            Agent Status
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, overflowY: 'auto' }}>
            {agents.map(agent => {
              const active = agent.state !== 'IDLE'
              return (
                <div key={agent.id} style={{
                  padding: '14px 16px',
                  background: active ? `${agent.color}10` : 'rgba(255,255,255,0.025)',
                  border: `1px solid ${active ? agent.color + '40' : 'rgba(255,255,255,0.07)'}`,
                  borderRadius: '6px',
                  transition: 'border-color 0.4s, background 0.4s',
                }}>

                  {/* Row 1: dot + name + badge */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{
                        width: '9px', height: '9px', borderRadius: '50%',
                        background: agent.color, flexShrink: 0,
                        boxShadow: active ? `0 0 8px 2px ${agent.color}66` : 'none',
                        transition: 'box-shadow 0.4s',
                      }} />
                      <div style={{ fontFamily: 'var(--font-sans)', fontSize: '14px', color: '#ece7de', letterSpacing: '0.01em', fontWeight: 500 }}>
                        {agent.name}
                      </div>
                    </div>
                    <StateBadge state={agent.state} />
                  </div>

                  {/* Task label */}
                  {agent.task && (
                    <div style={{
                      fontFamily: 'var(--font-mono)', fontSize: '9px',
                      color: 'rgba(255,255,255,0.45)', letterSpacing: '0.04em',
                      marginBottom: '8px', paddingLeft: '0',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {agent.task}
                    </div>
                  )}

                  {/* Rep row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingLeft: '19px' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: 'rgba(255,255,255,0.25)', letterSpacing: '0.14em' }}>REP</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: agent.color, letterSpacing: '0.04em' }}>
                      {agent.reputation}/100
                    </span>
                  </div>
                  <RepBar value={agent.reputation} color={agent.color} />
                </div>
              )
            })}
          </div>
        </div>

        {/* ── RIGHT: STATS + ZONES + LOG ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: '100%' }}>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
            {stats.map(({ label, value }, i) => (
              <div key={label} style={{
                background: 'rgba(255,255,255,0.025)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderTop: `2px solid ${STAT_ACCENT[i]}`,
                borderRadius: '6px',
                padding: '14px 16px',
              }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', marginBottom: '10px' }}>
                  {label}
                </div>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: '22px', fontWeight: 600, color: i === 1 ? 'var(--accent)' : '#ece7de', lineHeight: 1 }}>
                  {value}
                </div>
              </div>
            ))}
          </div>

          {/* Zone occupancy */}
          <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '6px', padding: '16px' }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: '16px' }}>
              Zone Occupancy
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {Object.entries(ZONES).map(([name, zone]) => {
                const count = zoneCounts[name]
                const pct   = (count / maxZone) * 100
                return (
                  <div key={name}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.55)' }}>
                        {name}
                      </span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: count > 0 ? zone.glow : 'rgba(255,255,255,0.2)' }}>
                        {count > 0 ? `${count} agent${count > 1 ? 's' : ''}` : 'empty'}
                      </span>
                    </div>
                    <div style={{ height: '2px', background: 'rgba(255,255,255,0.06)', borderRadius: '1px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: zone.glow, borderRadius: '1px', transition: 'width 0.6s ease', opacity: count > 0 ? 0.8 : 0 }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Agent log */}
          <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '6px', padding: '16px', flex: 1, minHeight: '200px', maxHeight: '280px', overflowY: 'auto' }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: '14px' }}>
              Agent Log
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {log.slice(0, 20).map(entry => (
                <div key={entry.id} style={{
                  padding: '7px 0 7px 10px',
                  borderLeft: `2px solid ${LOG_BORDER[entry.type] ?? LOG_BORDER.info}`,
                  borderBottom: '0.5px solid rgba(255,255,255,0.04)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: 'rgba(255,255,255,0.25)', letterSpacing: '0.06em', flexShrink: 0 }}>
                      {entry.timestamp}
                    </span>
                    <div
                      style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'rgba(255,255,255,0.65)', lineHeight: '1.5', letterSpacing: '0.02em' }}
                      dangerouslySetInnerHTML={{ __html: entry.message }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </section>
  )
}
