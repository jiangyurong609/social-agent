import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Play, Pause, Trash2, Clock, Plus, RefreshCw, Loader2,
  Search, PenSquare, MessageSquare, Zap
} from 'lucide-react'
import { useToast } from '../components/toast'

const API_BASE = import.meta.env.PROD
  ? 'https://social-agent-api.jiangyurong609.workers.dev'
  : '/api'

interface Automation {
  id: string
  name: string
  type: 'scheduled_post' | 'auto_engage' | 'content_discovery'
  status: 'active' | 'paused' | 'disabled'
  cronExpression: string
  lastRunAt: string | null
  nextRunAt: string | null
  runCount: number
  errorCount: number
}

const typeIcons = {
  scheduled_post: PenSquare,
  auto_engage: MessageSquare,
  content_discovery: Search
}

const typeLabels = {
  scheduled_post: 'Scheduled Post',
  auto_engage: 'Auto Engage',
  content_discovery: 'Content Discovery'
}

export default function Automations() {
  const [automations, setAutomations] = useState<Automation[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const { showToast } = useToast()

  useEffect(() => {
    fetchAutomations()
  }, [])

  async function fetchAutomations() {
    setLoading(true)
    try {
      const resp = await fetch(`${API_BASE}/automations?userId=default&workspaceId=default`)
      const data = await resp.json()
      if (data.ok) {
        setAutomations(data.automations || [])
      }
    } catch (err) {
      console.error('Failed to fetch automations:', err)
    }
    setLoading(false)
  }

  async function toggleStatus(automation: Automation) {
    setActionLoading(automation.id)
    const action = automation.status === 'active' ? 'pause' : 'resume'
    try {
      await fetch(`${API_BASE}/automations/${automation.id}/${action}`, {
        method: 'POST'
      })
      fetchAutomations()
    } catch (err) {
      console.error(`Failed to ${action} automation:`, err)
    }
    setActionLoading(null)
  }

  async function deleteAutomation(id: string) {
    if (!confirm('Are you sure you want to delete this automation?')) return
    setActionLoading(id)
    try {
      await fetch(`${API_BASE}/automations/${id}`, { method: 'DELETE' })
      fetchAutomations()
    } catch (err) {
      console.error('Failed to delete automation:', err)
    }
    setActionLoading(null)
  }

  async function triggerRun(id: string) {
    setActionLoading(id)
    try {
      await fetch(`${API_BASE}/automations/${id}/run`, { method: 'POST' })
      showToast('Automation triggered! It will run on the next scheduler cycle.', 'success')
      fetchAutomations()
    } catch (err) {
      console.error('Failed to trigger automation:', err)
      showToast('Failed to trigger automation', 'error')
    }
    setActionLoading(null)
  }

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return 'Never'
    const date = new Date(dateStr)
    return date.toLocaleString()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Automations</h2>
        <Link
          to="/automations/create"
          className="flex items-center gap-2 px-4 py-2 bg-xhs-red text-white rounded-lg hover:bg-xhs-pink transition-colors"
        >
          <Plus size={20} />
          New Automation
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="animate-spin text-xhs-red" size={32} />
        </div>
      ) : automations.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Zap className="mx-auto text-gray-300 mb-4" size={48} />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No automations yet</h3>
          <p className="text-gray-500 mb-6">
            Create your first automation to start engaging with Xiaohongshu automatically.
          </p>
          <Link
            to="/automations/create"
            className="inline-flex items-center gap-2 px-4 py-2 bg-xhs-red text-white rounded-lg hover:bg-xhs-pink"
          >
            <Plus size={20} />
            Create Automation
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {automations.map((automation) => {
            const Icon = typeIcons[automation.type]
            return (
              <div
                key={automation.id}
                className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-lg ${
                      automation.status === 'active' ? 'bg-green-100' : 'bg-gray-100'
                    }`}>
                      <Icon className={
                        automation.status === 'active' ? 'text-green-600' : 'text-gray-400'
                      } size={24} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{automation.name}</h3>
                      <p className="text-sm text-gray-500">{typeLabels[automation.type]}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          {automation.cronExpression}
                        </span>
                        <span>Runs: {automation.runCount}</span>
                        {automation.errorCount > 0 && (
                          <span className="text-red-500">Errors: {automation.errorCount}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-xs text-gray-400">
                        <span>Last: {formatDate(automation.lastRunAt)}</span>
                        <span>Next: {formatDate(automation.nextRunAt)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      automation.status === 'active'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {automation.status}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-100">
                  <button
                    onClick={() => toggleStatus(automation)}
                    disabled={actionLoading === automation.id}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    {actionLoading === automation.id ? (
                      <Loader2 className="animate-spin" size={14} />
                    ) : automation.status === 'active' ? (
                      <><Pause size={14} /> Pause</>
                    ) : (
                      <><Play size={14} /> Resume</>
                    )}
                  </button>
                  <button
                    onClick={() => triggerRun(automation.id)}
                    disabled={actionLoading === automation.id}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    <RefreshCw size={14} />
                    Run Now
                  </button>
                  <button
                    onClick={() => deleteAutomation(automation.id)}
                    disabled={actionLoading === automation.id}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm border border-red-300 text-red-600 rounded-lg hover:bg-red-50"
                  >
                    <Trash2 size={14} />
                    Delete
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
