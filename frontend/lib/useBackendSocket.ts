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

// Robot display colors
const ROBOT_COLOR: Record<string, string> = {
  'scout-1':   '#5cc8ff',
  'lifter-2':  '#c5ff2b',
  'scout-3':   '#cc44ff',
  'carrier-4': '#ff9b2b',
  'lifter-5':  '#ff4466',
}

// State → human label + color
const STATE_LABEL: Record<string, { label: string; color: string }> = {
  IDLE:            { label: 'standing by',        color: 'rgba(255,255,255,0.4)' },
  MOVING:          { label: 'navigating',          color: '#5cc8ff' },
  EXECUTING:       { label: 'executing task',      color: '#ff9b2b' },
  WAITING:         { label: 'waiting',             color: '#cc44ff' },
  WAITING_PAYMENT: { label: 'awaiting payment',    color: '#ff9b2b' },
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
  // Track last logged state per robot to suppress duplicate state-change logs
  const lastStateRef     = useRef<Map<string, string>>(new Map())

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

          // Backend publishes RobotEvent with type='ROBOT_POSITION_UPDATE'
          case 'ROBOT_POSITION_UPDATE': {
            const robotId = msg.robotId as string
            const position = msg.position as { x: number; y: number; z: number }
            store.updateAgentInventoryItem(robotId, { position, lastUpdated: Date.now() })
            break
          }

          // Backend publishes RobotEvent with type='STATE_CHANGED'
          case 'ROBOT_STATE_CHANGE':
          case 'STATE_CHANGED': {
            const robotId = msg.robotId as string
            const agentId = ROBOT_TO_AGENT[robotId]
            const backendState = msg.state as string
            const behaviorState = backendState as any
            const taskId = (msg.taskId as string | null) ?? null
            const rc = ROBOT_COLOR[robotId] ?? '#ffffff'
            const sl = STATE_LABEL[backendState]

            // Update inventory
            store.updateAgentInventoryItem(robotId, {
              behaviorState,
              currentTaskId: taskId,
              lastUpdated: Date.now()
            })

            // Update 3D agents if mapped
            if (agentId) {
              const state = STATE_MAP[backendState] ?? 'IDLE'
              store.setAgentState(agentId, state, taskId ?? '')
            }

            // Log meaningful state transitions — deduplicate same state per robot
            const lastState = lastStateRef.current.get(robotId)
            const stateKey = `${backendState}:${taskId ?? ''}`
            if (backendState !== 'IDLE' && sl && stateKey !== lastState) {
              lastStateRef.current.set(robotId, stateKey)
              store.addLog(
                `<b style="color:${rc}">${robotId}</b>` +
                ` · <span style="color:${sl.color}">${sl.label}</span>` +
                (taskId ? ` · <span style="color:rgba(255,255,255,0.35)">${taskId}</span>` : ''),
                'info',
              )
            }
            break
          }

          // Backend publishes RobotEvent with type='TASK_ASSIGNED'
          case 'TASK_ASSIGNED': {
            const taskId = msg.taskId as string
            const robotId = msg.robotId as string
            const rc = ROBOT_COLOR[robotId] ?? '#ffffff'
            store.updateTaskStatus(taskId, 'executing')
            store.addLog(
              `<b class="acc">TASK</b>` +
              ` · <b style="color:${rc}">${robotId}</b>` +
              ` picked up <span style="color:rgba(255,255,255,0.5)">${taskId}</span>`,
              'info',
            )
            break
          }

          // Backend publishes RobotEvent with type='TASK_COMPLETED'
          case 'TASK_COMPLETE':
          case 'TASK_COMPLETED': {
            const robotId = msg.robotId as string
            const taskId = msg.taskId as string
            const agentId = ROBOT_TO_AGENT[robotId]
            const rc = ROBOT_COLOR[robotId] ?? '#ffffff'

            if (agentId) store.setAgentState(agentId, 'IDLE', '')
            store.updateTaskStatus(taskId, 'completed')
            store.addLog(
              `<b style="color:#1aff88">✓ COMPLETE</b>` +
              ` · <b style="color:${rc}">${robotId}</b>` +
              ` · <span style="color:rgba(255,255,255,0.4)">${taskId}</span>`,
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
              payload.txHash,
            )
            break
          }

          // Backend publishes RobotEvent with type='PAYMENT_RECEIVED', payload={from, amountUsdc, txHash}
          case 'PAYMENT_RECEIVED': {
            const payload  = msg.payload as { from: string; amountUsdc: string; txHash: string }
            const toAgent  = store.agents.find(a => a.id === ROBOT_TO_AGENT[msg.robotId as string])
            store.addLog(
              `<b class="pay">x402</b> · ` +
              `<b style="color:rgba(255,255,255,0.7)">${payload.from.slice(0, 6)}…${payload.from.slice(-4)}</b>` +
              ` → <b style="color:${toAgent?.color ?? '#fff'}">${msg.robotId}</b>` +
              ` · $${payload.amountUsdc} USDC`,
              'payment',
              payload.txHash,
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

          // Backend publishes when a new robot is spawned
          case 'ROBOT_SPAWNED': {
            const robot = msg.robot as {
              robotId: string
              capabilities: string[]
              walletAddress: string
              endpoint: string
            }
            store.addAgentToInventory({
              robotId: robot.robotId,
              capabilities: robot.capabilities,
              position: { x: 0, y: 0, z: 0 },
              behaviorState: 'IDLE',
              currentTaskId: null,
              reputationScore: 85,
              usdcBalance: '1.0',
              walletAddress: robot.walletAddress,
              lastUpdated: Date.now()
            })
            store.addLog(
              `<b class="acc">🤖 SPAWNED</b> · ${robot.robotId} · [${robot.capabilities.join(', ')}]`,
              'info',
            )
            break
          }

          // Peer delegation events (for communication log)
          case 'PEER_DELEGATION': {
            const fromRobotId = msg.robotId as string
            const payload = msg.payload as { to: string; subTaskId: string; capability: string }
            const toRobotId = payload?.to

            if (fromRobotId && toRobotId) {
              store.addLog(
                `<b class="pay">DELEGATE</b> · <b>${fromRobotId}</b> → <b>${toRobotId}</b> · ${payload.capability}`,
                'payment',
              )
            }
            break
          }

          // Log entry events
          case 'LOG_ENTRY': {
            const logMsg = msg.message as string
            const logType = (msg.logType as string || 'info') as any
            if (logMsg) {
              store.addLog(logMsg, logType)
            }
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
