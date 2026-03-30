'use client'

export interface CommEntry {
  id: string
  from: string
  to: string
  fromZone: string
  toZone: string
  message: string
  timestamp: Date
  color: string
}

interface CommunicationLogProps {
  entries: CommEntry[]
}

export default function CommunicationLog({ entries }: CommunicationLogProps) {
  return (
    <div className="comm-log-container">
      <div className="comm-log-header">
        <span className="header-icon">💬</span>
        <span className="header-title">Communication Log</span>
      </div>

      <div className="comm-log-scroll">
        {entries.slice(0, 20).map((entry) => {
          const time = entry.timestamp.toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
          })

          return (
            <div key={entry.id} className="comm-entry">
              <div className="agent-avatar" style={{ background: entry.color }}>
                🤖
              </div>
              <div className="comm-content">
                <div className="comm-header">
                  <span className="agent-name" style={{ color: entry.color }}>
                    {entry.from}
                  </span>
                  <span className="arrow">→</span>
                  <span className="agent-name-receiver">{entry.to}</span>
                  <span className="comm-timestamp">{time}</span>
                </div>
                <div className="comm-message">{entry.message}</div>
                <div className="comm-zones">
                  {entry.fromZone} → {entry.toZone}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <style jsx>{`
        .comm-log-container {
          position: fixed;
          bottom: 20px;
          right: 20px;
          width: 420px;
          max-height: 500px;
          background: transparent;
          z-index: 50;
        }

        .comm-log-header {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 20px;
          background: transparent;
        }

        .header-icon {
          font-size: 18px;
        }

        .header-title {
          font-family: var(--font-mono);
          font-size: 14px;
          font-weight: 700;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          color: #00d4ff;
        }

        .comm-log-scroll {
          height: calc(100% - 52px);
          overflow-y: auto;
          padding: 16px;
          display: flex;
          flex-direction: column-reverse;
          gap: 16px;
        }

        .comm-entry {
          display: flex;
          gap: 12px;
          padding: 14px 16px;
          background: transparent;
          border-radius: 8px;
          animation: slideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);
          transition: all 0.2s ease;
        }

        .comm-entry:hover {
          background: rgba(255, 255, 255, 0.04);
          transform: translateX(4px);
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        .agent-avatar {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          flex-shrink: 0;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        }

        .comm-content {
          flex: 1;
          min-width: 0;
        }

        .comm-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 6px;
          flex-wrap: wrap;
        }

        .agent-name {
          font-size: 15px;
          font-weight: 700;
          font-family: 'Rajdhani', sans-serif;
        }

        .agent-name-receiver {
          font-size: 15px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.8);
        }

        .arrow {
          opacity: 0.4;
          font-size: 14px;
          margin: 0 -2px;
        }

        .comm-timestamp {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.4);
          font-family: var(--font-mono);
          margin-left: auto;
        }

        .comm-message {
          font-size: 15px;
          line-height: 1.5;
          margin-bottom: 6px;
          color: rgba(255, 255, 255, 0.95);
          font-weight: 500;
        }

        .comm-zones {
          font-size: 12px;
          opacity: 0.5;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          font-family: var(--font-mono);
        }

        .comm-log-scroll::-webkit-scrollbar {
          width: 8px;
        }

        .comm-log-scroll::-webkit-scrollbar-track {
          background: transparent;
        }

        .comm-log-scroll::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.15);
          border-radius: 4px;
        }

        .comm-log-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.25);
        }
      `}</style>
    </div>
  )
}
