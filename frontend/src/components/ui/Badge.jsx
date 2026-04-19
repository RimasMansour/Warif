/**
 * components/ui/Badge.jsx
 */
import { cn } from '@/utils'

const VARIANTS = {
  default:  'bg-gray-100 text-gray-700',
  success:  'bg-green-100 text-green-700',
  warning:  'bg-amber-100 text-amber-700',
  danger:   'bg-red-100 text-red-700',
  info:     'bg-blue-100 text-blue-700',
}

export function Badge({ variant = 'default', className, children }) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
        VARIANTS[variant],
        className
      )}
    >
      {children}
    </span>
  )
}

/**
 * components/ui/Button.jsx
 */
const BTN_VARIANTS = {
  primary:   'bg-green-700 text-white hover:bg-green-800',
  secondary: 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50',
  danger:    'bg-red-600 text-white hover:bg-red-700',
  ghost:     'text-gray-600 hover:bg-gray-100',
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...props
}) {
  const sizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2 text-sm', lg: 'px-5 py-2.5 text-base' }
  return (
    <button
      className={cn(
        'inline-flex items-center gap-2 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed',
        BTN_VARIANTS[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}
