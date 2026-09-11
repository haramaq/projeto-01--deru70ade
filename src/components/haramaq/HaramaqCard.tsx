import React from 'react'
import { cn } from '@/lib/utils'

interface HaramaqTabsProps<T extends string> {
  tabs: { id: T; label: string; count?: number; icon?: React.ReactNode }[]
  activeTab: T
  onChange: (id: T) => void
  className?: string
}

/**
 * Top horizontal module/segmented tabs matching the reference screenshot:
 * Pill container with white active card, soft background, red accent on active.
 */
export function HaramaqTabs<T extends string>({
  tabs,
  activeTab,
  onChange,
  className,
}: HaramaqTabsProps<T>) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 p-1 bg-[#EAECEF] rounded-xl border border-[#E2E8F0] shadow-2xs max-w-full overflow-x-auto',
        className,
      )}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn(
              'flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all duration-150',
              isActive
                ? 'bg-white text-[#D92323] shadow-xs font-bold border border-black/5'
                : 'text-[#475569] hover:text-[#1E293B] hover:bg-white/60',
            )}
          >
            {tab.icon && <span className="shrink-0">{tab.icon}</span>}
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span
                className={cn(
                  'text-[10px] font-bold px-1.5 py-0.2 rounded-full',
                  isActive ? 'bg-[#FEE2E2] text-[#DC2626]' : 'bg-[#CBD5E1] text-[#334155]',
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

interface HaramaqCardProps {
  children: React.ReactNode
  title?: React.ReactNode
  subtitle?: React.ReactNode
  headerActions?: React.ReactNode
  footer?: React.ReactNode
  variant?: 'default' | 'danger-alert' | 'highlight'
  className?: string
  noPadding?: boolean
}

/**
 * Standard card pattern:
 * - White background (#FFFFFF)
 * - Controlled subtle border (#E2E8F0)
 * - Rounded-xl (12px)
 * - Subtle shadow
 */
export function HaramaqCard({
  children,
  title,
  subtitle,
  headerActions,
  footer,
  variant = 'default',
  className,
  noPadding = false,
}: HaramaqCardProps) {
  const variantStyles = {
    default: 'border-[#E2E8F0] bg-white',
    'danger-alert': 'border-[#FCA5A5] bg-white ring-1 ring-[#FEE2E2]',
    highlight: 'border-[#DC2626]/40 bg-white ring-1 ring-[#DC2626]/10',
  }[variant]

  return (
    <div className={cn('rounded-xl border shadow-xs transition-shadow', variantStyles, className)}>
      {(title || headerActions) && (
        <div className="px-5 py-4 border-b border-[#F1F5F9] flex items-center justify-between gap-3">
          <div>
            {typeof title === 'string' ? (
              <h3 className="font-bold text-sm text-[#1E293B] tracking-tight">{title}</h3>
            ) : (
              title
            )}
            {subtitle && <p className="text-xs text-[#64748B] mt-0.5">{subtitle}</p>}
          </div>
          {headerActions && <div className="flex items-center gap-2 shrink-0">{headerActions}</div>}
        </div>
      )}

      <div className={cn(!noPadding && 'p-5')}>{children}</div>

      {footer && (
        <div className="px-5 py-3 border-t border-[#F1F5F9] bg-[#FAFAFA] rounded-b-xl flex items-center justify-between text-xs">
          {footer}
        </div>
      )}
    </div>
  )
}

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

export function HaramaqEmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'py-12 px-4 text-center flex flex-col items-center justify-center max-w-sm mx-auto',
        className,
      )}
    >
      {icon && (
        <div className="w-12 h-12 rounded-xl bg-[#FEE2E2]/60 text-[#D92323] flex items-center justify-center mb-3">
          {icon}
        </div>
      )}
      <h3 className="font-bold text-sm text-[#1E293B] mb-1">{title}</h3>
      {description && <p className="text-xs text-[#64748B] mb-4 leading-relaxed">{description}</p>}
      {action}
    </div>
  )
}

export default HaramaqCard
