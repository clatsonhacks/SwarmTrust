// Shared types for the SwarmTrust simulation

export type AgentType  = 'SCOUT' | 'LIFTER' | 'CARRIER'
export type AgentState = 'IDLE' | 'MOVING' | 'EXECUTING' | 'MEETING' | 'DELEGATING'
export type ZoneName   = 'INTAKE' | 'STORAGE' | 'STAGING' | 'DISPATCH'

export interface AgentDef {
  id:         string
  name:       string
  type:       AgentType
  color:      string    // hex string, used for both Three.js and CSS
  zone:       ZoneName
  reputation: number
}

export interface AgentRuntime extends AgentDef {
  state:      AgentState
  task:       string
  target:     [number, number, number]   // world position
  position:   [number, number, number]   // current world position
  waitTimer:  number
  taskTimer:  number
  phase:      number    // random phase offset for bobbing animation
}

export interface LogEntry {
  id:        number
  timestamp: string   // "MM:SS"
  message:   string   // HTML string
  type:      'info' | 'payment' | 'chain' | 'meeting'
}

export interface ZoneDef {
  name:  ZoneName
  x:     number     // world X centre
  z:     number     // world Z centre
  w:     number     // width
  d:     number     // depth
  color: string     // platform tint hex
  glow:  string     // glow color hex
}

// View state for department navigation
export type ViewState = 'OVERVIEW' | ZoneName

// Department configuration for per-department models and agents
export interface DepartmentConfig {
  name:             ZoneName
  title:            string
  description:      string
  agentModel:       string     // GLB path for department-specific robot
  environmentModel: string     // GLB path for department-specific props
  color:            string     // accent color
  glow:             string     // glow color
  agentIds:         string[]   // Agent IDs assigned to this department
}
