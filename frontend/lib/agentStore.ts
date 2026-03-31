/**
 * agentStore.ts
 * ─────────────────────────────────────────────────────────────
 * Zustand store that drives the entire agent simulation.
 * The Three.js scene reads from here every frame via useAgentStore().
 *
 * Why Zustand?
 *   • Zero boilerplate vs Redux
 *   • Works with R3F's useFrame outside React render cycle
 *   • Selector-based — components only re-render when their slice changes
 */

import { create } from 'zustand'
import type {
  AgentRuntime, AgentState, LogEntry, ZoneName, ZoneDef, AgentDef,
  ViewState, DepartmentConfig,
} from './types'

// ── Zone layout (world coordinates) ──────────────────────────────
export const ZONES: Record<ZoneName, ZoneDef> = {
  INTAKE:   { name:'INTAKE',   x:-13, z:-9,  w:10, d:8, color:'#0d2a1a', glow:'#1aff88' },
  STORAGE:  { name:'STORAGE',  x:  3, z:-9,  w:11, d:8, color:'#0a1a2e', glow:'#5cc8ff' },
  STAGING:  { name:'STAGING',  x:-13, z: 4,  w:10, d:8, color:'#2a2010', glow:'#ffcc44' },
  DISPATCH: { name:'DISPATCH', x:  3, z: 4,  w:11, d:8, color:'#2a0e0e', glow:'#ff5566' },
}

// ── Department configurations (per-department models) ───────────────
// Agent models as specified by user:
// - box-02_robot → INTAKE
// - turret_droid → STORAGE
// - combat_steampunk_robot → STAGING
// - nora (Object_204) → DISPATCH
export const DEPARTMENT_CONFIGS: Record<ZoneName, DepartmentConfig> = {
  INTAKE: {
    name: 'INTAKE',
    title: 'Intake Bay',
    description: 'Receiving and initial processing of incoming goods',
    agentModel: '/models/box-02_robot.glb',
    environmentModel: '/models/21948_autosave.gltf',
    color: '#0d2a1a',
    glow: '#1aff88',
    agentIds: ['R1', 'R5'],
    agentScale: 55,
    // From Blender camera: CAM_Intake_Bay
    cameraPos: [0, 6, 7.59] as [number, number, number],
    cameraTarget: [0, 3, 0] as [number, number, number],
  },
  STORAGE: {
    name: 'STORAGE',
    title: 'Storage Vault',
    description: 'Long-term inventory management and organization',
    agentModel: '/models/turret_droid.glb',
    environmentModel: '/models/21948_autosave.gltf',
    color: '#0a1a2e',
    glow: '#5cc8ff',
    agentIds: ['R2'],
    agentScale: 1.0,
    // From Blender camera: CAM_Storage
    cameraPos: [41.64, 8, 0] as [number, number, number],
    cameraTarget: [30, 3, 0] as [number, number, number],
  },
  STAGING: {
    name: 'STAGING',
    title: 'Staging Area',
    description: 'Order preparation and quality verification',
    agentModel: '/models/combat_steampunk_robot.glb',
    environmentModel: '/models/21948_autosave.gltf',
    color: '#2a2010',
    glow: '#ffcc44',
    agentIds: ['R3'],
    agentScale: 1.0,
    // From Blender camera: CAM_Charging_Station (better positioned inside warehouse)
    cameraPos: [30.63, 6, 57.73] as [number, number, number],
    cameraTarget: [20, 3, 45] as [number, number, number],
  },
  DISPATCH: {
    name: 'DISPATCH',
    title: 'Dispatch Hub',
    description: 'Final processing and shipment coordination',
    agentModel: '/models/bee.glb',
    environmentModel: '/models/21948_autosave.gltf',
    color: '#2a0e0e',
    glow: '#ff5566',
    agentIds: ['R4'],
    agentScale: 0.8,
    // From Blender camera: CAM_Dispatch
    cameraPos: [-21.17, 6, 14.26] as [number, number, number],
    cameraTarget: [-15, 3, 5] as [number, number, number],
  },
}

