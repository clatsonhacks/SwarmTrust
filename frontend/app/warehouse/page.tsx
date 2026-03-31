'use client'

/**
 * Warehouse Simulation Page
 * ─────────────────────────────────────────────────────────────
 * Department overview with clickable cards to enter each department.
 * Now with Among Us-style communication system!
 */

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import Loader from '@/components/ui/Loader'
import AgentPanel from '@/components/ui/AgentPanel'
import ToastNotification from '@/components/ui/ToastNotification'
import CommunicationLog from '@/components/ui/CommunicationLog'
import AlertOverlay from '@/components/ui/AlertOverlay'
import TaskManager from '@/components/ui/TaskManager'
import AgentInventory from '@/components/ui/AgentInventory'
import { useAgentStore } from '@/lib/agentStore'
import { useBackendSocket } from '@/lib/useBackendSocket'
import { useBackendApi } from '@/lib/useBackendApi'
import { useCommunication } from '@/lib/useCommunication'
import type { ZoneName } from '@/lib/types'
import type { Task } from '@/lib/agentStore'

const DepartmentOverview = dynamic(() => import('@/components/scene/DepartmentOverview'), { ssr: false })
const DepartmentScene    = dynamic(() => import('@/components/scene/DepartmentScene'), { ssr: false })

export default function WarehousePage() {
  const [loaded,            setLoaded]            = useState(false)
  const [alertOpen,         setAlertOpen]         = useState(false)
  const [alertData,         setAlertData]         = useState({ title: '', message: '', icon: '⚠️' })
  const [taskManagerOpen,   setTaskManagerOpen]   = useState(false)
  const [agentInventoryOpen,setAgentInventoryOpen]= useState(false)

  const currentView = useAgentStore(s => s.currentView)
  const connected   = useAgentStore(s => s.connected)
  const tasks = useAgentStore(s => s.tasks)
  const agentInventory = useAgentStore(s => s.agentInventory)
  const addTask = useAgentStore(s => s.addTask)
  const addAgentToInventory = useAgentStore(s => s.addAgentToInventory)

  useBackendSocket()
  const { commLog, toasts, removeToast } = useCommunication()
  const { createTask, spawnAgent, fetchAllAgents } = useBackendApi()

  // Fetch initial agent inventory
  useEffect(() => {
    const loadAgents = async () => {
      const agents = await fetchAllAgents()
      if (agents.length > 0) {
        useAgentStore.getState().setAgentInventory(agents)
      }
    }
    loadAgents()
  }, [fetchAllAgents])

  // Handle task creation
  const handleTaskCreate = async (taskData: Omit<Task, 'taskId' | 'createdAt' | 'status'>) => {
    const taskId = `task-${Date.now()}`
    const task: Task = {
      ...taskData,
      taskId,
      status: 'pending',
      createdAt: new Date(),
    }
    addTask(task)

    // Send to backend
    const success = await createTask(taskData)
    if (!success) {
      console.error('Failed to create task in backend')
    }
  }

  // Handle agent spawning
  const handleSpawnAgent = async (capabilities: string[]) => {
    const result = await spawnAgent(capabilities)
    if (result) {
      setAlertData({
        title: 'Agent Spawned',
        message: `New agent ${result.robotId} with capabilities [${capabilities.join(', ')}] has been deployed.`,
        icon: '🤖'
      })
      setAlertOpen(true)
    }
  }

  // Demo alert after 15 seconds
  useState(() => {
    const timer = setTimeout(() => {
      setAlertData({
        title: 'Zone Capacity Alert',
        message: 'Storage zone has reached 85% capacity. Consider reallocation to prevent bottlenecks.',
        icon: '📦'
      })
      setAlertOpen(true)
    }, 15000)
    return () => clearTimeout(timer)
  })

  return (
    <>
      {!loaded && <Loader onComplete={() => setLoaded(true)} />}

      {/* Toast Notifications */}
      <div style={{
        position: 'fixed',
        top: '80px',
        left: '24px',
        zIndex: 200,
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        maxWidth: '400px',
      }}>
        {toasts.map((toast) => (
          <ToastNotification key={toast.id} toast={toast} onDismiss={removeToast} />
        ))}
      </div>

      {/* Alert Overlay */}
      <AlertOverlay
        isOpen={alertOpen}
        title={alertData.title}
        message={alertData.message}
        icon={alertData.icon}
        onClose={() => setAlertOpen(false)}
      />

      {/* Task Manager */}
      <TaskManager isOpen={taskManagerOpen} onClose={() => setTaskManagerOpen(false)} tasks={tasks} onTaskCreate={handleTaskCreate} />

      {/* Agent Inventory */}
      <AgentInventory isOpen={agentInventoryOpen} onClose={() => setAgentInventoryOpen(false)} agents={agentInventory} onSpawnAgent={handleSpawnAgent} />

      {/* Top navbar */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: '48px',
        background: 'rgba(7,8,16,0.92)',
        backdropFilter: 'blur(12px)',
        borderBottom: '0.5px solid rgba(255,255,255,0.08)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px', zIndex: 400,
      }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.2em', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase' }}>
          DeWare
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {[
            { label: 'Tasks', count: tasks.filter(t => t.status === 'pending').length, onClick: () => setTaskManagerOpen(true) },
            { label: 'Agents', count: agentInventory.length, onClick: () => setAgentInventoryOpen(true) },
          ].map(({ label, count, onClick }) => (
            <button
              key={label}
              onClick={onClick}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '5px 14px',
                background: 'rgba(255,255,255,0.03)',
                border: '0.5px solid rgba(255,255,255,0.1)',
                borderRadius: '3px',
                cursor: 'pointer',
                fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.16em',
                textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)',
                transition: 'border-color 0.2s, color 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)'; e.currentTarget.style.color = 'rgba(255,255,255,0.85)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'rgba(255,255,255,0.5)' }}
            >
              {label}
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--accent)', fontWeight: 700 }}>{count}</span>
            </button>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '12px', paddingLeft: '12px', borderLeft: '0.5px solid rgba(255,255,255,0.08)' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: connected ? '#1aff88' : 'rgba(255,255,255,0.2)', boxShadow: connected ? '0 0 6px #1aff88' : 'none' }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', letterSpacing: '0.16em', color: connected ? '#1aff88' : 'rgba(255,255,255,0.25)' }}>
              {connected ? 'LIVE' : 'SIM'}
            </span>
          </div>
        </div>
      </nav>

      {currentView === 'OVERVIEW' ? (
        <div style={{ minHeight: '100vh', background: 'var(--bg)', paddingBottom: '240px', paddingTop: '48px' }}>
          <DepartmentOverview />
          <AgentPanel />
        </div>
      ) : (
        // Fullscreen 3D scene when inside a department
        <div className="warehouse-fullscreen">
          <DepartmentScene department={currentView as ZoneName} />
        </div>
      )}
    </>
  )
}
