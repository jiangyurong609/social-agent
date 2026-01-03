import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle, XCircle, AlertCircle, ArrowRight } from 'lucide-react'
import { getXhsLoginStatus, getXhsStatus } from '../api/client'

interface StatusItem {
  name: string;
  status: 'connected' | 'disconnected' | 'loading';
  message?: string;
  link?: string;
}

export default function Dashboard() {
  const [statuses, setStatuses] = useState<StatusItem[]>([
    { name: 'Xiaohongshu', status: 'loading' },
  ])

  useEffect(() => {
    checkStatuses()
  }, [])

  async function checkStatuses() {
    // Check XHS status
    const xhsStatus = await getXhsStatus()
    const xhsLogin = await getXhsLoginStatus()

    setStatuses([
      {
        name: 'Xiaohongshu',
        status: xhsStatus.success && xhsStatus.data?.ok ? 'connected' : 'disconnected',
        message: xhsLogin.data?.is_logged_in
          ? `Logged in as ${xhsLogin.data.username || 'User'}`
          : 'Not logged in',
        link: '/xhs/login',
      },
    ])
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h2>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {statuses.map((item) => (
          <div
            key={item.name}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">{item.name}</h3>
              {item.status === 'loading' && (
                <AlertCircle className="text-yellow-500" size={24} />
              )}
              {item.status === 'connected' && (
                <CheckCircle className="text-green-500" size={24} />
              )}
              {item.status === 'disconnected' && (
                <XCircle className="text-red-500" size={24} />
              )}
            </div>
            <p className="text-sm text-gray-500 mb-4">{item.message || 'Checking status...'}</p>
            {item.link && (
              <Link
                to={item.link}
                className="inline-flex items-center gap-2 text-sm text-xhs-red hover:underline"
              >
                Manage connection
                <ArrowRight size={16} />
              </Link>
            )}
          </div>
        ))}
      </div>

      <div className="mt-8 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="flex gap-4">
          <Link
            to="/xhs/search"
            className="px-4 py-2 bg-xhs-red text-white rounded-lg hover:bg-xhs-pink transition-colors"
          >
            Search Xiaohongshu
          </Link>
          <Link
            to="/xhs/publish"
            className="px-4 py-2 border border-xhs-red text-xhs-red rounded-lg hover:bg-red-50 transition-colors"
          >
            Create Post
          </Link>
        </div>
      </div>
    </div>
  )
}
