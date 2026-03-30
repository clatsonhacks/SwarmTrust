'use client'

interface AlertOverlayProps {
  isOpen: boolean
  title: string
  message: string
  icon?: string
  onClose: () => void
}

export default function AlertOverlay({ isOpen, title, message, icon = '⚠️', onClose }: AlertOverlayProps) {
  if (!isOpen) return null

  return (
    <div className="alert-overlay" onClick={onClose}>
      <div className="alert-card" onClick={(e) => e.stopPropagation()}>
        <div className="alert-icon">{icon}</div>
        <div className="alert-title">{title}</div>
        <div className="alert-message">{message}</div>
        <button className="alert-button" onClick={onClose}>
          Acknowledge
        </button>
      </div>

      <style jsx>{`
        .alert-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.92);
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: fadeIn 0.3s ease;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        .alert-card {
          background: linear-gradient(135deg, #1a1f35 0%, #0f1421 100%);
          border: 3px solid #ff4757;
          border-radius: 24px;
          padding: 48px;
          max-width: 600px;
          text-align: center;
          box-shadow: 0 20px 60px rgba(255, 71, 87, 0.3);
          animation: alertPop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }

        @keyframes alertPop {
          from {
            transform: scale(0.8);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }

        .alert-icon {
          font-size: 80px;
          margin-bottom: 24px;
          animation: iconBounce 0.6s ease infinite;
        }

        @keyframes iconBounce {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-10px);
          }
        }

        .alert-title {
          font-family: var(--font-mono);
          font-size: 32px;
          font-weight: 900;
          color: #ff4757;
          margin-bottom: 16px;
          text-transform: uppercase;
          letter-spacing: 3px;
        }

        .alert-message {
          font-size: 18px;
          line-height: 1.6;
          margin-bottom: 32px;
          opacity: 0.9;
          color: #e0e6ed;
        }

        .alert-button {
          font-family: var(--font-mono);
          font-size: 16px;
          font-weight: 700;
          padding: 16px 40px;
          background: #ff4757;
          color: white;
          border: none;
          border-radius: 12px;
          cursor: pointer;
          text-transform: uppercase;
          letter-spacing: 2px;
          transition: all 0.3s ease;
        }

        .alert-button:hover {
          background: #ff6b7a;
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(255, 71, 87, 0.4);
        }

        .alert-button:active {
          transform: translateY(0);
        }
      `}</style>
    </div>
  )
}
