/**
 * components/ui/Card.jsx
 * Generic surface card used throughout the app.
 */
import { cn } from '@/utils'

export function Card({ className, children, ...props }) {
  return (
    <div
      className={cn('bg-white rounded-xl border border-gray-200 shadow-sm', className)}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardHeader({ className, children }) {
  return (
    <div className={cn('px-5 py-4 border-b border-gray-100', className)}>
      {children}
    </div>
  )
}

export function CardTitle({ className, children }) {
  return (
    <h3 className={cn('text-sm font-semibold text-gray-700', className)}>
      {children}
    </h3>
  )
}

export function CardContent({ className, children }) {
  return (
    <div className={cn('px-5 py-4', className)}>
      {children}
    </div>
  )
}
