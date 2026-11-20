import { Button } from '@/ui/primitives/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/ui/primitives/dropdown-menu'
import { FilterIcon } from '@/ui/primitives/icons'

export function FilterDropdown<Value extends string>({
  label,
  options,
  selected,
  onChange,
  disabled,
}: {
  label: string
  options: ReadonlyMap<Value, string>
  selected: Value[]
  onChange: (selected: Value[]) => void
  disabled?: boolean
}) {
  const choices = new Map(options)
  for (const value of selected) {
    if (!choices.has(value)) choices.set(value, value)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="secondary"
          className="gap-1.5 px-2 sm:px-3"
          disabled={disabled}
        >
          <FilterIcon className="size-4 text-fg-tertiary" />
          {label}
          {selected.length > 0 && (
            <span className="text-fg-tertiary">{selected.length}</span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="max-h-72 max-w-72 overflow-y-auto"
      >
        {[...choices].map(([value, name]) => (
          <DropdownMenuCheckboxItem
            key={value}
            checked={selected.includes(value)}
            onSelect={(event) => event.preventDefault()}
            onCheckedChange={(checked) =>
              onChange(
                checked
                  ? [...selected, value]
                  : selected.filter((item) => item !== value)
              )
            }
          >
            <span className="truncate" title={name}>
              {name}
            </span>
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
