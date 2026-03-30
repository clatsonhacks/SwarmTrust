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
  agents: AgentInfo[]
  onSpawnAgent?: (capabilities: string[]) => void
}

const CAPABILITY_COLORS: Record<string, string> = {
  NAVIGATE: '#60a5fa',
  SCAN: '#a78bfa',
  LIFT: '#f59e0b',
  CARRY: '#10b981',
}

const CAPABILITY_ICONS: Record<string, string> = {
  NAVIGATE: '🧭',
  SCAN: '📡',
  LIFT: '🏋️',
  CARRY: '📦',
}

const STATE_COLORS = {
  IDLE: '#64748b',
  MOVING: '#60a5fa',
  EXECUTING: '#fbbf24',
  WAITING: '#a78bfa',
  WAITING_PAYMENT: '#f59e0b',
}

export default function AgentInventory({ agents, onSpawnAgent }: AgentInventoryProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)
  const [showSpawnModal, setShowSpawnModal] = useState(false)
  const [selectedCapabilities, setSelectedCapabilities] = useState<string[]>(['NAVIGATE'])

  const agent = selectedAgent ? agents.find((a) => a.robotId === selectedAgent) : null

  const toggleCapability = (cap: string) => {
    if (selectedCapabilities.includes(cap)) {
      setSelectedCapabilities(selectedCapabilities.filter((c) => c !== cap))
    } else {
      setSelectedCapabilities([...selectedCapabilities, cap])
    }
  }

  const handleSpawn = () => {
    if (selectedCapabilities.length > 0 && onSpawnAgent) {
      onSpawnAgent(selectedCapabilities)
      setShowSpawnModal(false)
      setSelectedCapabilities(['NAVIGATE'])
    }
  }

  return (
    <>
      {/* Inventory Toggle Button */}
      <button className="inventory-toggle-btn" onClick={() => setIsOpen(!isOpen)}>
        <span className="inventory-icon">🤖</span>
        <span className="inventory-count">{agents.length}</span>
      </button>

      {/* Inventory Panel */}
      {isOpen && (
        <div className="inventory-overlay" onClick={() => setIsOpen(false)}>
          <div className="inventory-panel" onClick={(e) => e.stopPropagation()}>
            <div className="inventory-header">
              <h2>AGENT INVENTORY</h2>
              <div className="header-actions">
                <button className="spawn-btn" onClick={() => setShowSpawnModal(true)}>
                  + SPAWN AGENT
                </button>
                <button className="close-btn" onClick={() => setIsOpen(false)}>
                  ✕
                </button>
              </div>
            </div>

            <div className="inventory-content">
              {/* Agent Grid */}
              <div className="agent-grid">
                {agents.map((ag) => (
                  <div
                    key={ag.robotId}
                    className={`agent-card ${selectedAgent === ag.robotId ? 'selected' : ''}`}
                    onClick={() => setSelectedAgent(ag.robotId)}
                  >
                    <div className="agent-card-header">
                      <span className="agent-id">{ag.robotId}</span>
                      <span
                        className="agent-state"
                        style={{ background: STATE_COLORS[ag.behaviorState] }}
                      >
                        {ag.behaviorState}
                      </span>
                    </div>

                    <div className="agent-capabilities">
                      {(ag.capabilities || []).map((cap) => (
                        <span
                          key={cap}
                          className="capability-badge"
                          style={{ borderColor: CAPABILITY_COLORS[cap] }}
                        >
                          {CAPABILITY_ICONS[cap]} {cap}
                        </span>
                      ))}
                    </div>

                    <div className="agent-stats">
                      <div className="stat">
                        <span className="stat-label">Reputation</span>
                        <span className="stat-value">{ag.reputationScore}</span>
                      </div>
                      <div className="stat">
                        <span className="stat-label">Balance</span>
                        <span className="stat-value">{parseFloat(ag.usdcBalance).toFixed(2)} USDC</span>
                      </div>
                    </div>

                    {ag.zone && (
                      <div className="agent-zone">
                        📍 {ag.zone}
                      </div>
                    )}
                  </div>
                ))}

                {agents.length === 0 && (
                  <div className="empty-state">
                    <div className="empty-icon">🤖</div>
                    <div className="empty-text">No agents in inventory</div>
                    <button className="empty-spawn-btn" onClick={() => setShowSpawnModal(true)}>
                      Spawn Your First Agent
                    </button>
                  </div>
                )}
              </div>

              {/* Agent Details Panel */}
              {agent && (
                <div className="agent-details">
                  <h3>AGENT DETAILS</h3>

                  <div className="detail-section">
                    <div className="detail-row">
                      <span className="detail-label">Agent ID</span>
                      <span className="detail-value">{agent.robotId}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Status</span>
                      <span
                        className="detail-badge"
                        style={{ background: STATE_COLORS[agent.behaviorState] }}
                      >
                        {agent.behaviorState}
                      </span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Current Task</span>
                      <span className="detail-value">
                        {agent.currentTaskId || 'None'}
                      </span>
                    </div>
                  </div>

                  <div className="detail-section">
                    <div className="detail-row">
                      <span className="detail-label">Position</span>
                      <span className="detail-value mono">
                        X: {agent.position.x.toFixed(1)} Y: {agent.position.y.toFixed(1)} Z: {agent.position.z.toFixed(1)}
                      </span>
                    </div>
                    {agent.zone && (
                      <div className="detail-row">
                        <span className="detail-label">Current Zone</span>
                        <span className="detail-value">{agent.zone}</span>
                      </div>
                    )}
                  </div>

                  <div className="detail-section">
                    <div className="detail-row">
                      <span className="detail-label">Reputation</span>
                      <span className="detail-value">
                        {agent.reputationScore} / 100
                      </span>
                    </div>
                    <div className="reputation-bar">
                      <div
                        className="reputation-fill"
                        style={{ width: `${agent.reputationScore}%` }}
                      />
                    </div>
                  </div>

                  <div className="detail-section">
                    <div className="detail-row">
                      <span className="detail-label">USDC Balance</span>
                      <span className="detail-value usdc">
                        {parseFloat(agent.usdcBalance).toFixed(4)} USDC
                      </span>
                    </div>
                    {agent.walletAddress && (
                      <div className="detail-row">
                        <span className="detail-label">Wallet</span>
                        <span className="detail-value mono small">
                          {agent.walletAddress.slice(0, 6)}...{agent.walletAddress.slice(-4)}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="detail-section">
                    <span className="detail-label">Capabilities</span>
                    <div className="capabilities-list">
                      {(agent.capabilities || []).map((cap) => (
                        <div
                          key={cap}
                          className="capability-item"
                          style={{ borderColor: CAPABILITY_COLORS[cap] }}
                        >
                          <span className="cap-icon">{CAPABILITY_ICONS[cap]}</span>
                          <span className="cap-name">{cap}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Spawn Agent Modal */}
      {showSpawnModal && (
        <div className="spawn-modal-overlay" onClick={() => setShowSpawnModal(false)}>
          <div className="spawn-modal" onClick={(e) => e.stopPropagation()}>
            <h3>SPAWN NEW AGENT</h3>
            <p className="spawn-description">
              Select capabilities for your new agent. Each agent requires at least one capability.
            </p>

            <div className="capability-selector">
              {Object.keys(CAPABILITY_COLORS).map((cap) => (
                <button
                  key={cap}
                  className={`capability-option ${selectedCapabilities.includes(cap) ? 'selected' : ''}`}
                  onClick={() => toggleCapability(cap)}
                  style={{
                    borderColor: selectedCapabilities.includes(cap)
                      ? CAPABILITY_COLORS[cap]
                      : 'rgba(255, 255, 255, 0.2)',
                  }}
                >
                  <span className="cap-icon">{CAPABILITY_ICONS[cap]}</span>
                  <span className="cap-name">{cap}</span>
                </button>
              ))}
            </div>

            <div className="spawn-actions">
              <button className="cancel-btn" onClick={() => setShowSpawnModal(false)}>
                Cancel
              </button>
              <button
                className="confirm-spawn-btn"
                onClick={handleSpawn}
                disabled={selectedCapabilities.length === 0}
              >
                Spawn Agent
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .inventory-toggle-btn {
          position: fixed;
          top: 100px;
          right: 20px;
          width: 60px;
          height: 60px;
          border-radius: 12px;
          background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
          border: 2px solid rgba(139, 92, 246, 0.4);
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
          z-index: 100;
          transition: all 0.3s ease;
        }

        .inventory-toggle-btn:hover {
          border-color: #a78bfa;
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(139, 92, 246, 0.3);
        }

        .inventory-icon {
          font-size: 24px;
        }

        .inventory-count {
          font-size: 11px;
          font-weight: 700;
          color: #a78bfa;
          font-family: var(--font-mono);
        }

        .inventory-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.85);
          backdrop-filter: blur(8px);
          z-index: 150;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: fadeIn 0.2s ease;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        .inventory-panel {
          width: 95%;
          max-width: 1200px;
          max-height: 90vh;
          background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
          border: 2px solid rgba(139, 92, 246, 0.4);
          border-radius: 16px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(40px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .inventory-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 24px;
          border-bottom: 2px solid rgba(139, 92, 246, 0.2);
          background: rgba(139, 92, 246, 0.05);
        }

        .inventory-header h2 {
          font-family: 'Rajdhani', sans-serif;
          font-size: 24px;
          font-weight: 700;
          color: #a78bfa;
          letter-spacing: 2px;
          margin: 0;
        }

        .header-actions {
          display: flex;
          gap: 12px;
          align-items: center;
        }

        .spawn-btn {
          padding: 10px 20px;
          background: linear-gradient(135deg, #a78bfa 0%, #8b5cf6 100%);
          border: none;
          border-radius: 8px;
          color: white;
          font-size: 12px;
          font-weight: 700;
          font-family: 'Rajdhani', sans-serif;
          letter-spacing: 1px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .spawn-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(139, 92, 246, 0.4);
        }

        .close-btn {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: rgba(255, 255, 255, 0.6);
          font-size: 20px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .close-btn:hover {
          background: rgba(255, 85, 85, 0.2);
          border-color: #ff5555;
          color: #ff5555;
        }

        .inventory-content {
          display: flex;
          flex: 1;
          overflow: hidden;
        }

        .agent-grid {
          flex: 1;
          padding: 24px;
          overflow-y: auto;
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 16px;
          align-content: start;
        }

        .agent-card {
          padding: 16px;
          background: rgba(255, 255, 255, 0.03);
          border: 2px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .agent-card:hover {
          background: rgba(255, 255, 255, 0.06);
          border-color: rgba(139, 92, 246, 0.4);
          transform: translateY(-2px);
        }

        .agent-card.selected {
          border-color: #a78bfa;
          background: rgba(139, 92, 246, 0.1);
        }

        .agent-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
        }

        .agent-id {
          font-size: 14px;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.9);
          font-family: var(--font-mono);
        }

        .agent-state {
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 9px;
          font-weight: 700;
          color: white;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .agent-capabilities {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-bottom: 12px;
        }

        .capability-badge {
          padding: 4px 8px;
          border: 1px solid;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.8);
          background: rgba(255, 255, 255, 0.03);
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .agent-stats {
          display: flex;
          gap: 16px;
          padding-top: 12px;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }

        .stat {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .stat-label {
          font-size: 10px;
          color: rgba(255, 255, 255, 0.5);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .stat-value {
          font-size: 13px;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.9);
          font-family: var(--font-mono);
        }

        .agent-zone {
          margin-top: 8px;
          font-size: 11px;
          color: rgba(255, 255, 255, 0.6);
          font-family: var(--font-mono);
        }

        .agent-details {
          width: 350px;
          padding: 24px;
          background: rgba(0, 0, 0, 0.3);
          border-left: 2px solid rgba(255, 255, 255, 0.1);
          overflow-y: auto;
        }

        .agent-details h3 {
          font-family: 'Rajdhani', sans-serif;
          font-size: 18px;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.9);
          margin: 0 0 20px 0;
          text-transform: uppercase;
          letter-spacing: 1.5px;
        }

        .detail-section {
          margin-bottom: 24px;
          padding-bottom: 20px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .detail-section:last-child {
          border-bottom: none;
        }

        .detail-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .detail-label {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.5);
          text-transform: uppercase;
          letter-spacing: 0.8px;
          font-weight: 600;
        }

        .detail-value {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.9);
          font-weight: 600;
        }

        .detail-value.mono {
          font-family: var(--font-mono);
          font-size: 11px;
        }

        .detail-value.small {
          font-size: 11px;
        }

        .detail-value.usdc {
          color: #10b981;
        }

        .detail-badge {
          padding: 4px 10px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 700;
          color: white;
          text-transform: uppercase;
        }

        .reputation-bar {
          width: 100%;
          height: 8px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 4px;
          overflow: hidden;
          margin-top: 8px;
        }

        .reputation-fill {
          height: 100%;
          background: linear-gradient(90deg, #10b981 0%, #34d399 100%);
          transition: width 0.3s ease;
        }

        .capabilities-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-top: 12px;
        }

        .capability-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid;
          border-radius: 6px;
        }

        .cap-icon {
          font-size: 18px;
        }

        .cap-name {
          font-size: 12px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.8);
        }

        .empty-state {
          grid-column: 1 / -1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px 20px;
          gap: 16px;
        }

        .empty-icon {
          font-size: 64px;
          opacity: 0.3;
        }

        .empty-text {
          font-size: 16px;
          color: rgba(255, 255, 255, 0.4);
        }

        .empty-spawn-btn {
          padding: 12px 24px;
          background: linear-gradient(135deg, #a78bfa 0%, #8b5cf6 100%);
          border: none;
          border-radius: 8px;
          color: white;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .empty-spawn-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(139, 92, 246, 0.4);
        }

        .spawn-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.9);
          backdrop-filter: blur(8px);
          z-index: 200;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .spawn-modal {
          width: 90%;
          max-width: 500px;
          padding: 32px;
          background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
          border: 2px solid rgba(139, 92, 246, 0.4);
          border-radius: 16px;
        }

        .spawn-modal h3 {
          font-family: 'Rajdhani', sans-serif;
          font-size: 22px;
          font-weight: 700;
          color: #a78bfa;
          margin: 0 0 12px 0;
          letter-spacing: 1.5px;
        }

        .spawn-description {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.6);
          margin: 0 0 24px 0;
        }

        .capability-selector {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          margin-bottom: 24px;
        }

        .capability-option {
          padding: 16px;
          background: rgba(255, 255, 255, 0.03);
          border: 2px solid;
          border-radius: 10px;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          transition: all 0.2s ease;
        }

        .capability-option:hover {
          background: rgba(255, 255, 255, 0.06);
        }

        .capability-option.selected {
          background: rgba(139, 92, 246, 0.15);
        }

        .spawn-actions {
          display: flex;
          gap: 12px;
        }

        .cancel-btn {
          flex: 1;
          padding: 12px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 8px;
          color: rgba(255, 255, 255, 0.7);
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .cancel-btn:hover {
          background: rgba(255, 255, 255, 0.08);
        }

        .confirm-spawn-btn {
          flex: 1;
          padding: 12px;
          background: linear-gradient(135deg, #a78bfa 0%, #8b5cf6 100%);
          border: none;
          border-radius: 8px;
          color: white;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .confirm-spawn-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(139, 92, 246, 0.4);
        }

        .confirm-spawn-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </>
  )
}
