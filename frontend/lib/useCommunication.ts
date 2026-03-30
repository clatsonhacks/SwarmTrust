'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAgentStore } from './agentStore'
import type { CommEntry } from '@/components/ui/CommunicationLog'
import type { Toast } from '@/components/ui/ToastNotification'

const COMM_INTERVAL = { min: 4000, max: 8000 }
const COMM_DURATION = 2000

const COMM_MESSAGES = [
  'Status update transmitted',
  'Zone coordination sync',
  'Resource allocation request',
  'Task priority notification',
  'System health check',
  'Inventory data exchange',
  'Operational status confirmed',
  'Cross-zone handoff initiated',
  'Emergency protocol ready',
  'Swarm intelligence sync',
]

export function useCommunication() {
  const [commLog, setCommLog] = useState<CommEntry[]>([])
  const [toasts, setToasts] = useState<Toast[]>([])
  const agents = useAgentStore((s) => s.agents)
  const setAgentState = useAgentStore((s) => s.setAgentState)

  const startComm = useAgentStore((s) => s.startComm)
  const endComm = useAgentStore((s) => s.endComm)

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random()}`
    setToasts((prev) => [...prev, { ...toast, id }])
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const initiateComm = useCallback(() => {
    if (agents.length < 2) return

    // Pick two random agents from different zones
    const agent1 = agents[Math.floor(Math.random() * agents.length)]
    let agent2 = agents[Math.floor(Math.random() * agents.length)]

    // Ensure they're from different zones
    let attempts = 0
    while (agent2.zone === agent1.zone && attempts < 10) {
      agent2 = agents[Math.floor(Math.random() * agents.length)]
      attempts++
    }

    if (agent2.zone === agent1.zone) return // Give up if we can't find different zones

    // Random message
    const message = COMM_MESSAGES[Math.floor(Math.random() * COMM_MESSAGES.length)]

    // Set both agents to COMMUNICATING
    setAgentState(agent1.id, 'COMMUNICATING', message)
    setAgentState(agent2.id, 'COMMUNICATING', message)

    // Create visual communication in 3D scene
    startComm(agent1.id, agent2.id, message)

    // Create log entry
    const entry: CommEntry = {
      id: `comm-${Date.now()}-${Math.random()}`,
      from: agent1.name,
      to: agent2.name,
      fromZone: agent1.zone,
      toZone: agent2.zone,
      message,
      timestamp: new Date(),
      color: agent1.color,
    }

    setCommLog((prev) => [entry, ...prev])

    // Show toast
    addToast({
      from: agent1.name,
      to: agent2.name,
      fromZone: agent1.zone,
      toZone: agent2.zone,
      message,
      color: agent1.color,
    })

    // Resume after COMM_DURATION
    setTimeout(() => {
      setAgentState(agent1.id, 'IDLE', '')
      setAgentState(agent2.id, 'IDLE', '')
      // Note: speech bubbles auto-remove via their duration prop
    }, COMM_DURATION)
  }, [agents, setAgentState, addToast, startComm])

  // Schedule communications
  useEffect(() => {
    const scheduleNext = () => {
      const delay = COMM_INTERVAL.min + Math.random() * (COMM_INTERVAL.max - COMM_INTERVAL.min)
      return setTimeout(() => {
        initiateComm()
        scheduleNext()
      }, delay)
    }

    const timer = scheduleNext()
    return () => clearTimeout(timer)
  }, [initiateComm])

  return {
    commLog,
    toasts,
    removeToast,
  }
}
