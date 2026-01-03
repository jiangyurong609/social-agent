import { useState, useEffect } from 'react'
import {
  Check, X, Edit2, Trash2, Loader2, FileText, RefreshCw,
  ChevronDown, ChevronUp, Image as ImageIcon, Plus
} from 'lucide-react'
import { useToast } from '../components/toast'

const API_BASE = import.meta.env.PROD
  ? 'https://social-agent-api.jiangyurong609.workers.dev'
  : '/api'

interface PendingPost {
  id: string
  automationId: string
  title: string
  content: string
  images: string[]
  tags: string[]
  generationMode: 'static' | 'ai_topic' | 'ai_prompt'
  generationPrompt: string | null
  generationModel: string | null
  status: 'pending' | 'approved' | 'rejected' | 'published' | 'failed'
  generatedAt: string
  reviewedAt: string | null
  publishedAt: string | null
}

interface Stats {
  pending: number
  approved: number
  rejected: number
  published: number
  failed: number
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-blue-100 text-blue-700',
  rejected: 'bg-gray-100 text-gray-600',
  published: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700'
}

const modeLabels: Record<string, string> = {
  static: 'Static Template',
  ai_topic: 'AI Topic',
  ai_prompt: 'AI Prompt'
}

export default function PendingPosts() {
  const [posts, setPosts] = useState<PendingPost[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('pending')
  const [expandedPost, setExpandedPost] = useState<string | null>(null)
  const [editingPost, setEditingPost] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<{
    title: string
    content: string
    tags: string[]
    images: string[]
  }>({ title: '', content: '', tags: [], images: [] })
  const { showToast } = useToast()

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files) return
    Array.from(files).forEach(file => {
      const reader = new FileReader()
      reader.onload = (event) => {
        if (event.target?.result) {
          setEditForm(prev => ({
            ...prev,
            images: [...prev.images, event.target!.result as string]
          }))
        }
      }
      reader.readAsDataURL(file)
    })
  }

  function removeEditImage(index: number) {
    setEditForm(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }))
  }

  useEffect(() => {
    fetchPosts()
    fetchStats()
  }, [statusFilter])

  async function fetchPosts() {
    setLoading(true)
    try {
      const resp = await fetch(
        `${API_BASE}/pending-posts?userId=default&workspaceId=default&status=${statusFilter}`
      )
      const data = await resp.json()
      if (data.ok) {
        setPosts(data.posts || [])
      }
    } catch (err) {
      console.error('Failed to fetch pending posts:', err)
    }
    setLoading(false)
  }

  async function fetchStats() {
    try {
      const resp = await fetch(
        `${API_BASE}/pending-posts/stats?userId=default&workspaceId=default`
      )
      const data = await resp.json()
      if (data.ok) {
        setStats(data.stats)
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err)
    }
  }

  async function approvePost(post: PendingPost, edits?: typeof editForm) {
    setActionLoading(post.id)
    try {
      const body = edits || {}
      const resp = await fetch(`${API_BASE}/pending-posts/${post.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const data = await resp.json()
      if (data.ok) {
        if (data.published) {
          showToast('Post approved and published successfully!', 'success')
        } else {
          showToast('Post approved. ' + (data.publishResult?.message || ''), 'info')
        }
        fetchPosts()
        fetchStats()
      } else {
        showToast('Failed to approve: ' + data.error, 'error')
      }
    } catch (err) {
      console.error('Failed to approve post:', err)
      showToast('Failed to approve post', 'error')
    }
    setActionLoading(null)
    setEditingPost(null)
  }

  async function rejectPost(id: string) {
    const reason = prompt('Rejection reason (optional):')
    setActionLoading(id)
    try {
      await fetch(`${API_BASE}/pending-posts/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      })
      fetchPosts()
      fetchStats()
    } catch (err) {
      console.error('Failed to reject post:', err)
    }
    setActionLoading(null)
  }

  async function deletePost(id: string) {
    if (!confirm('Are you sure you want to delete this post?')) return
    setActionLoading(id)
    try {
      await fetch(`${API_BASE}/pending-posts/${id}`, { method: 'DELETE' })
      fetchPosts()
      fetchStats()
    } catch (err) {
      console.error('Failed to delete post:', err)
    }
    setActionLoading(null)
  }

  function startEditing(post: PendingPost) {
    setEditingPost(post.id)
    setEditForm({
      title: post.title,
      content: post.content,
      tags: post.tags,
      images: post.images || []
    })
  }

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return 'N/A'
    return new Date(dateStr).toLocaleString()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Pending Posts</h2>
        <button
          onClick={() => { fetchPosts(); fetchStats() }}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-5 gap-4 mb-6">
          {Object.entries(stats).map(([status, count]) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`p-4 rounded-lg border transition-all ${
                statusFilter === status
                  ? 'border-xhs-red bg-red-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="text-2xl font-bold text-gray-900">{count}</div>
              <div className="text-sm text-gray-500 capitalize">{status}</div>
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="animate-spin text-xhs-red" size={32} />
        </div>
      ) : posts.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <FileText className="mx-auto text-gray-300 mb-4" size={48} />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No {statusFilter} posts
          </h3>
          <p className="text-gray-500">
            {statusFilter === 'pending'
              ? 'AI-generated posts will appear here for your approval.'
              : `No posts with "${statusFilter}" status.`}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <div
              key={post.id}
              className="bg-white rounded-xl border border-gray-200 overflow-hidden"
            >
              {/* Header */}
              <div
                className="p-4 cursor-pointer hover:bg-gray-50"
                onClick={() => setExpandedPost(expandedPost === post.id ? null : post.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 text-xs rounded-full ${statusColors[post.status]}`}>
                        {post.status}
                      </span>
                      <span className="text-xs text-gray-400">
                        {modeLabels[post.generationMode]}
                      </span>
                      {post.images.length > 0 && (
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                          <ImageIcon size={12} />
                          {post.images.length}
                        </span>
                      )}
                    </div>
                    <h3 className="font-semibold text-gray-900">{post.title}</h3>
                    <p className="text-sm text-gray-500 line-clamp-2 mt-1">
                      {post.content}
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                      <span>Generated: {formatDate(post.generatedAt)}</span>
                      {post.tags.length > 0 && (
                        <span>Tags: {post.tags.slice(0, 3).join(', ')}{post.tags.length > 3 ? '...' : ''}</span>
                      )}
                    </div>
                  </div>
                  <div className="ml-4">
                    {expandedPost === post.id ? (
                      <ChevronUp size={20} className="text-gray-400" />
                    ) : (
                      <ChevronDown size={20} className="text-gray-400" />
                    )}
                  </div>
                </div>
              </div>

              {/* Expanded Content */}
              {expandedPost === post.id && (
                <div className="border-t border-gray-100 p-4 bg-gray-50">
                  {editingPost === post.id ? (
                    /* Edit Mode */
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Title
                        </label>
                        <input
                          type="text"
                          value={editForm.title}
                          onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-xhs-red focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Content
                        </label>
                        <textarea
                          value={editForm.content}
                          onChange={(e) => setEditForm({ ...editForm, content: e.target.value })}
                          rows={6}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-xhs-red focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Tags (comma separated)
                        </label>
                        <input
                          type="text"
                          value={editForm.tags.join(', ')}
                          onChange={(e) => setEditForm({
                            ...editForm,
                            tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean)
                          })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-xhs-red focus:border-transparent"
                        />
                      </div>

                      {/* Images */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Images {editForm.images.length === 0 && <span className="text-red-500">(at least 1 required)</span>}
                        </label>
                        <div className="flex flex-wrap gap-3">
                          {editForm.images.map((img, i) => (
                            <div key={i} className="relative w-20 h-20">
                              <img
                                src={img}
                                alt=""
                                className="w-full h-full object-cover rounded-lg border border-gray-200"
                              />
                              <button
                                type="button"
                                onClick={() => removeEditImage(i)}
                                className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          ))}
                          {editForm.images.length < 9 && (
                            <label className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-xhs-red hover:bg-red-50 transition-colors">
                              <Plus className="text-gray-400" size={20} />
                              <span className="text-xs text-gray-400 mt-1">Add</span>
                              <input
                                type="file"
                                accept="image/*"
                                multiple
                                onChange={handleImageUpload}
                                className="hidden"
                              />
                            </label>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-gray-500">{editForm.images.length}/9 images</p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => approvePost(post, editForm)}
                          disabled={actionLoading === post.id || editForm.images.length === 0}
                          className="flex items-center gap-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {actionLoading === post.id ? (
                            <Loader2 className="animate-spin" size={16} />
                          ) : (
                            <Check size={16} />
                          )}
                          Save & Approve
                        </button>
                        <button
                          onClick={() => setEditingPost(null)}
                          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* View Mode */
                    <div>
                      {/* Full Content */}
                      <div className="mb-4">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Full Content</h4>
                        <div className="bg-white p-4 rounded-lg border border-gray-200 whitespace-pre-wrap">
                          {post.content}
                        </div>
                      </div>

                      {/* Tags */}
                      {post.tags.length > 0 && (
                        <div className="mb-4">
                          <h4 className="text-sm font-medium text-gray-700 mb-2">Tags</h4>
                          <div className="flex flex-wrap gap-2">
                            {post.tags.map((tag, i) => (
                              <span
                                key={i}
                                className="px-2 py-1 bg-xhs-red/10 text-xhs-red text-sm rounded"
                              >
                                #{tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Images */}
                      {post.images.length > 0 && (
                        <div className="mb-4">
                          <h4 className="text-sm font-medium text-gray-700 mb-2">Images</h4>
                          <div className="flex gap-2 overflow-x-auto">
                            {post.images.map((img, i) => (
                              <img
                                key={i}
                                src={img}
                                alt={`Image ${i + 1}`}
                                className="h-32 w-32 object-cover rounded-lg border border-gray-200"
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Generation Info */}
                      {post.generationPrompt && (
                        <div className="mb-4">
                          <h4 className="text-sm font-medium text-gray-700 mb-2">Generation Prompt</h4>
                          <div className="bg-white p-3 rounded-lg border border-gray-200 text-sm text-gray-600">
                            {post.generationPrompt}
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      {post.status === 'pending' && (
                        <div className="flex items-center gap-2 pt-4 border-t border-gray-200">
                          <button
                            onClick={() => approvePost(post)}
                            disabled={actionLoading === post.id}
                            className="flex items-center gap-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                          >
                            {actionLoading === post.id ? (
                              <Loader2 className="animate-spin" size={16} />
                            ) : (
                              <Check size={16} />
                            )}
                            Approve & Publish
                          </button>
                          <button
                            onClick={() => startEditing(post)}
                            className="flex items-center gap-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100"
                          >
                            <Edit2 size={16} />
                            Edit
                          </button>
                          <button
                            onClick={() => rejectPost(post.id)}
                            disabled={actionLoading === post.id}
                            className="flex items-center gap-1 px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50"
                          >
                            <X size={16} />
                            Reject
                          </button>
                        </div>
                      )}

                      {post.status !== 'pending' && (
                        <div className="flex items-center gap-2 pt-4 border-t border-gray-200">
                          <button
                            onClick={() => deletePost(post.id)}
                            disabled={actionLoading === post.id}
                            className="flex items-center gap-1 px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50"
                          >
                            <Trash2 size={16} />
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
