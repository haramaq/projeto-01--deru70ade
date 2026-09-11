import React from 'react'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  onClear?: () => void
}

/**
 * Standard Haramaq search input:
 * Light border, rounded-lg, search icon, clear button.
 */
export function SearchInput({
  value,
  onChange,
  placeholder = 'Buscar...',
  className,
  onClear,
}: SearchInputProps) {
  return (
    <div className={cn('relative flex-1', className)}>
      <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-9 pr-8 h-9 text-xs bg-white border-[#E2E8F0] focus:border-[#D92323] focus:ring-[#D92323] rounded-lg shadow-2xs"
      />
      {value && (
        <button
          type="button"
          onClick={() => {
            onChange('')
            onClear?.()
          }}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#1E293B] p-0.5"
          aria-label="Limpar busca"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}

interface FilterBarProps {
  children: React.ReactNode
  className?: string
}

export function FilterBar({ children, className }: FilterBarProps) {
  return (
    <div
      className={cn(
        'bg-white p-3 sm:p-4 rounded-xl border border-[#E2E8F0] shadow-xs flex flex-col md:flex-row items-stretch md:items-center gap-2.5 sm:gap-3',
        className,
      )}
    >
      {children}
    </div>
  )
}

interface PrimaryButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'danger' | 'outline' | 'secondary' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  icon?: React.ReactNode
  children: React.ReactNode
}

/**
 * Haramaq primary operational button:
 * Institutional Red by default, accessible states, subtle scale.
 */
export function HaramaqButton({
  variant = 'danger',
  size = 'md',
  icon,
  children,
  className,
  disabled,
  ...props
}: PrimaryButtonProps) {
  const variantStyles = {
    danger:
      'bg-[#D92323] hover:bg-[#B91C1C] active:bg-[#991B1B] text-white shadow-xs focus:ring-[#DC2626]',
    outline:
      'bg-white border border-[#E2E8F0] hover:bg-[#F8FAFC] text-[#1E293B] hover:border-[#CBD5E1] shadow-2xs focus:ring-[#D92323]',
    secondary: 'bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#1E293B] focus:ring-[#D92323]',
    ghost: 'bg-transparent hover:bg-black/5 text-[#475569] hover:text-[#1E293B]',
  }[variant]

  const sizeStyles = {
    sm: 'h-8 px-2.5 text-xs rounded-lg gap-1.5',
    md: 'h-9 px-3.5 text-xs font-semibold rounded-lg gap-2',
    lg: 'h-10 px-4 text-sm font-semibold rounded-xl gap-2',
  }[size]

  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        'inline-flex items-center justify-center font-medium transition-all duration-150 outline-none focus:ring-2 focus:ring-offset-1 select-none',
        variantStyles,
        sizeStyles,
        disabled && 'opacity-50 pointer-events-none',
        className,
      )}
      {...props}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
    </button>
  )
}

export default HaramaqButton