// ── Initial agent definitions ──────────────────────────────────
const AGENT_DEFS: AgentDef[] = [
  { id:'R1', name:'Scout-1',   type:'SCOUT',   color:'#5cc8ff', zone:'INTAKE',   reputation:94 },
  { id:'R2', name:'Lifter-1',  type:'LIFTER',  color:'#c5ff2b', zone:'STORAGE',  reputation:87 },
  { id:'R3', name:'Scout-2',   type:'SCOUT',   color:'#cc44ff', zone:'STAGING',  reputation:91 },
  { id:'R4', name:'Carrier-1', type:'CARRIER', color:'#ff9b2b', zone:'DISPATCH', reputation:82 },
  { id:'R5', name:'Lifter-2',  type:'LIFTER',  color:'#ff4466', zone:'INTAKE',   reputation:78 },
]

const TASKS = [
  'Move pallet INTAKE → STORAGE',
  'Scan shelves in STAGING',
  'Transport STORAGE → DISPATCH',
  'Inventory check INTAKE',
  'Route pallet STAGING → DISPATCH',
  'Quality scan STORAGE',
  'Emergency reroute INTAKE → DISPATCH',
  'Multi-zone sweep',
]

// ── Helpers ───────────────────────────────────────────────────
function rand(a: number, b: number) { return a + Math.random() * (b - a) }

function zoneCentre(z: ZoneDef): [number, number, number] {
  return [z.x + z.w / 2 + rand(-2, 2), 0, z.z + z.d / 2 + rand(-2, 2)]
}

function pickZone(exclude?: ZoneName): ZoneName {
  const keys = (Object.keys(ZONES) as ZoneName[]).filter(k => k !== exclude)
  return keys[Math.floor(Math.random() * keys.length)]
}

function initAgent(def: AgentDef, idx: number): AgentRuntime {
  const z0 = ZONES[def.zone]
  const pos = zoneCentre(z0)
  return {
    ...def,
    state:     'IDLE',
    task:      '',
    target:    pos,
    position:  pos,
    waitTimer: rand(1, 4) + idx * 0.5,
    taskTimer: 0,
    phase:     idx * 1.3,
  }
}

// ── Store interface ───────────────────────────────────────────
// Visual communication between agents
export interface ActiveComm {
  id: number
  fromId: string
  toId: string
  message: string
  startTime: number
}

// Task management
// Zone type for task creation (includes all backend zones)
export type Zone = 'INTAKE' | 'STORAGE' | 'SORTING' | 'STAGING' | 'DISPATCH' | 'CHARGING'

export interface Task {
  taskId: string
  description: string
  sourceZone: Zone
  destinationZone: Zone
  priority: 'low' | 'normal' | 'high' | 'urgent'
  assignedTo?: string
  status: 'pending' | 'executing' | 'completed' | 'failed'
  createdAt: Date
}

// Agent inventory (backend robot data)
export interface AgentInventoryItem {
  robotId: string
  capabilities: string[]
  position: { x: number; y: number; z: number }
  behaviorState: 'IDLE' | 'MOVING' | 'EXECUTING' | 'WAITING' | 'WAITING_PAYMENT'
  currentTaskId: string | null
  reputationScore: number
  usdcBalance: string
  zone?: ZoneName
  walletAddress?: string
  lastUpdated: number
}

interface SimStore {
  agents:        AgentRuntime[]
  log:           LogEntry[]
  tasksDone:     number
  totalUSDC:     number
  totalTx:       number
  meetingActive: boolean
  nextMeeting:   number
  simTime:       number    // seconds since start
  connected:     boolean   // true when live backend WebSocket is connected

  // Beams: [fromId, toId, progress 0-1]
  activeBeams:   Array<{ id:number, from:string, to:string, progress:number }>

  // Active communications (for 3D speech bubbles)
  activeComms:   ActiveComm[]

  // View state for department navigation
  currentView:   ViewState

  // Task management
  tasks:         Task[]

