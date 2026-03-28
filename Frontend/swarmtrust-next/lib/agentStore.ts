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
export const DEPARTMENT_CONFIGS: Record<ZoneName, DepartmentConfig> = {
  INTAKE: {
    name: 'INTAKE',
    title: 'Intake Bay',
    description: 'Receiving and initial processing of incoming goods',
    agentModel: '/models/box-02_robot.glb',
    environmentModel: '/models/warehouse.glb',
    color: '#0d2a1a',
    glow: '#1aff88',
    agentIds: ['R1', 'R5'],
    agentScale: 15,    // Larger model
  },
  STORAGE: {
    name: 'STORAGE',
    title: 'Storage Vault',
    description: 'Long-term inventory management and organization',
    agentModel: '/models/monowheel_bot__vgdc.glb',
    environmentModel: '/models/warehouse.glb',
    color: '#0a1a2e',
    glow: '#5cc8ff',
    agentIds: ['R2'],
    agentScale: 15,    // Larger model
  },
  STAGING: {
    name: 'STAGING',
    title: 'Staging Area',
    description: 'Order preparation and quality verification',
    agentModel: '/models/turret_droid.glb',
    environmentModel: '/models/warehouse.glb',
    color: '#2a2010',
    glow: '#ffcc44',
    agentIds: ['R3'],
    agentScale: 0.55,    // Medium model
  },
  DISPATCH: {
    name: 'DISPATCH',
    title: 'Dispatch Hub',
    description: 'Final processing and shipment coordination',
    agentModel: '/models/nora.glb',
    environmentModel: '/models/warehouse.glb',
    color: '#2a0e0e',
    glow: '#ff5566',
    agentIds: ['R4'],
    outdoor: true,
    agentScale: 0.10,    // Smaller model
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
interface SimStore {
  agents:        AgentRuntime[]
  log:           LogEntry[]
  tasksDone:     number
  totalUSDC:     number
  totalTx:       number
  meetingActive: boolean
  nextMeeting:   number
  simTime:       number    // seconds since start

  // Beams: [fromId, toId, progress 0-1]
  activeBeams:   Array<{ id:number, from:string, to:string, progress:number }>

  // View state for department navigation
  currentView:   ViewState

  // Actions called from the animation loop
  tick:           (dt: number) => void
  triggerMeeting: () => void
  endMeeting:     () => void
  addLog:         (msg: string, type?: LogEntry['type']) => void
  fireBeam:       (fromId: string, toId: string) => void
  setView:        (view: ViewState) => void
  getDepartmentAgents: (dept: ZoneName) => AgentRuntime[]
}

let logCounter = 0
let beamCounter = 0

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
  currentView:   'OVERVIEW',

  setView(view: ViewState) {
    set({ currentView: view })
  },

  getDepartmentAgents(dept: ZoneName) {
    const config = DEPARTMENT_CONFIGS[dept]
    return get().agents.filter(a => config.agentIds.includes(a.id))
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
