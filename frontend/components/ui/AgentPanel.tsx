'use client'

import { useAgentStore, ZONES } from '@/lib/agentStore'

function RepBar({ value, color }: { value: number; color: string }) {
  return (
    <div style={{
      width: '100%', height: '2px',
      background: 'rgba(255,255,255,0.06)',
      borderRadius: '1px', overflow: 'hidden',
      marginTop: '6px',
    }}>
      <div style={{
        width: `${value}%`,
        height: '100%',
        background: color,
        borderRadius: '1px',
        transition: 'width 0.6s ease',
      }} />
    </div>
  )
}

const STATE_COLORS: Record<string, string> = {
  IDLE:          'rgba(255,255,255,0.18)',
  MOVING:        '#5cc8ff',
  EXECUTING:     '#ff9b2b',
  MEETING:       '#c5ff2b',
  DELEGATING:    '#cc44ff',
  COMMUNICATING: '#ff6b9d',
}

function StateBadge({ state }: { state: string }) {
  const color = STATE_COLORS[state] ?? STATE_COLORS.IDLE
  return (
    <span style={{
      fontFamily: 'var(--font-mono)',
      fontSize: '7px',
      letterSpacing: '0.12em',
      padding: '2px 7px',
      background: `${color}18`,
      border: `0.5px solid ${color}55`,
      color,
      borderRadius: '2px',
    }}>
      {state}
    </span>
  )
}

