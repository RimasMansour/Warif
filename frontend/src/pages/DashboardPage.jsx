/**
 * pages/DashboardPage.jsx
 */
import SensorCard from '@/components/sensors/SensorCard'
import AlertList from '@/components/alerts/AlertList'
import { useSensors } from '@/hooks/useSensors'

export default function DashboardPage() {
  const { readings, loading } = useSensors()

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>

      {/* Sensor summary row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-24 rounded-xl bg-gray-100 animate-pulse" />
            ))
          : readings.map((r) => (
              <SensorCard
                key={r.sensor_type}
                type={r.sensor_type}
                value={r.value}
                status={r.status}
              />
            ))}
      </div>

      {/* Alerts */}
      <AlertList />
    </div>
  )
}
