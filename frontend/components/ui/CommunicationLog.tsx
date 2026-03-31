'use client'

const BASESCAN = 'https://sepolia.basescan.org/tx'

// Only show Basescan link if txHash looks like a real on-chain hash
const isValidTxHash = (h?: string) =>
  typeof h === 'string' && h.startsWith('0x') && h.length >= 20

export interface CommEntry {
  id: string
  from: string
  to: string
  fromZone: string
  toZone: string
  message: string
  timestamp: Date
  color: string
  txHash?: string
  amount?: string           // e.g. "0.01"
  entryType?: 'payment' | 'delegation' | 'comm'
}

interface CommunicationLogProps {
  entries: CommEntry[]
  embedded?: boolean  // true = fills parent, false = fixed bottom-right overlay
}

export default function CommunicationLog({ entries, embedded = false }: CommunicationLogProps) {
  if (entries.length === 0) return null

  if (embedded) {
    return (
      <div style={{
        width: '100%',
        height: '100%',
        maxHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'transparent',
        overflow: 'hidden',
      }}>

        {/* Header */}
        <div style={{
          padding: '0 0 20px 0',
          borderBottom: '0.5px solid var(--b-lo)',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          flexShrink: 0,
        }}>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.28)',
          }}>
            03 — Comm Log
          </span>
          <span style={{ flex: 1, height: '0.5px', background: 'var(--b-lo)' }} />
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            letterSpacing: '0.1em',
            color: 'var(--accent)',
          }}>
            {entries.length}
          </span>
        </div>

        {/* Entries */}
        <div style={{
          overflowY: 'auto',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          paddingTop: '8px',
        }}>
          {entries.slice(0, 30).map((entry) => {
            const time = entry.timestamp.toLocaleTimeString('en-US', {
              hour12: false, hour: '2-digit', minute: '2-digit',
            })
            const isPayment = entry.entryType === 'payment' || !!entry.amount
            const isDelegation = entry.entryType === 'delegation'

            return (
              <div
                key={entry.id}
                style={{
                  padding: '16px 0',
                  borderBottom: '0.5px solid rgba(255,255,255,0.05)',
                }}
              >
                {/* Row 1: dot + FROM → TO + time */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '10px',
                }}>
                  <span style={{
                    width: '6px', height: '6px', borderRadius: '50%',
                    background: entry.color, flexShrink: 0,
                    boxShadow: `0 0 6px ${entry.color}`,
                  }} />
                  <span style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '11px',
                    letterSpacing: '0.1em',
                    color: entry.color,
                    textTransform: 'uppercase',
                    fontWeight: 700,
                  }}>
                    {entry.from}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'rgba(255,255,255,0.2)' }}>→</span>
                  <span style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '11px',
                    letterSpacing: '0.1em',
                    color: 'rgba(255,255,255,0.7)',
                    textTransform: 'uppercase',
                    fontWeight: 600,
                  }}>
                    {entry.to}
                  </span>
                  <span style={{
                    marginLeft: 'auto',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '10px',
                    color: 'rgba(255,255,255,0.25)',
                    flexShrink: 0,
                  }}>
                    {time}
                  </span>
                </div>

                {/* Row 2: big bold main value */}
                <div style={{ marginBottom: '8px' }}>
                  {isPayment && entry.amount ? (
                    <span style={{
                      fontFamily: 'var(--font-sans)',
                      fontSize: '22px',
                      fontWeight: 700,
                      color: '#ffffff',
                      letterSpacing: '-0.01em',
                    }}>
                      ${entry.amount} <span style={{ fontSize: '14px', color: '#1aff88', fontWeight: 600 }}>USDC</span>
                    </span>
                  ) : isDelegation ? (
                    <span style={{
                      fontFamily: 'var(--font-sans)',
                      fontSize: '18px',
                      fontWeight: 700,
                      color: '#ffffff',
                    }}>
                      Task delegated
                    </span>
                  ) : (
                    <span style={{
                      fontFamily: 'var(--font-sans)',
                      fontSize: '16px',
                      fontWeight: 600,
                      color: '#ffffff',
                    }}>
                      {entry.message}
                    </span>
                  )}
                </div>

                {/* Row 3: zone route + verify */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '10px',
                    letterSpacing: '0.12em',
                    color: 'rgba(255,255,255,0.3)',
                    textTransform: 'uppercase',
                  }}>
                    {entry.fromZone} → {entry.toZone}
                  </span>
                  {isValidTxHash(entry.txHash) ? (
                    <a
                      href={`${BASESCAN}/${entry.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '10px',
                        letterSpacing: '0.12em',
                        color: 'var(--accent)',
                        textDecoration: 'none',
                        flexShrink: 0,
                        border: '0.5px solid rgba(197,255,43,0.3)',
                        padding: '3px 10px',
                        borderRadius: '2px',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(197,255,43,0.08)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      VERIFY ↗
                    </a>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ── Fixed overlay (original behaviour) ──
  return (
    <div style={{
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      width: '360px',
      maxHeight: '420px',
      zIndex: 50,
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bg)',
      border: '0.5px solid var(--b-lo)',
      borderRadius: '4px',
      overflow: 'hidden',
    }}>

      {/* Header */}
      <div style={{
        padding: '10px 16px',
        borderBottom: '0.5px solid var(--b-lo)',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        flexShrink: 0,
      }}>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '9px',
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.28)',
        }}>
          03 — Comm Log
        </span>
        <span style={{ flex: 1, height: '0.5px', background: 'var(--b-lo)' }} />
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '9px',
          letterSpacing: '0.1em',
          color: 'var(--accent)',
        }}>
          {entries.length}
        </span>
      </div>

      {/* Entries */}
      <div style={{
        overflowY: 'auto',
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
      }}>
        {entries.slice(0, 20).map((entry) => {
          const time = entry.timestamp.toLocaleTimeString('en-US', {
            hour12: false, hour: '2-digit', minute: '2-digit',
          })

          return (
            <div
              key={entry.id}
              style={{
                padding: '10px 16px',
                borderBottom: '0.5px solid rgba(255,255,255,0.03)',
              }}
            >
              {/* From → To + timestamp */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                marginBottom: '4px',
              }}>
                <span style={{
                  width: '5px', height: '5px', borderRadius: '50%',
                  background: entry.color, flexShrink: 0,
                }} />
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '9px',
                  letterSpacing: '0.08em',
                  color: entry.color,
                  textTransform: 'uppercase',
                }}>
                  {entry.from}
                </span>
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '9px',
                  color: 'rgba(255,255,255,0.2)',
                }}>→</span>
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '9px',
                  letterSpacing: '0.08em',
                  color: 'rgba(255,255,255,0.55)',
                  textTransform: 'uppercase',
                }}>
                  {entry.to}
                </span>
                <span style={{
                  marginLeft: 'auto',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '8px',
                  color: 'rgba(255,255,255,0.2)',
                  letterSpacing: '0.06em',
                }}>
                  {time}
                </span>
              </div>

              {/* Message + Basescan link */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
              }}>
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '9px',
                  color: 'rgba(255,255,255,0.42)',
                  letterSpacing: '0.04em',
                }}>
                  {entry.message}
                </span>
                {isValidTxHash(entry.txHash) ? (
                  <a
                    href={`${BASESCAN}/${entry.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '8px',
                      letterSpacing: '0.1em',
                      color: 'var(--accent)',
                      textDecoration: 'none',
                      flexShrink: 0,
                      opacity: 0.8,
                    }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                    onMouseLeave={e => (e.currentTarget.style.opacity = '0.8')}
                  >
                    VERIFY ↗
                  </a>
                ) : null}
              </div>

              {/* Zones */}
              <div style={{
                marginTop: '3px',
                fontFamily: 'var(--font-mono)',
                fontSize: '7px',
                letterSpacing: '0.12em',
                color: 'rgba(255,255,255,0.18)',
                textTransform: 'uppercase',
              }}>
                {entry.fromZone} → {entry.toZone}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
