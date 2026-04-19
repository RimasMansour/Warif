/**
 * components/layout/Sidebar.jsx
 */
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Thermometer,
  Bell,
  Layers,
  BrainCircuit,
  Settings,
} from 'lucide-react'
import { cn } from '@/utils'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard',  icon: LayoutDashboard },
  { to: '/sensors',   label: 'Sensors',    icon: Thermometer },
  { to: '/alerts',    label: 'Alerts',     icon: Bell },
  { to: '/trays',     label: 'Trays',      icon: Layers },
  { to: '/ml',        label: 'ML & Predictions', icon: BrainCircuit },
  { to: '/settings',  label: 'Settings',   icon: Settings },
]

export default function Sidebar() {
  return (
    <aside className="w-60 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col">
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-gray-200">
        <span className="text-xl font-bold text-green-700">🌱 Warif</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-1">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-green-50 text-green-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              )
            }
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
