/**
 * pages/AlertsPage.jsx
 * TODO: implement full alert management UI
 */
import AlertList from '@/components/alerts/AlertList'

export default function AlertsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-gray-900">Alerts</h1>
      <AlertList />
    </div>
  )
}
