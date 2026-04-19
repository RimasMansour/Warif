/**
 * components/alerts/AlertList.jsx
 */
import { useAlerts } from '@/hooks/useAlerts'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Badge'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { severityColor, timeAgo } from '@/utils'

export default function AlertList() {
  const { alerts, loading, acknowledge, resolve } = useAlerts()

  if (loading) return <p className="text-sm text-gray-500">Loading alerts…</p>
  if (!alerts.length) return <p className="text-sm text-gray-500">No open alerts 🎉</p>

  return (
    <Card>
      <CardHeader>
        <CardTitle>Open Alerts</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y divide-gray-100">
          {alerts.map((alert) => (
            <li key={alert.id} className="px-5 py-3 flex items-start justify-between gap-4">
              <div>
                <p className={`text-sm font-medium ${severityColor(alert.severity)}`}>
                  {alert.message}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{timeAgo(alert.created_at)}</p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                {alert.status === 'open' && (
                  <button
                    onClick={() => acknowledge(alert.id)}
                    className="text-xs text-amber-600 hover:underline"
                  >
                    Ack
                  </button>
                )}
                <button
                  onClick={() => resolve(alert.id)}
                  className="text-xs text-green-700 hover:underline"
                >
                  Resolve
                </button>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
