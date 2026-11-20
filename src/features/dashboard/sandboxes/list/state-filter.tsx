import { FilterDropdown } from './filter-dropdown'

export type SandboxListState = 'running' | 'paused' | 'ended'
export const DEFAULT_LIST_STATES: SandboxListState[] = ['running', 'paused']

const states = new Map<SandboxListState, string>([
  ['running', 'Running'],
  ['paused', 'Paused'],
  ['ended', 'Ended'],
])

export function StateFilter({
  selected,
  onChange,
}: {
  selected: SandboxListState[]
  onChange: (selected: SandboxListState[]) => void
}) {
  return (
    <FilterDropdown
      label="STATE"
      options={states}
      selected={selected}
      onChange={onChange}
    />
  )
}
