'use client'

import { useState } from 'react'
import { useAgentStore, type Task, type Zone } from '@/lib/agentStore'

interface TaskManagerProps {
  isOpen: boolean
  onClose: () => void
  onTaskCreate: (task: Omit<Task, 'taskId' | 'createdAt' | 'status'>) => void
  tasks: Task[]
}

const ZONES: Zone[] = ['INTAKE', 'STORAGE', 'SORTING', 'STAGING', 'DISPATCH', 'CHARGING']

const PRIORITY_COLORS: Record<string, string> = {
  low:    '#1aff88',
  normal: '#5cc8ff',
  high:   '#ff9b2b',
  urgent: '#ff4466',
}

const STATUS_COLORS: Record<string, string> = {
  pending:   '#5cc8ff',
  executing: '#ff9b2b',
  completed: '#1aff88',
  failed:    '#ff4466',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  background: 'rgba(255,255,255,0.05)',
  border: '0.5px solid rgba(255,255,255,0.18)',
  borderRadius: '4px',
  color: '#ffffff',
  fontSize: '15px',
  fontFamily: 'var(--font-sans)',
  outline: 'none',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontFamily: 'var(--font-mono)',
  fontSize: '10px',
  letterSpacing: '0.18em',
  textTransform: 'uppercase' as const,
  color: 'rgba(255,255,255,0.55)',
  marginBottom: '8px',
  fontWeight: 600,
}

export default function TaskManager({ isOpen, onClose, onTaskCreate, tasks }: TaskManagerProps) {
  const [description,      setDescription]      = useState('')
  const [sourceZone,       setSourceZone]        = useState<Zone>('INTAKE')
  const [destinationZone,  setDestinationZone]   = useState<Zone>('DISPATCH')
  const [priority,         setPriority]          = useState<'low' | 'normal' | 'high' | 'urgent'>('normal')
  const [assignedAgent,    setAssignedAgent]     = useState('')

  const agents = useAgentStore(s => s.agents)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!description.trim()) return
    onTaskCreate({ description, sourceZone, destinationZone, priority, assignedTo: assignedAgent || undefined })
    setDescription('')
    setPriority('normal')
    setAssignedAgent('')
    onClose()
  }

  if (!isOpen) return null

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(6px)',
        zIndex: 500,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '90%', maxWidth: '760px', maxHeight: '85vh',
          background: 'var(--bg)',
          border: '0.5px solid rgba(255,255,255,0.12)',
          borderRadius: '6px',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '18px 28px',
          borderBottom: '0.5px solid rgba(255,255,255,0.1)',
          display: 'flex', alignItems: 'center', gap: '16px',
        }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.8)', fontWeight: 700 }}>
            Task Manager
          </span>
          <span style={{ flex: 1, height: '0.5px', background: 'rgba(255,255,255,0.08)' }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--accent)', fontWeight: 700 }}>
            {tasks.filter(t => t.status === 'pending').length} pending
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '18px', padding: '0 0 0 16px', lineHeight: 1 }}>✕</button>
        </div>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          {/* Create form */}
          <form onSubmit={handleSubmit} style={{ width: '380px', flexShrink: 0, padding: '28px', borderRight: '0.5px solid rgba(255,255,255,0.07)', display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto' }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)', fontWeight: 700, margin: 0 }}>
              New Task
            </p>

            <div>
              <label style={labelStyle}>Description</label>
              <input
                style={inputStyle}
                type="text"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Task description…"
                required
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>From</label>
                <select style={inputStyle} value={sourceZone} onChange={e => setSourceZone(e.target.value as Zone)}>
                  {ZONES.map(z => <option key={z} value={z}>{z}</option>)}
                </select>
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '18px', color: 'rgba(255,255,255,0.4)', paddingBottom: '12px' }}>→</span>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>To</label>
                <select style={inputStyle} value={destinationZone} onChange={e => setDestinationZone(e.target.value as Zone)}>
                  {ZONES.map(z => <option key={z} value={z}>{z}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Priority</label>
                <select style={inputStyle} value={priority} onChange={e => setPriority(e.target.value as any)}>
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Agent</label>
                <select style={inputStyle} value={assignedAgent} onChange={e => setAssignedAgent(e.target.value)}>
                  <option value="">Auto</option>
                  {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
            </div>

            <button type="submit" style={{
              marginTop: 'auto',
              padding: '14px',
              background: 'var(--accent)',
              border: 'none',
              borderRadius: '4px',
              color: '#070810',
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              fontWeight: 700,
              cursor: 'pointer',
            }}>
              Create Task
            </button>
          </form>

          {/* Task list */}
          <div style={{ flex: 1, padding: '28px', overflowY: 'auto' }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)', fontWeight: 700, margin: '0 0 20px 0' }}>
              Active Tasks — {tasks.length}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {tasks.slice(0, 20).map(task => (
                <div key={task.taskId} style={{
                  padding: '14px 16px',
                  background: 'rgba(255,255,255,0.02)',
                  border: '0.5px solid rgba(255,255,255,0.08)',
                  borderLeft: `2px solid ${PRIORITY_COLORS[task.priority]}`,
                  borderRadius: '4px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.12em', color: PRIORITY_COLORS[task.priority], fontWeight: 700 }}>
                      {task.priority.toUpperCase()}
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>{task.taskId}</span>
                    <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: '10px', color: STATUS_COLORS[task.status], fontWeight: 700 }}>
                      {task.status}
                    </span>
                  </div>
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: '15px', color: '#ffffff', marginBottom: '6px', fontWeight: 500 }}>{task.description}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'rgba(255,255,255,0.45)' }}>
                    {task.sourceZone} → {task.destinationZone}
                  </div>
                </div>
              ))}
              {tasks.length === 0 && (
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'rgba(255,255,255,0.3)', textAlign: 'center', paddingTop: '60px' }}>
                  No active tasks
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
