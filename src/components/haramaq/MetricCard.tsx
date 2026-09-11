import React from 'react'
import { cn } from '@/lib/utils'

export type HaramaqStatusVariant =
  | 'em_andamento'
  | 'concluidas'
  | 'gargalo'
  | 'em_espera'
  | 'pendencias'
  | 'info'
  | 'neutral'

interface MetricCardProps {
  label: string
  value: string | number
  unit?: string
  description?: string
  variant?: HaramaqStatusVariant
  icon?: React.ReactNode
  badge?: React.ReactNode
  onClick?: () => void
  className?: string
}

const variantStyles: Record<
  HaramaqStatusVariant,
  {
    dot: string
    title: string
    borderLeft: string
    badgeBg: string
    badgeText: string
  }
> = {
  em_andamento: {
    dot: 'bg-[#2563EB]',
    title: 'text-[#1E40AF]',
    borderLeft: 'border-l-[4px] border-l-[#2563EB]',
    badgeBg: 'bg-blue-50',
    badgeText: 'text-blue-700',
  },
  concluidas: {
    dot: 'bg-[#10B981]',
    title: 'text-[#065F46]',
    borderLeft: 'border-l-[4px] border-l-[#10B981]',
    badgeBg: 'bg-emerald-50',
    badgeText: 'text-emerald-700',
  },
  gargalo: {
    dot: 'bg-[#DC2626]',
    title: 'text-[#991B1B]',
    borderLeft: 'border-l-[4px] border-l-[#DC2626]',
    badgeBg: 'bg-red-50',
    badgeText: 'text-red-700',
  },
  em_espera: {
    dot: 'bg-[#F59E0B]',
    title: 'text-[#92400E]',
    borderLeft: 'border-l-[4px] border-l-[#F59E0B]',
    badgeBg: 'bg-amber-50',
    badgeText: 'text-amber-700',
  },
  pendencias: {
    dot: 'bg-[#64748B]',
    title: 'text-[#334155]',
    borderLeft: 'border-l-[4px] border-l-[#64748B]',
    badgeBg: 'bg-slate-50',
    badgeText: 'text-slate-700',
  },
  info: {
    dot: 'bg-[#0284C7]',
    title: 'text-[#0369A1]',
    borderLeft: 'border-l-[4px] border-l-[#0284C7]',
    badgeBg: 'bg-sky-50',
    badgeText: 'text-sky-700',
  },
  neutral: {
    dot: 'bg-[#94A3B8]',
    title: 'text-[#475569]',
    borderLeft: 'border-l-[4px] border-l-[#CBD5E1]',
    badgeBg: 'bg-gray-50',
    badgeText: 'text-gray-700',
  },
}

/**
 * MetricCard reproduction of the Haramaq KPI card row:
 * - White card, subtle border, rounded-xl
 * - Colored left border / colored status dot + uppercase label
 * - Huge bold number + unit next to it
 * - Small contextual description underneath
 */
export function MetricCard({
  label,
  value,
  unit,
  description,
  variant = 'neutral',
  icon,
  badge,
  onClick,
  className,
}: MetricCardProps) {
  const v = variantStyles[variant]

  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-white rounded-xl border border-[#E2E8F0] p-4 sm:p-5 shadow-xs transition-all duration-150',
        v.borderLeft,
        onClick && 'cursor-pointer hover:shadow-sm hover:border-[#CBD5E1]',
        className,
      )}
    >
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={cn('w-2 h-2 rounded-full shrink-0', v.dot)} />
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#475569] truncate">
            {label}
          </span>
        </div>
        {badge || (icon && <span className="text-[#64748B] shrink-0">{icon}</span>)}
      </div>

      <div className="flex items-baseline gap-1.5 mt-1">
        <span className="text-2xl sm:text-3xl font-extrabold text-[#1E293B] tracking-tight tabular-nums">
          {value}
        </span>
        {unit && <span className="text-xs sm:text-sm font-medium text-[#64748B]">{unit}</span>}
      </div>

      {description && <p className="text-[11px] text-[#64748B] mt-1 line-clamp-1">{description}</p>}
    </div>
  )
}

export default MetricCard
