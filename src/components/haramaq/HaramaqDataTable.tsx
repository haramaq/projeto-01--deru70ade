import React from 'react'
import { cn } from '@/lib/utils'

interface Column<T> {
  key: string
  header: React.ReactNode
  render?: (row: T) => React.ReactNode
  align?: 'left' | 'center' | 'right'
  className?: string
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  keyExtractor: (row: T) => string
  emptyMessage?: string
  loading?: boolean
  className?: string
  onRowClick?: (row: T) => void
}

/**
 * Standardized data table matching the clean Haramaq high-density style:
 * Light gray headers (#F8FAFC), compact rows, subtle hover, clean borders.
 */
export function HaramaqDataTable<T>({
  columns,
  data,
  keyExtractor,
  emptyMessage = 'Nenhum registro encontrado.',
  loading = false,
  className,
  onRowClick,
}: DataTableProps<T>) {
  return (
    <div
      className={cn(
        'bg-white rounded-xl border border-[#E2E8F0] shadow-xs overflow-hidden',
        className,
      )}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#64748B] uppercase tracking-wider font-semibold">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    'py-3 px-4 font-semibold',
                    col.align === 'right' && 'text-right',
                    col.align === 'center' && 'text-center',
                    col.className,
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E2E8F0] text-[#1E293B]">
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="py-10 text-center text-[#64748B]">
                  <div className="inline-flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-[#D92323] border-t-transparent rounded-full animate-spin" />
                    <span>Carregando dados...</span>
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-10 text-center text-[#94A3B8]">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row) => (
                <tr
                  key={keyExtractor(row)}
                  onClick={() => onRowClick?.(row)}
                  className={cn(
                    'transition-colors',
                    onRowClick ? 'cursor-pointer hover:bg-[#F8FAFC]' : 'hover:bg-[#F8FAFC]/70',
                  )}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        'py-3 px-4 align-middle',
                        col.align === 'right' && 'text-right',
                        col.align === 'center' && 'text-center',
                        col.className,
                      )}
                    >
                      {col.render
                        ? col.render(row)
                        : (row as Record<string, unknown>)[col.key] != null
                          ? String((row as Record<string, unknown>)[col.key])
                          : '-'}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default HaramaqDataTable
