'use client'

/**
 * useBackendApi.ts
 * ────────────────────────────────────────────────────────────────
 * REST API client for interacting with the orchestrator backend.
 * Provides methods to:
 * - Create tasks
 * - Spawn new robot agents
 * - Fetch agent states
 */

import { useState, useCallback } from 'react'
import type { ZoneName as Zone } from './types'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'

export interface CreateTaskPayload {
  description: string
  sourceZone: Zone
  destinationZone: Zone
  priority: 'low' | 'normal' | 'high' | 'urgent'
  assignedTo?: string
}

export interface SpawnAgentPayload {
  capabilities: string[]
  name?: string
}

export interface SpawnAgentResponse {
  robotId: string
  capabilities: string[]
  walletAddress: string
  endpoint: string
  message: string
}

export interface BackendRobotState {
  robotId: string
  position: { x: number; y: number; z: number }
  currentTaskId: string | null
  behaviorState: 'IDLE' | 'MOVING' | 'EXECUTING' | 'WAITING' | 'WAITING_PAYMENT'
  reputationScore: number
  usdcBalance: string
  lastUpdated: number
  capabilities: string[]
}

export function useBackendApi() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createTask = useCallback(async (payload: CreateTaskPayload): Promise<boolean> => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`${API_URL}/api/task`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: payload.description,
          sourceZone: payload.sourceZone,
          destinationZone: payload.destinationZone,
          priority: payload.priority,
          assignedTo: payload.assignedTo,
        }),
      })

      if (!response.ok) {
        throw new Error(`Failed to create task: ${response.statusText}`)
      }

      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(message)
      console.error('Create task error:', err)
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  const spawnAgent = useCallback(
    async (capabilities: string[]): Promise<SpawnAgentResponse | null> => {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch(`${API_URL}/api/spawn-robot`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ capabilities }),
        })

        if (!response.ok) {
          throw new Error(`Failed to spawn agent: ${response.statusText}`)
        }

        const data = await response.json()
        return data as SpawnAgentResponse
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        setError(message)
        console.error('Spawn agent error:', err)
        return null
      } finally {
        setLoading(false)
      }
    },
    []
  )

  const fetchAgentState = useCallback(
    async (robotId: string): Promise<BackendRobotState | null> => {
      setError(null)
      try {
        const response = await fetch(`${API_URL}/api/robot/${robotId}/state`)
        if (!response.ok) {
          throw new Error(`Failed to fetch agent state: ${response.statusText}`)
        }
        const data = await response.json()
        return data as BackendRobotState
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        setError(message)
        console.error('Fetch agent state error:', err)
        return null
      }
    },
    []
  )

  const fetchAllAgents = useCallback(async (): Promise<BackendRobotState[]> => {
    setError(null)
    try {
      const response = await fetch(`${API_URL}/api/robots`)
      if (!response.ok) {
        throw new Error(`Failed to fetch agents: ${response.statusText}`)
      }
      const data = await response.json()
      return data as BackendRobotState[]
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(message)
      console.error('Fetch all agents error:', err)
      return []
    }
  }, [])

  return {
    createTask,
    spawnAgent,
    fetchAgentState,
    fetchAllAgents,
    loading,
    error,
  }
}
