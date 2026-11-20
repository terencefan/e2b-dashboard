import * as React from 'react'
import { memo, useCallback } from 'react'
import { useDebounceValue } from 'usehooks-ts'
import type { SandboxStartedAtFilter } from '@/features/dashboard/sandboxes/list/stores/table-store'
import { useSandboxListTableStore } from '@/features/dashboard/sandboxes/list/stores/table-store'
import { cn } from '@/lib/utils'
import { formatCPUCores, formatMemory } from '@/lib/utils/formatting'
import { NumberInput } from '@/ui/number-input'
import { Button } from '@/ui/primitives/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/ui/primitives/dropdown-menu'
import { AddIcon, FilterIcon } from '@/ui/primitives/icons'
import { Input } from '@/ui/primitives/input'
import { Label } from '@/ui/primitives/label'
import { Separator } from '@/ui/primitives/separator'
import { TableFilterButton } from '@/ui/table-filter-button'

// Components
const RunningSinceFilter = memo(function RunningSinceFilter() {
  const startedAtFilter = useSandboxListTableStore(
    (state) => state.startedAtFilter
  )
  const setStartedAtFilter = useSandboxListTableStore(
    (state) => state.setStartedAtFilter
  )

  const handleRunningSince = useCallback(
    (value?: SandboxStartedAtFilter) => {
      if (!value) {
        setStartedAtFilter(undefined)
      } else {
        setStartedAtFilter(value)
      }
    },
    [setStartedAtFilter]
  )

  return (
    <div>
      <DropdownMenuItem
        className={cn(
          startedAtFilter === '1h ago' && 'text-accent-main-highlight '
        )}
        onClick={(e) => {
          e.preventDefault()
          handleRunningSince('1h ago')
        }}
      >
        1 hour ago
      </DropdownMenuItem>
      <DropdownMenuItem
        className={cn(
          startedAtFilter === '6h ago' && 'text-accent-main-highlight '
        )}
        onClick={(e) => {
          e.preventDefault()
          handleRunningSince('6h ago')
        }}
      >
        6 hours ago
      </DropdownMenuItem>
      <DropdownMenuItem
        className={cn(
          startedAtFilter === '12h ago' && 'text-accent-main-highlight '
        )}
        onClick={(e) => {
          e.preventDefault()
          handleRunningSince('12h ago')
        }}
      >
        12 hours ago
      </DropdownMenuItem>
    </div>
  )
})

const TemplateFilter = memo(function TemplateFilter() {
  const templateFilters = useSandboxListTableStore(
    (state) => state.templateFilters
  )
  const setTemplateFilters = useSandboxListTableStore(
    (state) => state.setTemplateFilters
  )

  const [localValue, setLocalValue] = React.useState('')

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value)
  }, [])

  const handleSubmit = useCallback(() => {
    const trimmedValue = localValue.trim().toLowerCase()
    if (trimmedValue && !templateFilters.includes(trimmedValue)) {
      setTemplateFilters([...templateFilters, trimmedValue])
      setLocalValue('')
    }
  }, [localValue, templateFilters, setTemplateFilters])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        handleSubmit()
      }
    },
    [handleSubmit]
  )

  return (
    <div className="w-80">
      <div className="flex items-center gap-2">
        <Input
          value={localValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Enter template name or ID..."
          className="w-full"
        />
        <Button
          variant={'secondary'}
          onClick={handleSubmit}
          disabled={!localValue.trim()}
        >
          <AddIcon className="size-3.5 min-w-3.5" />
        </Button>
      </div>
    </div>
  )
})

function MetadataFilter() {
  const filters = useSandboxListTableStore((state) => state.metadataFilters)
  const setFilters = useSandboxListTableStore(
    (state) => state.setMetadataFilters
  )
  const [key, setKey] = React.useState('')
  const [value, setValue] = React.useState('')
  const normalizedKey = key.trim()
  const canSubmit = Boolean(
    normalizedKey &&
      normalizedKey !== 'e2b_pool' &&
      (filters.some(([k]) => k === normalizedKey) || filters.length < 10)
  )

  return (
    <form
      className="flex max-w-[calc(100vw-2rem)] flex-col gap-2 p-2"
      onSubmit={(event) => {
        event.preventDefault()
        if (!canSubmit) return
        setFilters([
          ...filters.filter(([k]) => k !== normalizedKey),
          [normalizedKey, value],
        ])
        setKey('')
        setValue('')
      }}
    >
      <Input
        aria-label="Metadata key"
        placeholder="Key, e.g. pipeline"
        value={key}
        maxLength={128}
        onChange={(e) => setKey(e.target.value)}
      />
      <Input
        aria-label="Metadata value"
        placeholder="Exact value, e.g. swe2"
        value={value}
        maxLength={512}
        onChange={(e) => setValue(e.target.value)}
      />
      <Button type="submit" variant="secondary" disabled={!canSubmit}>
        Apply metadata filter
      </Button>
    </form>
  )
}

