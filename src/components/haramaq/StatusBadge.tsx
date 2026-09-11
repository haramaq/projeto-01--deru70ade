import React from 'react'
import { cn } from '@/lib/utils'

export type HaramaqBadgeVariant =
  | 'primary'
  | 'success'
  | 'danger'
  | 'warning'
  | 'info'
  | 'neutral'
  | 'secondary'

interface StatusBadgeProps {
  children: React.ReactNode
  variant?: HaramaqBadgeVariant
  dot?: boolean
  size?: 'sm' | 'md'
  className?: string
}

const badgeVariantClasses: Record<HaramaqBadgeVariant, string> = {
  primary: 'bg-[#FEE2E2] text-[#B91C1C] border-[#FCA5A5]',
  success: 'bg-[#DCFCE7] text-[#15803D] border-[#86EFAC]',
  danger: 'bg-[#FEE2E2] text-[#DC2626] border-[#FCA5A5]',
  warning: 'bg-[#FEF3C7] text-[#B45309] border-[#FDE68A]',
  info: 'bg-[#E0F2FE] text-[#0369A1] border-[#BAE6FD]',
  neutral: 'bg-[#F1F5F9] text-[#475569] border-[#E2E8F0]',
  secondary: 'bg-[#F8FAFC] text-[#334155] border-[#CBD5E1]',
}

const dotColorClasses: Record<HaramaqBadgeVariant, string> = {
  primary: 'bg-[#DC2626]',
  success: 'bg-[#16A34A]',
  danger: 'bg-[#DC2626]',
  warning: 'bg-[#F59E0B]',
  info: 'bg-[#0284C7]',
  neutral: 'bg-[#64748B]',
  secondary: 'bg-[#475569]',
}

/**
 * Standardized status badge used across Haramaq CRM:
 * Soft background, dark text, subtle border, optional status dot.
 */
export function StatusBadge({
  children,
  variant = 'neutral',
  dot = false,
  size = 'sm',
  className,
}: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-semibold rounded-md border tracking-tight shrink-0 transition-colors',
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
        badgeVariantClasses[variant],
        className,
      )}
    >
      {dot && (
        <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', dotColorClasses[variant])} />
      )}
      <span>{children}</span>
    </span>
  )
}

export default StatusBadge
