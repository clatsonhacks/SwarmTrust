'use client'

/**
 * AgentPanel.tsx
 * ─────────────────────────────────────────────────────────────
 * The live simulation dashboard — reads directly from agentStore.
 * Renders alongside or below the hero canvas.
 *
 * Four columns:
 *   • Agent cards (name, type, state, reputation bar)
 *   • Live transaction feed
 *   • Session stats
 *   • Zone occupancy
 */

import { useAgentStore, ZONES } from '@/lib/agentStore'

// Reputation bar component
function RepBar({ value, color }: { value: number; color: string }) {
  return (
    <div style={{
      width: '100%', height: '2px',
      background: 'rgba(255,255,255,0.06)',
      borderRadius: '1px', overflow: 'hidden',
      marginTop: '4px',
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

// State badge
function StateBadge({ state }: { state: string }) {
  const colors: Record<string, string> = {
    IDLE:       'rgba(255,255,255,0.15)',
    MOVING:     '#5cc8ff',
    EXECUTING:  '#ff9b2b',
    MEETING:    '#c5ff2b',
    DELEGATING: '#cc44ff',
  }
  return (
    <span style={{
      fontFamily: 'var(--font-mono)',
      fontSize: '7px',
      letterSpacing: '0.12em',
      padding: '2px 6px',
      background: `${colors[state] ?? colors.IDLE}22`,
      border: `0.5px solid ${colors[state] ?? colors.IDLE}55`,
      color: colors[state] ?? 'rgba(255,255,255,0.3)',
    }}>
      {state}
    </span>
  )
}

export default function AgentPanel() {
  const agents     = useAgentStore(s => s.agents)
  const log        = useAgentStore(s => s.log)
  const tasksDone  = useAgentStore(s => s.tasksDone)
  const totalUSDC  = useAgentStore(s => s.totalUSDC)
  const totalTx    = useAgentStore(s => s.totalTx)
  const simTime    = useAgentStore(s => s.simTime)

  const m = Math.floor(simTime / 60)
  const s = Math.floor(simTime % 60)
  const timeStr = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`

  // Zone occupancy
  const zoneCounts = Object.fromEntries(Object.keys(ZONES).map(k => [k, 0]))
  agents.forEach(a => { if (a.zone in zoneCounts) zoneCounts[a.zone]++ })

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
        color: 'var(--t-lo)',
        marginBottom: '40px',
        display: 'flex',
        alignItems: 'center',
        gap: '20px',
      }}>
        02 — Live Simulation
        <span style={{ flex: 1, height: '0.5px', background: 'var(--b-lo)' }} />
        <span style={{ color: 'var(--accent)' }}>{timeStr}</span>
      </p>

      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '24px',
      }}>

        {/* ── LEFT: AGENT CARDS ── */}
        <div>
          <p style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '8px',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: 'var(--t-mid)',
            marginBottom: '14px',
          }}>
            Agent Status
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {agents.map(agent => (
              <div
                key={agent.id}
                style={{
                  padding: '12px 14px',
                  background: agent.state !== 'IDLE'
                    ? `${agent.color}08`
                    : 'rgba(255,255,255,0.02)',
                  border: `0.5px solid ${agent.state !== 'IDLE' ? agent.color + '30' : 'var(--b-lo)'}`,
                  borderRadius: '4px',
                  transition: 'border-color 0.3s, background 0.3s',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      width: '8px', height: '8px', borderRadius: '50%',
                      background: agent.color, flexShrink: 0,
                    }} />
                    <div>
                      <div style={{
                        fontFamily: 'var(--font-mono)', fontSize: '10px',
                        color: 'var(--t-hi)', letterSpacing: '0.06em',
                      }}>
                        {agent.name}
                      </div>
                      <div style={{
                        fontFamily: 'var(--font-mono)', fontSize: '7px',
                        color: 'var(--t-lo)', letterSpacing: '0.1em', marginTop: '1px',
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
                    color: 'var(--t-mid)', letterSpacing: '0.04em',
                    marginBottom: '6px',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {agent.task}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: '8px',
                    color: 'var(--t-lo)', letterSpacing: '0.1em',
                  }}>
                    REP
                  </span>
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: '10px',
                    color: agent.color, letterSpacing: '0.06em',
                  }}>
                    {agent.reputation}/100
                  </span>
                </div>
                <RepBar value={agent.reputation} color={agent.color} />
              </div>
            ))}
          </div>
        </div>

        {/* ── RIGHT: LOG + STATS ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* Session stats */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px',
          }}>
            {[
              { label: 'Tasks Done',  value: tasksDone,            accent: false },
              { label: 'USDC Paid',   value: `$${totalUSDC.toFixed(3)}`, accent: true },
              { label: 'On-chain Tx', value: totalTx,              accent: false },
            ].map(({ label, value, accent }) => (
              <div key={label} style={{
                background: 'rgba(255,255,255,0.02)',
                border: '0.5px solid var(--b-lo)',
                borderRadius: '4px',
                padding: '12px 14px',
              }}>
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: '8px',
                  letterSpacing: '0.14em', textTransform: 'uppercase',
                  color: 'var(--t-lo)', marginBottom: '6px',
                }}>
                  {label}
                </div>
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: '18px',
                  color: accent ? 'var(--accent)' : 'var(--t-hi)',
                  letterSpacing: '0.04em',
                }}>
                  {value}
                </div>
              </div>
            ))}
          </div>

          {/* Zone occupancy */}
          <div style={{
            background: 'rgba(255,255,255,0.02)',
            border: '0.5px solid var(--b-lo)',
            borderRadius: '4px',
            padding: '14px',
          }}>
            <p style={{
              fontFamily: 'var(--font-mono)', fontSize: '8px',
              letterSpacing: '0.2em', textTransform: 'uppercase',
              color: 'var(--t-mid)', marginBottom: '12px',
            }}>Zone Occupancy</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {Object.entries(ZONES).map(([name, zone]) => (
                <div key={name} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: '9px',
                    letterSpacing: '0.1em', color: 'var(--t-mid)',
                  }}>
                    {name}
                  </span>
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: '9px',
                    color: zoneCounts[name] > 0 ? zone.glow : 'var(--t-lo)',
                  }}>
                    {zoneCounts[name] > 0 ? `${zoneCounts[name]} agent${zoneCounts[name] > 1 ? 's' : ''}` : 'empty'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Live log */}
          <div style={{
            background: 'rgba(255,255,255,0.02)',
            border: '0.5px solid var(--b-lo)',
            borderRadius: '4px',
            padding: '14px',
            flex: 1,
            minHeight: '200px',
            maxHeight: '260px',
            overflowY: 'auto',
          }}>
            <p style={{
              fontFamily: 'var(--font-mono)', fontSize: '8px',
              letterSpacing: '0.2em', textTransform: 'uppercase',
              color: 'var(--t-mid)', marginBottom: '12px',
            }}>Agent Log</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
              {log.slice(0, 18).map(entry => (
                <div
                  key={entry.id}
                  style={{
                    padding: '6px 0',
                    borderBottom: '0.5px solid rgba(255,255,255,0.03)',
                  }}
                >
                  <div style={{
                    fontFamily: 'var(--font-mono)', fontSize: '7px',
                    color: 'var(--t-lo)', letterSpacing: '0.1em', marginBottom: '2px',
                  }}>
                    {entry.timestamp}
                  </div>
                  <div
                    style={{
                      fontFamily: 'var(--font-mono)', fontSize: '9px',
                      color: 'var(--t-mid)', lineHeight: '1.5', letterSpacing: '0.03em',
                    }}
                    dangerouslySetInnerHTML={{ __html: entry.message }}
                  />
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </section>
  )
}
