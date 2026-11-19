import { flexRender, type Row } from '@tanstack/react-table'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { memo } from 'react'
import { PROTECTED_URLS } from '@/configs/urls'
import { DataTableCell, DataTableRow } from '@/ui/data-table'
import type { SandboxListRow } from './table-config'

interface SandboxesTableRowProps {
  row: Row<SandboxListRow>
}

export const SandboxesTableRow = memo(function SandboxesTableRow({
  row,
}: SandboxesTableRowProps) {
  const router = useRouter()
  const href = PROTECTED_URLS.SANDBOX(row.original.sandboxID)
  return (
    <DataTableRow
      className="h-8 cursor-pointer hover:bg-bg-1"
      isSelected={row.getIsSelected()}
      onClick={(event) => {
        if (
          event.defaultPrevented ||
          !(event.target instanceof Element) ||
          event.target.closest('a, button, input, [role="dialog"]') ||
          window.getSelection()?.type === 'Range'
        )
          return
        router.push(href)
      }}
    >
      {row.getVisibleCells().map((cell) => {
        const content = flexRender(
          cell.column.columnDef.cell,
          cell.getContext()
        )
        return (
          <DataTableCell key={cell.id} cell={cell}>
            {cell.column.id === 'sandboxID' ? (
              <Link
                href={href}
                prefetch={false}
                className="block w-full min-w-0"
              >
                {content}
              </Link>
            ) : (
              content
            )}
          </DataTableCell>
        )
      })}
    </DataTableRow>
  )
})
