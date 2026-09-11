import React from 'react'
import { cn } from '@/lib/utils'

interface HaramaqLogoProps {
  module?: string
  size?: 'sm' | 'md' | 'lg'
  inverted?: boolean
  className?: string
}

/**
 * Standard Haramaq institutional logo:
 * - White/red square icon tile containing a bold "H" (with red accents)
 * - Bold uppercase wordmark "HARAMAQ"
 * - Module tag in lighter weight (e.g. "CRM", "Inspeção")
 */
export function HaramaqLogo({
  module = 'CRM',
  size = 'md',
  inverted = true, // inverted = white on red background (default for header)
  className,
}: HaramaqLogoProps) {
  const isSm = size === 'sm'
  const isLg = size === 'lg'

  return (
    <div className={cn('flex items-center gap-2.5 select-none', className)}>
      {/* Square Tile with stylized 'H' matching reference screenshots */}
      <div
        className={cn(
          'flex items-center justify-center font-black rounded-[6px] shrink-0 transition-transform shadow-xs',
          isSm && 'w-7 h-7 text-sm rounded-[5px]',
          size === 'md' && 'w-8 h-8 text-base rounded-[6px]',
          isLg && 'w-10 h-10 text-xl rounded-[8px]',
          inverted
            ? 'bg-white text-[#D92323] border border-white/20'
            : 'bg-[#D92323] text-white shadow-xs',
        )}
      >
        <span className="font-extrabold tracking-tighter leading-none flex items-center justify-center">
          H
        </span>
      </div>

      {/* Wordmark + Module */}
      <div className="flex items-baseline gap-1.5 leading-none">
        <span
          className={cn(
            'font-black tracking-tight uppercase',
            isSm && 'text-base',
            size === 'md' && 'text-lg',
            isLg && 'text-2xl',
            inverted ? 'text-white' : 'text-[#1E293B]',
          )}
        >
          HARAMAQ
        </span>
        {module && (
          <span
            className={cn(
              'font-light tracking-normal',
              isSm && 'text-sm',
              size === 'md' && 'text-base',
              isLg && 'text-xl',
              inverted ? 'text-white/90' : 'text-[#64748B]',
            )}
          >
            {module}
          </span>
        )}
      </div>
    </div>
  )
}

export default HaramaqLogo
