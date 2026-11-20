import { Button } from '@/ui/primitives/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/ui/primitives/dropdown-menu'
import { FilterIcon } from '@/ui/primitives/icons'

const states = [
  ['running', 'Running'],
  ['paused', 'Paused'],
  ['ended', 'Ended'],
] as const

export type SandboxListState = (typeof states)[number][0]
export const DEFAULT_LIST_STATES: SandboxListState[] = ['running', 'paused']

export function StateFilter({
  selected,
  onChange,
}: {
  selected: SandboxListState[]
  onChange: (selected: SandboxListState[]) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" className="gap-2">
          <FilterIcon className="size-4 text-fg-tertiary" />
          STATE
          <span className="text-fg-tertiary">{selected.length}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {states.map(([state, label]) => (
          <DropdownMenuCheckboxItem
            key={state}
            checked={selected.includes(state)}
            onSelect={(event) => event.preventDefault()}
            onCheckedChange={(checked) =>
              onChange(
                checked
                  ? [...selected, state]
                  : selected.filter((value) => value !== state)
              )
            }
          >
            {label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