  // Agent inventory
  agentInventory: AgentInventoryItem[]

  // Actions called from the animation loop
  tick:           (dt: number) => void
  triggerMeeting: () => void
  endMeeting:     () => void
  addLog:         (msg: string, type?: LogEntry['type']) => void
  fireBeam:       (fromId: string, toId: string) => void
  setView:        (view: ViewState) => void
  getDepartmentAgents: (dept: ZoneName) => AgentRuntime[]

  // Communication actions
  startComm:      (fromId: string, toId: string, message: string) => void
  endComm:        (commId: number) => void

  // Actions driven by the live backend (called from useBackendSocket)
  setConnected:      (v: boolean) => void
  setAgentState:     (agentId: string, state: AgentState, task: string) => void
  setAgentTask:      (agentId: string, task: string) => void
  setAgentReputation:(agentId: string, score: number) => void
  updateStats:       (stats: { tasksDone: number; totalUSDC: number; totalTx: number }) => void

  // Task management actions
  addTask:           (task: Task) => void
  updateTaskStatus:  (taskId: string, status: Task['status']) => void
  removeTask:        (taskId: string) => void

  // Agent inventory actions
  setAgentInventory: (agents: AgentInventoryItem[]) => void
  updateAgentInventoryItem: (robotId: string, updates: Partial<AgentInventoryItem>) => void
  addAgentToInventory: (agent: AgentInventoryItem) => void
}

let logCounter = 0
let beamCounter = 0
let commCounter = 0

