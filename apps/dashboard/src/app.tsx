import { Routes, Route, Link, useLocation } from 'react-router-dom'
import { Home, Search, PenSquare, User, Zap, FileText } from 'lucide-react'
import XhsLogin from './pages/xhs-login'
import XhsSearch from './pages/xhs-search'
import XhsPublish from './pages/xhs-publish'
import Dashboard from './pages/dashboard'
import Automations from './pages/automations'
import AutomationCreate from './pages/automation-create'
import PendingPosts from './pages/pending-posts'

function Sidebar() {
  const location = useLocation()

  const links = [
    { to: '/', icon: Home, label: 'Dashboard' },
    { to: '/automations', icon: Zap, label: 'Automations' },
    { to: '/pending-posts', icon: FileText, label: 'Pending Posts' },
    { to: '/xhs/login', icon: User, label: 'XHS Login' },
    { to: '/xhs/search', icon: Search, label: 'Search' },
    { to: '/xhs/publish', icon: PenSquare, label: 'Publish' },
  ]

  return (
    <aside className="w-64 bg-white border-r border-gray-200 min-h-screen p-4">
      <div className="mb-8">
        <h1 className="text-xl font-bold text-gray-900">Social Agent</h1>
        <p className="text-sm text-gray-500">Manage your social media</p>
      </div>
      <nav className="space-y-2">
        {links.map(({ to, icon: Icon, label }) => (
          <Link
            key={to}
            to={to}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
              location.pathname === to || (to !== '/' && location.pathname.startsWith(to))
                ? 'bg-xhs-red text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Icon size={20} />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
    </aside>
  )
}

export default function App() {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 p-8">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/automations" element={<Automations />} />
          <Route path="/automations/create" element={<AutomationCreate />} />
          <Route path="/pending-posts" element={<PendingPosts />} />
          <Route path="/xhs/login" element={<XhsLogin />} />
          <Route path="/xhs/search" element={<XhsSearch />} />
          <Route path="/xhs/publish" element={<XhsPublish />} />
        </Routes>
      </main>
    </div>
  )
}
