'use client'

/**
 * useBackendSocket.ts
 * ─────────────────────────────────────────────────────────────
 * Connects to the orchestrator WebSocket (port 8080) and maps
 * incoming backend events to agentStore actions.
 *
 * Reconnects automatically on close/error every 3 seconds.
 * Safe to call in multiple components — only one socket per page
 * since the hook is called once at the page level.
 */

import { useEffect, useRef } from 'react'
import { useAgentStore } from './agentStore'
import type { AgentState } from './types'

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:8080'

// Backend robot ID → frontend agent ID
const ROBOT_TO_AGENT: Record<string, string> = {
  'scout-1':   'R1',
  'lifter-2':  'R2',
  'scout-3':   'R3',
  'carrier-4': 'R4',
  'lifter-5':  'R5',
}

// Backend RobotBehaviorState → frontend AgentState
const STATE_MAP: Record<string, AgentState> = {
  IDLE:            'IDLE',
  MOVING:          'MOVING',
  EXECUTING:       'EXECUTING',
  WAITING:         'IDLE',
  WAITING_PAYMENT: 'DELEGATING',
}

type WsMsg = { type: string; [key: string]: unknown }

export function useBackendSocket() {
  const wsRef            = useRef<WebSocket | null>(null)
  const reconnectRef     = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    function connect() {
      const socket = new WebSocket(WS_URL)
      wsRef.current = socket

      socket.onopen = () => {
        useAgentStore.getState().setConnected(true)
      }

      socket.onmessage = (event: MessageEvent) => {
        let msg: WsMsg
        try {
          msg = JSON.parse(event.data as string) as WsMsg
        } catch {
          return
        }

        const store = useAgentStore.getState()

        switch (msg.type) {

          // Backend publishes RobotEvent with type='STATE_CHANGED'
          case 'STATE_CHANGED': {
            const agentId = ROBOT_TO_AGENT[msg.robotId as string]
            if (!agentId) break
            const state = STATE_MAP[msg.state as string] ?? 'IDLE'
            store.setAgentState(agentId, state, (msg.taskId as string | null) ?? '')
            break
          }

          // Backend publishes RobotEvent with type='TASK_COMPLETED'
          case 'TASK_COMPLETED': {
            const agentId = ROBOT_TO_AGENT[msg.robotId as string]
            if (agentId) store.setAgentState(agentId, 'IDLE', '')
            store.addLog(
              `<b class="acc">✓ DONE</b> · ${msg.robotId} · ${msg.taskId}`,
              'info',
            )
            break
          }

          // Backend publishes RobotEvent with type='PAYMENT_SENT', payload={to, amountUsdc, txHash}
          case 'PAYMENT_SENT': {
            const payload   = msg.payload as { to: string; amountUsdc: string; txHash: string }
            const fromId    = ROBOT_TO_AGENT[msg.robotId as string]
            const toId      = ROBOT_TO_AGENT[payload?.to]
            if (!fromId || !toId) break
            const agents    = store.agents
            const fromAgent = agents.find(a => a.id === fromId)
            const toAgent   = agents.find(a => a.id === toId)
            store.fireBeam(fromId, toId)
            store.addLog(
              `<b class="pay">x402</b> · ` +
              `<b style="color:${fromAgent?.color ?? '#fff'}">${msg.robotId}</b>` +
              ` → <b style="color:${toAgent?.color ?? '#fff'}">${payload.to}</b>` +
              ` · $${payload.amountUsdc} USDC`,
              'payment',
            )
            break
          }

          // Backend publishes RobotEvent with type='REPUTATION_UPDATED', payload={from, delta, txHash}
          case 'REPUTATION_UPDATED': {
            const agentId = ROBOT_TO_AGENT[msg.robotId as string]
            if (!agentId) break
            const payload = msg.payload as { from: string; delta: number; reason?: string }
            const agent   = store.agents.find(a => a.id === agentId)
            if (!agent) break
            const newScore = Math.max(0, Math.min(100, agent.reputation + payload.delta))
            store.setAgentReputation(agentId, newScore)
            store.addLog(
              `<b class="acc">REP</b> · <b>${msg.robotId}</b>` +
              ` ${agent.reputation} → ${newScore}` +
              (payload.delta > 0 ? ` <span style="color:#1aff88">+${payload.delta}</span>` : ` <span style="color:#ff4466">${payload.delta}</span>`),
              'chain',
            )
            break
          }

          // Orchestrator sends SESSION_STATS directly as a proper WsSessionStats
          case 'SESSION_STATS': {
            const stats = msg.stats as {
              tasksCompleted: number
              totalUsdcTransferred: string
              onChainTransactionCount: number
            }
            store.updateStats({
              tasksDone: stats.tasksCompleted,
              totalUSDC: parseFloat(stats.totalUsdcTransferred),
              totalTx:   stats.onChainTransactionCount,
            })
            break
          }
        }
      }

      socket.onclose = () => {
        useAgentStore.getState().setConnected(false)
        reconnectRef.current = setTimeout(connect, 3000)
      }

      socket.onerror = () => {
        socket.close()
      }
    }

    connect()

    return () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current)
      wsRef.current?.close()
    }
  }, [])
}
