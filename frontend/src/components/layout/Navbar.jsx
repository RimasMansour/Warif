/**
 * components/layout/Navbar.jsx
 */
import { Bell } from 'lucide-react'
import { useAlerts } from '@/hooks/useAlerts'

export default function Navbar() {
  const { alerts } = useAlerts()
  const openCount = alerts.filter((a) => a.status === 'open').length

  return (
    <header className="h-16 flex items-center justify-between px-6 bg-white border-b border-gray-200">
      {/* Page title is set by each page — left side intentionally blank */}
      <div />

      <div className="flex items-center gap-4">
        {/* Alert bell */}
        <button className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <Bell className="w-5 h-5 text-gray-600" />
          {openCount > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
              {openCount > 9 ? '9+' : openCount}
            </span>
          )}
        </button>

        {/* Avatar placeholder */}
        <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-semibold text-sm">
          W
        </div>
      </div>
    </header>
  )
}
