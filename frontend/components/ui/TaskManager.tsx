'use client'

import { useState } from 'react'
import { useAgentStore, type Zone } from '@/lib/agentStore'

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

interface TaskManagerProps {
  onTaskCreate: (task: Omit<Task, 'taskId' | 'createdAt' | 'status'>) => void
  tasks: Task[]
}

const ZONES: Zone[] = ['INTAKE', 'STORAGE', 'SORTING', 'STAGING', 'DISPATCH', 'CHARGING']

const PRIORITY_COLORS = {
  low: '#4ade80',
  normal: '#60a5fa',
  high: '#fbbf24',
  urgent: '#f87171',
}

export default function TaskManager({ onTaskCreate, tasks }: TaskManagerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [description, setDescription] = useState('')
  const [sourceZone, setSourceZone] = useState<Zone>('INTAKE')
  const [destinationZone, setDestinationZone] = useState<Zone>('DISPATCH')
  const [priority, setPriority] = useState<'low' | 'normal' | 'high' | 'urgent'>('normal')
  const [assignedAgent, setAssignedAgent] = useState<string>('')

  const agents = useAgentStore((s) => s.agents)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!description.trim()) return

    onTaskCreate({
      description,
      sourceZone,
      destinationZone,
      priority,
      assignedTo: assignedAgent || undefined,
    })

    // Reset form
    setDescription('')
    setPriority('normal')
    setAssignedAgent('')
    setIsOpen(false)
  }

  return (
    <>
      {/* Task Manager Toggle Button */}
      <button className="task-toggle-btn" onClick={() => setIsOpen(!isOpen)}>
        <span className="task-icon">📋</span>
        <span className="task-count">{tasks.filter(t => t.status === 'pending').length}</span>
      </button>

      {/* Task Manager Panel */}
      {isOpen && (
        <div className="task-manager-overlay" onClick={() => setIsOpen(false)}>
          <div className="task-manager-panel" onClick={(e) => e.stopPropagation()}>
            <div className="task-header">
              <h2>TASK MANAGER</h2>
              <button className="close-btn" onClick={() => setIsOpen(false)}>✕</button>
            </div>

            {/* Create Task Form */}
            <form onSubmit={handleSubmit} className="task-form">
              <div className="form-section">
                <h3>Create New Task</h3>

                <div className="form-group">
                  <label>Task Description</label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Enter task description..."
                    className="task-input"
                    required
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Source Zone</label>
                    <select
                      value={sourceZone}
                      onChange={(e) => setSourceZone(e.target.value as Zone)}
                      className="task-select"
                    >
                      {ZONES.map((zone) => (
                        <option key={zone} value={zone}>
                          {zone}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="arrow-icon">→</div>

                  <div className="form-group">
                    <label>Destination Zone</label>
                    <select
                      value={destinationZone}
                      onChange={(e) => setDestinationZone(e.target.value as Zone)}
                      className="task-select"
                    >
                      {ZONES.map((zone) => (
                        <option key={zone} value={zone}>
                          {zone}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Priority</label>
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value as any)}
                      className="task-select"
                    >
                      <option value="low">Low</option>
                      <option value="normal">Normal</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Assign to Agent (Optional)</label>
                    <select
                      value={assignedAgent}
                      onChange={(e) => setAssignedAgent(e.target.value)}
                      className="task-select"
                    >
                      <option value="">Auto-assign</option>
                      {agents.map((agent) => (
                        <option key={agent.id} value={agent.id}>
                          {agent.id} ({agent.zone})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <button type="submit" className="submit-btn">
                  CREATE TASK
                </button>
              </div>
            </form>

            {/* Task List */}
            <div className="task-list-section">
              <h3>Active Tasks ({tasks.length})</h3>
              <div className="task-list">
                {tasks.slice(0, 10).map((task) => (
                  <div key={task.taskId} className="task-item">
                    <div className="task-item-header">
                      <span
                        className="priority-badge"
                        style={{ background: PRIORITY_COLORS[task.priority] }}
                      >
                        {task.priority.toUpperCase()}
                      </span>
                      <span className="task-id">{task.taskId}</span>
                      <span className={`status-badge status-${task.status}`}>
                        {task.status}
                      </span>
                    </div>
                    <div className="task-item-desc">{task.description}</div>
                    <div className="task-item-route">
                      {task.sourceZone} → {task.destinationZone}
                    </div>
                    {task.assignedTo && (
                      <div className="task-item-agent">Agent: {task.assignedTo}</div>
                    )}
                  </div>
                ))}
                {tasks.length === 0 && (
                  <div className="empty-state">No active tasks</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .task-toggle-btn {
          position: fixed;
          top: 20px;
          right: 20px;
          width: 60px;
          height: 60px;
          border-radius: 12px;
          background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
          border: 2px solid rgba(0, 212, 255, 0.4);
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
          z-index: 100;
          transition: all 0.3s ease;
        }

        .task-toggle-btn:hover {
          border-color: #00d4ff;
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0, 212, 255, 0.3);
        }

        .task-icon {
          font-size: 24px;
        }

        .task-count {
          font-size: 11px;
          font-weight: 700;
          color: #00d4ff;
          font-family: var(--font-mono);
        }

        .task-manager-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.85);
          backdrop-filter: blur(8px);
          z-index: 150;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: fadeIn 0.2s ease;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        .task-manager-panel {
          width: 90%;
          max-width: 800px;
          max-height: 85vh;
          background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
          border: 2px solid rgba(0, 212, 255, 0.4);
          border-radius: 16px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(40px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .task-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 24px;
          border-bottom: 2px solid rgba(0, 212, 255, 0.2);
          background: rgba(0, 212, 255, 0.05);
        }

        .task-header h2 {
          font-family: 'Rajdhani', sans-serif;
          font-size: 24px;
          font-weight: 700;
          color: #00d4ff;
          letter-spacing: 2px;
          margin: 0;
        }

        .close-btn {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: rgba(255, 255, 255, 0.6);
          font-size: 20px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .close-btn:hover {
          background: rgba(255, 85, 85, 0.2);
          border-color: #ff5555;
          color: #ff5555;
        }

        .task-form {
          padding: 24px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          overflow-y: auto;
        }

        .form-section h3 {
          font-family: 'Rajdhani', sans-serif;
          font-size: 18px;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.9);
          margin: 0 0 20px 0;
          text-transform: uppercase;
          letter-spacing: 1.5px;
        }

        .form-group {
          margin-bottom: 16px;
          flex: 1;
        }

        .form-group label {
          display: block;
          font-size: 12px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.7);
          margin-bottom: 8px;
          text-transform: uppercase;
          letter-spacing: 1px;
          font-family: var(--font-mono);
        }

        .task-input,
        .task-select {
          width: 100%;
          padding: 12px 16px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 8px;
          color: white;
          font-size: 14px;
          font-family: inherit;
          transition: all 0.2s ease;
        }

        .task-input:focus,
        .task-select:focus {
          outline: none;
          border-color: #00d4ff;
          background: rgba(255, 255, 255, 0.08);
          box-shadow: 0 0 0 3px rgba(0, 212, 255, 0.1);
        }

        .task-input::placeholder {
          color: rgba(255, 255, 255, 0.3);
        }

        .form-row {
          display: flex;
          gap: 16px;
          align-items: end;
        }

        .arrow-icon {
          font-size: 20px;
          color: rgba(255, 255, 255, 0.4);
          margin-bottom: 12px;
        }

        .submit-btn {
          width: 100%;
          padding: 14px;
          background: linear-gradient(135deg, #00d4ff 0%, #0099cc 100%);
          border: none;
          border-radius: 8px;
          color: white;
          font-size: 14px;
          font-weight: 700;
          font-family: 'Rajdhani', sans-serif;
          letter-spacing: 1.5px;
          cursor: pointer;
          margin-top: 20px;
          transition: all 0.2s ease;
        }

        .submit-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0, 212, 255, 0.4);
        }

        .task-list-section {
          padding: 24px;
          overflow-y: auto;
          flex: 1;
        }

        .task-list-section h3 {
          font-family: 'Rajdhani', sans-serif;
          font-size: 18px;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.9);
          margin: 0 0 16px 0;
          text-transform: uppercase;
          letter-spacing: 1.5px;
        }

        .task-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .task-item {
          padding: 16px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          transition: all 0.2s ease;
        }

        .task-item:hover {
          background: rgba(255, 255, 255, 0.06);
          border-color: rgba(0, 212, 255, 0.3);
        }

        .task-item-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
        }

        .priority-badge {
          padding: 4px 10px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 700;
          font-family: var(--font-mono);
          letter-spacing: 0.5px;
          color: #0a0e1a;
        }

        .task-id {
          font-size: 12px;
          font-family: var(--font-mono);
          color: rgba(255, 255, 255, 0.5);
        }

        .status-badge {
          margin-left: auto;
          padding: 4px 10px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 700;
          font-family: var(--font-mono);
          text-transform: uppercase;
        }

        .status-pending {
          background: rgba(96, 165, 250, 0.2);
          color: #60a5fa;
        }

        .status-executing {
          background: rgba(251, 191, 36, 0.2);
          color: #fbbf24;
        }

        .status-completed {
          background: rgba(74, 222, 128, 0.2);
          color: #4ade80;
        }

        .status-failed {
          background: rgba(248, 113, 113, 0.2);
          color: #f87171;
        }

        .task-item-desc {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.9);
          margin-bottom: 6px;
          font-weight: 500;
        }

        .task-item-route {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.5);
          font-family: var(--font-mono);
        }

        .task-item-agent {
          font-size: 11px;
          color: #00d4ff;
          margin-top: 6px;
          font-family: var(--font-mono);
        }

        .empty-state {
          text-align: center;
          padding: 40px 20px;
          color: rgba(255, 255, 255, 0.4);
          font-size: 14px;
        }
      `}</style>
    </>
  )
}