const STAT_COLORS = ['rgba(255,255,255,0.15)', 'var(--accent)', '#5cc8ff']

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
    { label: 'Tasks Done',  value: tasksDone,                   unit: '' },
    { label: 'USDC Paid',   value: `$${totalUSDC.toFixed(3)}`,  unit: '' },
    { label: 'On-chain Tx', value: totalTx,                     unit: '' },
  ]

  const logTypeColor: Record<string, string> = {
    payment: '#60a5fa',
    chain:   '#cc44ff',
    meeting: '#c5ff2b',
    info:    'rgba(255,255,255,0.15)',
  }

  return (
    <section
      id="sim"
      style={{
        background: 'var(--bg)',
        borderTop: '0.5px solid var(--b-lo)',
        padding: '60px 48px',
      }}
    >
      {/* Section heading */}
      <p style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '10px',
        letterSpacing: '0.22em',
        textTransform: 'uppercase',
        color: 'rgba(255,255,255,0.28)',
        marginBottom: '40px',
        display: 'flex',
        alignItems: 'center',
        gap: '20px',
      }}>
        02 — Live Simulation
        <span style={{ flex: 1, height: '0.5px', background: 'var(--b-lo)' }} />
        <span style={{ color: 'var(--accent)' }}>{timeStr}</span>
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>

        {/* ── LEFT: AGENT CARDS ── */}
        <div>
          <p style={{
            fontFamily: 'var(--font-mono)', fontSize: '8px',
            letterSpacing: '0.2em', textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.28)', marginBottom: '14px',
          }}>Agent Status</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {agents.map(agent => {
              const active = agent.state !== 'IDLE'
              return (
                <div
                  key={agent.id}
                  style={{
                    padding: '12px 14px',
                    background: active ? `${agent.color}08` : 'rgba(255,255,255,0.02)',
                    border: `0.5px solid ${active ? agent.color + '35' : 'var(--b-lo)'}`,
                    borderRadius: '4px',
                    transition: 'border-color 0.4s, background 0.4s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {/* Dot — pulses when active */}
                      <span style={{
                        width: '8px', height: '8px', borderRadius: '50%',
                        background: agent.color, flexShrink: 0,
                        boxShadow: active ? `0 0 6px 2px ${agent.color}55` : 'none',
                        transition: 'box-shadow 0.4s',
                      }} />
                      <div>
                        <div style={{
                          fontFamily: 'var(--font-mono)', fontSize: '11px',
                          color: 'var(--t-hi)', letterSpacing: '0.06em', fontWeight: 500,
                        }}>
                          {agent.name}
                        </div>
                        <div style={{
                          fontFamily: 'var(--font-mono)', fontSize: '7px',
                          color: 'rgba(255,255,255,0.28)', letterSpacing: '0.12em', marginTop: '1px',
                        }}>
                          {agent.type}
                        </div>
                      </div>
                    </div>
                    <StateBadge state={agent.state} />
                  </div>

                  {agent.task && (
                    <div style={{
                      fontFamily: 'var(--font-mono)', fontSize: '8px',
                      color: 'rgba(255,255,255,0.38)', letterSpacing: '0.04em',
                      marginBottom: '6px',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      paddingLeft: '18px',
                    }}>
                      {agent.task}
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingLeft: '18px' }}>
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: '7px',
                      color: 'rgba(255,255,255,0.22)', letterSpacing: '0.12em',
                    }}>REP</span>
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: '10px',
                      color: agent.color, letterSpacing: '0.06em',
                    }}>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Stats — colored top border per card */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
            {stats.map(({ label, value }, i) => (
              <div key={label} style={{
                background: 'rgba(255,255,255,0.02)',
                border: '0.5px solid var(--b-lo)',
                borderTop: `1.5px solid ${STAT_COLORS[i]}`,
                borderRadius: '4px',
                padding: '12px 14px',
              }}>
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: '7px',
                  letterSpacing: '0.16em', textTransform: 'uppercase',
                  color: 'rgba(255,255,255,0.28)', marginBottom: '8px',
                }}>
                  {label}
                </div>
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: '20px',
                  color: i === 1 ? 'var(--accent)' : 'var(--t-hi)',
                  letterSpacing: '0.02em', lineHeight: 1,
                }}>
                  {value}
                </div>
              </div>
            ))}
          </div>

          {/* Zone occupancy — with mini fill bars */}
          <div style={{
            background: 'rgba(255,255,255,0.02)',
            border: '0.5px solid var(--b-lo)',
            borderRadius: '4px',
            padding: '14px 16px',
          }}>
            <p style={{
              fontFamily: 'var(--font-mono)', fontSize: '8px',
              letterSpacing: '0.2em', textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.28)', marginBottom: '14px',
            }}>Zone Occupancy</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {Object.entries(ZONES).map(([name, zone]) => {
                const count = zoneCounts[name]
                const pct   = (count / maxZone) * 100
                return (
                  <div key={name}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{
                        fontFamily: 'var(--font-mono)', fontSize: '9px',
                        letterSpacing: '0.1em', color: 'rgba(255,255,255,0.42)',
                      }}>
                        {name}
                      </span>
                      <span style={{
                        fontFamily: 'var(--font-mono)', fontSize: '9px',
                        color: count > 0 ? zone.glow : 'rgba(255,255,255,0.18)',
                      }}>
                        {count > 0 ? `${count} agent${count > 1 ? 's' : ''}` : 'empty'}
                      </span>
                    </div>
                    <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)', borderRadius: '1px', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${pct}%`,
                        background: zone.glow,
                        borderRadius: '1px',
                        transition: 'width 0.6s ease',
                        opacity: count > 0 ? 0.7 : 0,
                      }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Live log — left border by type */}
          <div style={{
            background: 'rgba(255,255,255,0.02)',
            border: '0.5px solid var(--b-lo)',
            borderRadius: '4px',
            padding: '14px 16px',
            flex: 1,
            minHeight: '200px',
            maxHeight: '280px',
            overflowY: 'auto',
          }}>
            <p style={{
              fontFamily: 'var(--font-mono)', fontSize: '8px',
              letterSpacing: '0.2em', textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.28)', marginBottom: '12px',
            }}>Agent Log</p>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {log.slice(0, 20).map(entry => (
                <div
                  key={entry.id}
                  style={{
                    padding: '6px 0 6px 10px',
                    borderBottom: '0.5px solid rgba(255,255,255,0.03)',
                    borderLeft: `1.5px solid ${logTypeColor[entry.type] ?? logTypeColor.info}`,
                    marginBottom: '2px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: '7px',
                      color: 'rgba(255,255,255,0.2)', letterSpacing: '0.08em',
                      flexShrink: 0,
                    }}>
                      {entry.timestamp}
                    </span>
                    <div
                      style={{
                        fontFamily: 'var(--font-mono)', fontSize: '9px',
                        color: 'rgba(255,255,255,0.55)', lineHeight: '1.5',
                        letterSpacing: '0.03em',
                      }}
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
