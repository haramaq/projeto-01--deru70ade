import React from 'react'
import { cn } from '@/lib/utils'

interface PageContainerProps {
  children: React.ReactNode
  maxWidth?: 'default' | 'narrow' | 'wide' | 'full'
  className?: string
}

/**
 * Standardized controlled max-width container matching Haramaq reference webapps.
 * Centers content with balanced padding and controlled max-width.
 */
export function PageContainer({ children, maxWidth = 'default', className }: PageContainerProps) {
  const maxWidthClass = {
    narrow: 'max-w-4xl',
    default: 'max-w-[1360px]',
    wide: 'max-w-[1520px]',
    full: 'max-w-full',
  }[maxWidth]

  return (
    <div
      className={cn('w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 md:py-6', maxWidthClass, className)}
    >
      {children}
    </div>
  )
}

interface PageHeaderProps {
  title: string
  subtitle?: string
  badge?: React.ReactNode
  actions?: React.ReactNode
  breadcrumbs?: { label: string; href?: string }[]
  className?: string
}

export function PageHeader({ title, subtitle, badge, actions, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5',
        className,
      )}
    >
      <div className="space-y-0.5">
        <div className="flex items-center gap-2.5 flex-wrap">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1E293B]">{title}</h1>
          {badge}
        </div>
        {subtitle && (
          <p className="text-xs sm:text-sm text-[#64748B] font-normal leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap shrink-0">{actions}</div>}
    </div>
  )
}

export default PageContainer
