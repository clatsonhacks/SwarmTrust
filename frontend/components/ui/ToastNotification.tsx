'use client'

import { useEffect, useState } from 'react'

export interface Toast {
  id: string
  from: string
  to: string
  fromZone: string
  toZone: string
  message: string
  color: string
}

interface ToastNotificationProps {
  toast: Toast
  onDismiss: (id: string) => void
}

export default function ToastNotification({ toast, onDismiss }: ToastNotificationProps) {
  const [isExiting, setIsExiting] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsExiting(true)
      setTimeout(() => onDismiss(toast.id), 300)
    }, 4000)

    return () => clearTimeout(timer)
  }, [toast.id, onDismiss])

  return (
    <div
      className={`toast ${isExiting ? 'toast-exit' : ''}`}
      style={{ borderLeftColor: toast.color }}
      onClick={() => {
        setIsExiting(true)
        setTimeout(() => onDismiss(toast.id), 300)
      }}
    >
      <div className="toast-header" style={{ color: toast.color }}>
        📡 Communication Initiated
      </div>
      <div className="toast-body">
        <strong>{toast.from}</strong> ↔ <strong>{toast.to}</strong>
        <div className="toast-zones">
          {toast.fromZone} → {toast.toZone}
        </div>
      </div>

      <style jsx>{`
        .toast {
          background: rgba(10, 14, 26, 0.95);
          backdrop-filter: blur(16px);
          padding: 16px;
          border-radius: 12px;
          border-left: 4px solid;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
          animation: toastSlide 0.4s ease;
          cursor: pointer;
          transition: transform 0.2s ease;
          max-width: 360px;
        }

        .toast:hover {
          transform: translateX(4px);
        }

        .toast-exit {
          animation: toastSlideOut 0.3s ease forwards;
        }

        @keyframes toastSlide {
          from {
            opacity: 0;
            transform: translateX(-100px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes toastSlideOut {
          to {
            opacity: 0;
            transform: translateX(-100px);
          }
        }

        .toast-header {
          font-weight: 700;
          font-size: 13px;
          margin-bottom: 8px;
          text-transform: uppercase;
          letter-spacing: 1px;
          font-family: var(--font-mono);
        }

        .toast-body {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.9);
        }

        .toast-body strong {
          color: white;
        }

        .toast-zones {
          font-size: 11px;
          margin-top: 4px;
          opacity: 0.7;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
      `}</style>
    </div>
  )
}
