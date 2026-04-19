/**
 * components/sensors/SensorCard.jsx
 * Displays the latest reading for a single sensor type.
 */
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { formatSensorValue } from '@/utils'

const STATUS_VARIANT = {
  normal:   'success',
  warning:  'warning',
  critical: 'danger',
}

export default function SensorCard({ type, value, status = 'normal', label }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label ?? type}</p>
          <p className="text-2xl font-bold text-gray-900">
            {value != null ? formatSensorValue(type, value) : '—'}
          </p>
        </div>
        <Badge variant={STATUS_VARIANT[status] ?? 'default'}>
          {status}
        </Badge>
      </CardContent>
    </Card>
  )
}