export const useAgentStore = create<SimStore>((set, get) => ({
  agents:        AGENT_DEFS.map((d, i) => initAgent(d, i)),
  log:           [],
  tasksDone:     0,
  totalUSDC:     0,
  totalTx:       0,
  meetingActive: false,
  nextMeeting:   rand(20, 35),
  simTime:       0,
  activeBeams:   [],
  activeComms:   [],
  currentView:   'OVERVIEW',
  connected:     false,
  tasks:         [],
  agentInventory: [],

  setView(view: ViewState) {
    set({ currentView: view })
  },

  getDepartmentAgents(dept: ZoneName) {
    const config = DEPARTMENT_CONFIGS[dept]
    return get().agents.filter(a => config.agentIds.includes(a.id))
  },

  // ── Live backend actions ──────────────────────────────────────

  setConnected(v: boolean) {
    set({ connected: v })
  },

  setAgentState(agentId: string, state: AgentState, task: string) {
    set(st => ({
      agents: st.agents.map(a => {
        if (a.id !== agentId) return a
        // Pick a new zone target so the 3D agent actually moves
        const newZone   = state === 'IDLE' ? a.zone : pickZone(a.zone as ZoneName)
        const newTarget = state === 'IDLE' ? a.target : zoneCentre(ZONES[newZone])
        return { ...a, state, task, zone: newZone, target: newTarget }
      }),
    }))
  },

  setAgentTask(agentId: string, task: string) {
    set(st => ({
      agents: st.agents.map(a => a.id === agentId ? { ...a, task } : a),
    }))
  },

  setAgentReputation(agentId: string, score: number) {
    set(st => ({
      agents: st.agents.map(a => a.id === agentId ? { ...a, reputation: score } : a),
    }))
  },

  updateStats({ tasksDone, totalUSDC, totalTx }) {
    set({ tasksDone, totalUSDC, totalTx })
  },

  // ── Task management actions ───────────────────────────────────

  addTask(task: Task) {
    set(st => ({ tasks: [task, ...st.tasks] }))
  },

  updateTaskStatus(taskId: string, status: Task['status']) {
    set(st => ({
      tasks: st.tasks.map(t => t.taskId === taskId ? { ...t, status } : t)
    }))
  },

  removeTask(taskId: string) {
    set(st => ({ tasks: st.tasks.filter(t => t.taskId !== taskId) }))
  },

  // ── Agent inventory actions ───────────────────────────────────

  setAgentInventory(agents: AgentInventoryItem[]) {
    set({ agentInventory: agents })
  },

  updateAgentInventoryItem(robotId: string, updates: Partial<AgentInventoryItem>) {
    set(st => ({
      agentInventory: st.agentInventory.map(a =>
        a.robotId === robotId ? { ...a, ...updates } : a
      )
    }))
  },

  addAgentToInventory(agent: AgentInventoryItem) {
    set(st => ({ agentInventory: [...st.agentInventory, agent] }))
  },

  addLog(msg, type = 'info') {
    const { simTime } = get()
    const m = Math.floor(simTime / 60)
    const s = Math.floor(simTime % 60)
    const ts = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
    set(st => ({
      log: [{ id: ++logCounter, timestamp: ts, message: msg, type }, ...st.log].slice(0, 50)
    }))
  },

  fireBeam(fromId, toId) {
    const beam = { id: ++beamCounter, from: fromId, to: toId, progress: 0 }
    set(st => ({ activeBeams: [...st.activeBeams, beam] }))
    // advance beam progress over ~1 second in tick()
  },

  startComm(fromId: string, toId: string, message: string) {
    const comm: ActiveComm = {
      id: ++commCounter,
      fromId,
      toId,
      message,
      startTime: Date.now()
    }
    set(st => ({ activeComms: [...st.activeComms, comm] }))
  },

  endComm(commId: number) {
    set(st => ({
      activeComms: st.activeComms.filter(c => c.id !== commId)
    }))
  },

  triggerMeeting() {
    const { agents, addLog } = get()
    addLog(`<b class="acc">◈ SWARM SCRUM</b> — All agents converging`, 'meeting')
    const newAgents = agents.map((a, i) => {
      const angle = (i / agents.length) * Math.PI * 2
      const target: [number, number, number] = [
        Math.cos(angle) * 3,
        0,
        Math.sin(angle) * 3,
      ]
      return { ...a, state: 'MEETING' as AgentState, target, task: 'SCRUM' }
    })
    set({ meetingActive: true, agents: newAgents })
  },

  endMeeting() {
    const { agents, addLog } = get()
    addLog(`<b class="acc">◈ Scrum complete</b> — agents resuming`, 'meeting')
    const newAgents = agents.map(a => ({
      ...a,
      state:     'IDLE' as AgentState,
      task:      '',
      waitTimer: rand(1, 3),
    }))
    set({
      meetingActive: false,
      nextMeeting:   rand(25, 45),
      agents:        newAgents,
    })
  },

  tick(dt: number) {
    const st = get()
    const newTime = st.simTime + dt
    // When the live backend is connected, skip the fake state machine —
    // state/task/stats come from WebSocket events instead.
    if (st.connected) {
      const newBeams = st.activeBeams
        .map(b => ({ ...b, progress: b.progress + dt * 0.9 }))
        .filter(b => b.progress < 1)
      const newAgents = st.agents.map(agent => {
        const dx = agent.target[0] - agent.position[0]
        const dz = agent.target[2] - agent.position[2]
        const d  = Math.sqrt(dx * dx + dz * dz)
        const speed = agent.type === 'SCOUT' ? 4.5 : agent.type === 'CARRIER' ? 3.8 : 3.2
        const newPos: [number, number, number] = d > 0.12
          ? [agent.position[0] + (dx/d)*speed*dt, 0, agent.position[2] + (dz/d)*speed*dt]
          : agent.target
        return { ...agent, position: newPos }
      })
      set({ simTime: newTime, activeBeams: newBeams, agents: newAgents })
      return
    }

    // ── advance beams ──────────────────────────────────
    const newBeams = st.activeBeams
      .map(b => ({ ...b, progress: b.progress + dt * 0.9 }))
      .filter(b => b.progress < 1)

    // ── agent AI ──────────────────────────────────────
    let tasksDelta  = 0
    let usdcDelta   = 0
    let txDelta     = 0

    const newAgents = st.agents.map(agent => {
      if (agent.state === 'MEETING') {
        // just move toward meeting target
        const dx = agent.target[0] - agent.position[0]
        const dz = agent.target[2] - agent.position[2]
        const d  = Math.sqrt(dx * dx + dz * dz)
        const speed = 3.5
        const newPos: [number, number, number] = d > 0.15
          ? [agent.position[0] + (dx/d)*speed*dt, 0, agent.position[2] + (dz/d)*speed*dt]
          : agent.target
        return { ...agent, position: newPos }
      }

      // move toward target
      const dx = agent.target[0] - agent.position[0]
      const dz = agent.target[2] - agent.position[2]
      const d  = Math.sqrt(dx * dx + dz * dz)
      const speed = agent.type === 'SCOUT' ? 4.5 : agent.type === 'CARRIER' ? 3.8 : 3.2
      const newPos: [number, number, number] = d > 0.12
        ? [agent.position[0] + (dx/d)*speed*dt, 0, agent.position[2] + (dz/d)*speed*dt]
        : agent.target

      let newState     = agent.state
      let newTask      = agent.task
      let newWait      = agent.waitTimer - dt
      let newTaskTimer = agent.taskTimer - dt
      let newTarget    = agent.target
      let newZone      = agent.zone as ZoneName
      let newRep       = agent.reputation

      // ── state transitions ────────────────────────
      if (agent.state === 'IDLE' && newWait <= 0) {
        const task    = TASKS[Math.floor(Math.random() * TASKS.length)]
        newZone       = pickZone(agent.zone as ZoneName)
        newTarget     = zoneCentre(ZONES[newZone])
        newTask       = task
        newState      = 'MOVING'
        newTaskTimer  = rand(5, 12)
        get().addLog(
          `<b style="color:${agent.color}">${agent.name}</b> → <b class="acc">${newZone}</b> · "${task}"`,
          'info'
        )

      } else if (agent.state === 'MOVING' && d < 0.25) {
        newState = 'EXECUTING'
        newTaskTimer = rand(3, 7)
        get().addLog(
          `<b style="color:${agent.color}">${agent.name}</b> executing at <b class="acc">${newZone}</b>`,
          'info'
        )

      } else if (agent.state === 'EXECUTING' && newTaskTimer <= 0) {
        // chance to delegate (payment beam)
        if (Math.random() < 0.45) {
          const peers = st.agents.filter(
            a => a.id !== agent.id && a.reputation >= 75 && a.state !== 'MEETING'
          )
          if (peers.length) {
            const peer   = peers[Math.floor(Math.random() * peers.length)]
            const amount = +(rand(0.005, 0.025)).toFixed(4)
            usdcDelta   += amount
            txDelta     += 1
            newRep       = Math.min(100, agent.reputation + Math.floor(Math.random()*2))
            get().fireBeam(agent.id, peer.id)
            get().addLog(
              `<b class="pay">x402</b> · <b style="color:${agent.color}">${agent.name}</b>` +
              ` → <b style="color:${peer.color}">${peer.name}</b> · $${amount} USDC`,
              'payment'
            )
            tasksDelta += 1
          }
        }
        newState = 'IDLE'
        newTask  = ''
        newWait  = rand(1.5, 4)
      }

      return {
        ...agent,
        state:      newState,
        task:       newTask,
        waitTimer:  newWait,
        taskTimer:  newTaskTimer,
        target:     newTarget,
        position:   newPos,
        zone:       newZone,
        reputation: newRep,
      }
    })

    // ── meeting trigger ────────────────────────────
    const newNextMeeting = st.nextMeeting - dt
    if (!st.meetingActive && newNextMeeting <= 0) {
      get().triggerMeeting()
    }

    // ── scrum reports (10s into meeting) ──────────
    // handled via useEffect in WarehouseScene based on meetingActive change

    set({
      agents:        newAgents,
      simTime:       newTime,
      activeBeams:   newBeams,
      tasksDone:     st.tasksDone  + tasksDelta,
      totalUSDC:     st.totalUSDC  + usdcDelta,
      totalTx:       st.totalTx    + txDelta,
      nextMeeting:   Math.max(newNextMeeting, 0),
    })
  },
}))