const ResourcesFilter = memo(function ResourcesFilter() {
  const cpuCount = useSandboxListTableStore((state) => state.cpuCount)
  const setCpuCount = useSandboxListTableStore((state) => state.setCpuCount)
  const memoryMB = useSandboxListTableStore((state) => state.memoryMB)
  const setMemoryMB = useSandboxListTableStore((state) => state.setMemoryMB)

  const [localValues, setLocalValues] = React.useState({
    cpu: cpuCount || 0,
    memory: memoryMB || 0,
  })

  const [debouncedValues] = useDebounceValue(localValues, 300)

  React.useEffect(() => {
    setLocalValues((previousValues) => {
      const syncedValues = {
        cpu: cpuCount || 0,
        memory: memoryMB || 0,
      }

      if (
        previousValues.cpu === syncedValues.cpu &&
        previousValues.memory === syncedValues.memory
      ) {
        return previousValues
      }

      return syncedValues
    })
  }, [cpuCount, memoryMB])

  React.useEffect(() => {
    const nextCpuCount = debouncedValues.cpu || undefined
    const nextMemoryMB = debouncedValues.memory || undefined

    setCpuCount(nextCpuCount)
    setMemoryMB(nextMemoryMB)
  }, [debouncedValues, setCpuCount, setMemoryMB])

  const handleCpuChange = useCallback((value: number) => {
    setLocalValues((prev) => ({ ...prev, cpu: value }))
  }, [])

  const handleMemoryChange = useCallback((value: number) => {
    setLocalValues((prev) => ({ ...prev, memory: value }))
  }, [])

  const handleClearCpu = useCallback(() => {
    setLocalValues((prev) => ({ ...prev, cpu: 0 }))
  }, [])

  const handleClearMemory = useCallback(() => {
    setLocalValues((prev) => ({ ...prev, memory: 0 }))
  }, [])

  const formatMemoryDisplay = (memoryValue: number) => {
    if (memoryValue === 0) return 'Unfiltered'
    return formatMemory(memoryValue)
  }

  return (
    <div className="w-80 p-4">
      <div className="grid gap-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>CPU Cores</Label>
            <span className="text-accent-main-highlight text-xs">
              {localValues.cpu === 0
                ? 'Unfiltered'
                : formatCPUCores(localValues.cpu)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <NumberInput
              value={localValues.cpu}
              onChange={handleCpuChange}
              min={0}
              max={8}
              step={1}
              className="w-full"
            />
            {localValues.cpu > 0 && (
              <Button
                variant="secondary"
                onClick={handleClearCpu}
                className="h-9 text-xs"
              >
                Clear
              </Button>
            )}
          </div>
        </div>
        <Separator />
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Memory</Label>
            <span className="text-accent-main-highlight text-xs">
              {formatMemoryDisplay(localValues.memory)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <NumberInput
              value={localValues.memory}
              onChange={handleMemoryChange}
              min={0}
              max={8192}
              step={512}
              className="w-full"
            />
            {localValues.memory > 0 && (
              <Button
                variant="secondary"
                onClick={handleClearMemory}
                className="h-9 text-xs"
              >
                Clear
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
})

// Main component
export interface SandboxesTableFiltersProps
  extends React.HTMLAttributes<HTMLDivElement> {}

const SandboxesTableFilters = memo(function SandboxesTableFilters({
  className,
  ...props
}: SandboxesTableFiltersProps) {
  const startedAtFilter = useSandboxListTableStore(
    (state) => state.startedAtFilter
  )
  const templateFilters = useSandboxListTableStore(
    (state) => state.templateFilters
  )
  const cpuCount = useSandboxListTableStore((state) => state.cpuCount)
  const memoryMB = useSandboxListTableStore((state) => state.memoryMB)
  const setStartedAtFilter = useSandboxListTableStore(
    (state) => state.setStartedAtFilter
  )
  const setTemplateFilters = useSandboxListTableStore(
    (state) => state.setTemplateFilters
  )
  const setCpuCount = useSandboxListTableStore((state) => state.setCpuCount)
  const setMemoryMB = useSandboxListTableStore((state) => state.setMemoryMB)

  const metadataFilters = useSandboxListTableStore(
    (state) => state.metadataFilters
  )
  const setMetadataFilters = useSandboxListTableStore(
    (state) => state.setMetadataFilters
  )

  const handleTemplateFilterClick = useCallback(
    (filter: string) => {
      setTemplateFilters(templateFilters.filter((t) => t !== filter))
    },
    [templateFilters, setTemplateFilters]
  )

  return (
    <div
      className={cn('flex min-w-0 flex-wrap items-center gap-1', className)}
      {...props}
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary" className="normal-case gap-2">
            <FilterIcon className="text-fg-tertiary size-4" /> Filters{' '}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuGroup>
            <DropdownMenuLabel>Filters</DropdownMenuLabel>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Started</DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent>
                  <RunningSinceFilter />
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Template</DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent>
                  <TemplateFilter />
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Metadata</DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent>
                  <MetadataFilter />
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Resources</DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent>
                  <ResourcesFilter />
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {startedAtFilter && (
        <TableFilterButton
          label="Started"
          value={startedAtFilter}
          onClick={() => setStartedAtFilter(undefined)}
        />
      )}
      {templateFilters.length > 0 &&
        templateFilters.map((filter) => (
          <TableFilterButton
            key={filter}
            label="Template"
            value={filter}
            onClick={() => handleTemplateFilterClick(filter)}
          />
        ))}
      {metadataFilters.map(([key, value]) => (
        <TableFilterButton
          key={key}
          label="Metadata"
          value={`${key}=${value}`}
          onClick={() =>
            setMetadataFilters(metadataFilters.filter(([item]) => item !== key))
          }
        />
      ))}
      {cpuCount !== undefined && (
        <TableFilterButton
          label="CPU"
          value={cpuCount.toString()}
          onClick={() => setCpuCount(undefined)}
        />
      )}
      {memoryMB !== undefined && (
        <TableFilterButton
          label="Memory"
          value={memoryMB.toString()}
          onClick={() => setMemoryMB(undefined)}
        />
      )}
    </div>
  )
})

SandboxesTableFilters.displayName = 'SandboxesTableFilters'

export default SandboxesTableFilters
