'use client'

import {
  keepPreviousData,
  useSuspenseInfiniteQuery,
} from '@tanstack/react-query'
import {
  type ColumnDef,
  type ColumnFiltersState,
  type ColumnSizingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { subHours } from 'date-fns'
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { useLocalStorage } from 'usehooks-ts'
import { useSandboxListTableStore } from '@/features/dashboard/sandboxes/list/stores/table-store'
import { useColumnSizeVars } from '@/lib/hooks/use-column-size-vars'
import { cn } from '@/lib/utils'
import { useTRPC } from '@/trpc/client'
import ClientOnly from '@/ui/client-only'
import {
  DataTable,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
} from '@/ui/data-table'
import { SIDEBAR_TRANSITION_CLASSNAMES } from '@/ui/primitives/sidebar'
import { SandboxesHeader } from './header'
import { useSandboxHistory } from './history'
import {
  DEFAULT_LIST_STATES,
  type SandboxListState,
  StateFilter,
} from './state-filter'
import type { SandboxStartedAtFilter } from './stores/table-store'
import { getSandboxListEffectiveSorting } from './stores/table-store'
import { SandboxesTableBody } from './table-body'
import type { SandboxListRow } from './table-config'
import { sandboxIdFuzzyFilter, sandboxListColumns } from './table-config'

const STARTED_AT_FILTER_HOURS: Record<
  Exclude<SandboxStartedAtFilter, undefined>,
  number
> = {
  '1h ago': 1,
  '6h ago': 6,
  '12h ago': 12,
}

function buildColumnFilters({
  startedAtFilter,
  templateFilters,
  cpuCount,
  memoryMB,
}: {
  startedAtFilter: SandboxStartedAtFilter
  templateFilters: string[]
  cpuCount?: number
  memoryMB?: number
}): ColumnFiltersState {
  const filters: ColumnFiltersState = []

  if (startedAtFilter) {
    const now = new Date()
    const from = subHours(now, STARTED_AT_FILTER_HOURS[startedAtFilter])

    filters.push({ id: 'startedAt', value: { from, to: now } })
  }

  if (templateFilters.length > 0) {
    filters.push({ id: 'template', value: templateFilters })
  }

  if (cpuCount) {
    filters.push({ id: 'cpuUsage', value: cpuCount })
  }

  if (memoryMB) {
    filters.push({ id: 'ramUsage', value: memoryMB })
  }

  return filters
}

const SANDBOXES_PAGE_SIZE = 50

interface SandboxesTableViewProps {
  sandboxes: SandboxListRow[]
  stateFilter: ReactNode
  stateFiltered: boolean
  historyMessage?: string
  resetStates: () => void
  columns: ColumnDef<SandboxListRow>[]
  refetch: () => void
  isFetching: boolean
  hasNextPage?: boolean
  isFetchingNextPage?: boolean
  fetchNextPage?: () => void
  creator?: string
  creatorSandboxIDs?: ReadonlySet<string>
  templateID?: string
  clearUsageFilters?: () => void
}

function SandboxesTableView({
  sandboxes,
  stateFilter,
  stateFiltered,
  historyMessage,
  resetStates,
  columns,
  refetch,
  isFetching,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  creator,
  creatorSandboxIDs,
  templateID,
  clearUsageFilters,
}: SandboxesTableViewProps) {
  'use no memo'

  const scrollRef = useRef<HTMLDivElement>(null)

  const [columnSizing, setColumnSizing] = useLocalStorage<ColumnSizingState>(
    'sandboxes:columnSizing:v2',
    {},
    {
      deserializer: (value) => JSON.parse(value),
      serializer: (value) => JSON.stringify(value),
    }
  )

  const {
    startedAtFilter,
    templateFilters,
    cpuCount,
    memoryMB,
    sorting,
    globalFilter,
    setSorting,
    setGlobalFilter,
  } = useSandboxListTableStore()

  const columnFilters = useMemo(
    () =>
      buildColumnFilters({
        startedAtFilter,
        templateFilters,
        cpuCount,
        memoryMB,
      }),
    [startedAtFilter, templateFilters, cpuCount, memoryMB]
  )

  const usageFilteredSandboxes = useMemo(
    () =>
      creator || templateID
        ? sandboxes.filter(
            (row) =>
              (!creator ||
                (row.state === 'ended'
                  ? (row.creatorID ?? 'unknown') === creator
                  : creatorSandboxIDs?.has(row.sandboxID))) &&
              (!templateID || row.templateID === templateID)
          )
        : sandboxes,
    [creator, creatorSandboxIDs, sandboxes, templateID]
  )

  const activeSorting = getSandboxListEffectiveSorting(sorting)

  const table = useReactTable<SandboxListRow>({
    columns,
    data: usageFilteredSandboxes,
    state: {
      globalFilter,
      sorting: activeSorting,
      columnSizing,
      columnFilters,
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableSorting: true,
    enableMultiSort: false,
    enableSortingRemoval: false,
    columnResizeMode: 'onChange',
    enableColumnResizing: true,
    enableGlobalFilter: true,
    globalFilterFn: sandboxIdFuzzyFilter,
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    onColumnSizingChange: setColumnSizing,
  })

  const columnSizeVars = useColumnSizeVars(table)
  const scrollResetKey = useMemo(
    () => JSON.stringify({ activeSorting, globalFilter, columnFilters }),
    [activeSorting, globalFilter, columnFilters]
  )

  useEffect(() => {
    void scrollResetKey

    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0
      scrollRef.current.scrollLeft = 0
    }
  }, [scrollResetKey])

  const tableSorting = table.getState().sorting

  return (
    <ClientOnly className="flex min-h-64 flex-1 flex-col">
      <SandboxesHeader
        table={table}
        onRefresh={refetch}
        isRefreshing={isFetching}
        stateFilter={stateFilter}
      />
      {historyMessage && (
        <output className="mt-2 text-xs text-fg-tertiary">
          {historyMessage}
        </output>
      )}

      <div
        className={cn(
          'bg-bg mt-4 flex-1 w-full overflow-x-auto md:max-w-[calc(calc(100svw-48px)-var(--sidebar-width-active))]',
          SIDEBAR_TRANSITION_CLASSNAMES
        )}
      >
        <DataTable
          className={cn(
            'h-full overflow-y-auto md:min-w-[calc(100svw-48px-var(--sidebar-width-active))]',
            SIDEBAR_TRANSITION_CLASSNAMES
          )}
          style={{ ...columnSizeVars }}
          ref={scrollRef}
        >
          <DataTableHeader className="bg-bg sticky top-0 z-10 shadow-xs">
            {table.getHeaderGroups().map((headerGroup) => (
              <DataTableRow key={headerGroup.id} className="border-b-0">
                {headerGroup.headers.map((header) => (
                  <DataTableHead
                    key={header.id}
                    header={header}
                    sorting={tableSorting.find((s) => s.id === header.id)?.desc}
                    align={
                      header.id === 'cpuUsage' ||
                      header.id === 'ramUsage' ||
                      header.id === 'diskUsage'
                        ? 'right'
                        : 'left'
                    }
                  >
                    <span>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </span>
                  </DataTableHead>
                ))}
              </DataTableRow>
            ))}
          </DataTableHeader>
          <SandboxesTableBody
            table={table}
            scrollRef={scrollRef}
            hasNextPage={hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
            fetchNextPage={fetchNextPage}
            clearUsageFilters={
              stateFiltered || creator || templateID
                ? () => {
                    resetStates()
                    clearUsageFilters?.()
                  }
                : undefined
            }
          />
        </DataTable>
      </div>
    </ClientOnly>
  )
}

export function NewSandboxesTable({
  creator,
  creatorSandboxIDs,
  templateID,
  clearUsageFilters,
}: Pick<
  SandboxesTableViewProps,
  'creator' | 'creatorSandboxIDs' | 'templateID' | 'clearUsageFilters'
>) {
  const trpc = useTRPC()
  const pollingInterval = useSandboxListTableStore(
    (state) => state.pollingInterval
  )

  const {
    data,
    refetch,
    isFetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useSuspenseInfiniteQuery(
    trpc.sandboxes.listSandboxesPaginated.infiniteQueryOptions(
      { limit: SANDBOXES_PAGE_SIZE },
      {
        getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
        initialCursor: undefined,
        refetchOnMount: 'always',
        refetchOnWindowFocus: true,
        refetchInterval: pollingInterval > 0 ? pollingInterval * 1_000 : false,
        placeholderData: keepPreviousData,
      }
    )
  )

  const [states, setStates] = useState<SandboxListState[]>(DEFAULT_LIST_STATES)
  const showEnded = states.includes('ended')
  const showActive = states.includes('running') || states.includes('paused')
  const history = useSandboxHistory(showEnded)
  const sandboxes = useMemo<SandboxListRow[]>(() => {
    const active = data.pages.flatMap((page) => page.sandboxes)
    const activeIDs = new Set(active.map((row) => row.sandboxID))
    const visibleActive = active.filter((row) => states.includes(row.state))
    const ended = showEnded
      ? (history.data?.pages.flatMap((page) => page.sandboxes) ?? [])
      : []
    const seen = new Set(activeIDs)
    const visibleEnded = ended.flatMap((row) => {
      if (seen.has(row.sandboxID)) return []
      seen.add(row.sandboxID)
      return [{ ...row, state: 'ended' as const }]
    })
    return [...visibleActive, ...visibleEnded]
  }, [data, history.data, showEnded, states])

  return (
    <SandboxesTableView
      sandboxes={sandboxes}
      columns={sandboxListColumns}
      refetch={() => {
        if (showActive) void refetch()
        if (showEnded) void history.refetch()
      }}
      isFetching={
        (showActive && isFetching) || (showEnded && history.isFetching)
      }
      hasNextPage={Boolean(
        (showActive && hasNextPage) || (showEnded && history.hasNextPage)
      )}
      isFetchingNextPage={
        (showActive && isFetchingNextPage) ||
        (showEnded && history.isFetchingNextPage)
      }
      fetchNextPage={() => {
        if (showActive && hasNextPage) void fetchNextPage()
        if (showEnded && history.hasNextPage) void history.fetchNextPage()
      }}
      creator={creator}
      creatorSandboxIDs={creatorSandboxIDs}
      stateFilter={<StateFilter selected={states} onChange={setStates} />}
      stateFiltered={!showActive || states.length !== 2 || showEnded}
      resetStates={() => setStates(DEFAULT_LIST_STATES)}
      historyMessage={
        !showEnded
          ? undefined
          : history.isError
            ? 'Ended sandbox history is temporarily unavailable.'
            : history.isPending
              ? 'Loading ended sandboxes…'
              : 'Ended history covers up to 7 days.'
      }
      templateID={templateID}
      clearUsageFilters={clearUsageFilters}
    />
  )
}
