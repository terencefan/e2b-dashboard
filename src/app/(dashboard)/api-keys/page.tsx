'use client'

import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table'
import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useTimezone } from '@/features/dashboard/timezone'
import { useColumnSizeVars } from '@/lib/hooks/use-column-size-vars'
import useKeydown from '@/lib/hooks/use-keydown'
import {
  defaultErrorToast,
  defaultSuccessToast,
  useToast,
} from '@/lib/hooks/use-toast'
import { formatDateParts } from '@/lib/utils/formatting'
import { AlertDialog } from '@/ui/alert-dialog'
import ClientOnly from '@/ui/client-only'
import { DashboardTabsList } from '@/ui/dashboard-tabs'
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
} from '@/ui/data-table'
import Empty from '@/ui/empty'
import { Badge } from '@/ui/primitives/badge'
import { Button } from '@/ui/primitives/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ui/primitives/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/ui/primitives/dropdown-menu'
import { IconButton } from '@/ui/primitives/icon-button'
import {
  AddIcon,
  CopyIcon,
  IndicatorDotsIcon,
  ListIcon,
  RefreshIcon,
} from '@/ui/primitives/icons'
import { DebouncedInput, Input } from '@/ui/primitives/input'
import { Kbd } from '@/ui/primitives/kbd'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/primitives/select'
import { SIDEBAR_TRANSITION_CLASSNAMES } from '@/ui/primitives/sidebar'
import { RowHoverFrame } from '@/ui/row-hover-frame'

type ApiKey = {
  id: string
  name: string
  createdAt: string
  expiresAt: string
  active: boolean
}
type CreatedKey = { apiKey: string; expiresAt: string }
const LIFETIMES = [
  { hours: 1, label: '1 hour' },
  { hours: 8, label: '8 hours' },
  { hours: 24, label: '1 day' },
  { hours: 168, label: '7 days' },
  { hours: 720, label: '30 days' },
]

async function request<T>(path = '', options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/access/api-keys${path}`, {
    ...options,
    credentials: 'same-origin',
    redirect: 'error',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
  })
  const data = await response.json().catch(() => ({
    error: 'Request failed. Please refresh or sign in again.',
  }))
  if (!response.ok)
    throw new Error(data.error ?? 'Request failed. Please try again.')
  return data
}

function Timestamp({ value }: { value: string }) {
  const { timezone } = useTimezone()
  const formatted = formatDateParts(value, {
    timezone,
    format: 'date-year-time-no-seconds',
  })
  return (
    <span
      title={value}
      className="whitespace-nowrap font-mono prose-table-numeric"
    >
      <span className="text-fg">{formatted?.datePart ?? '--'}</span>{' '}
      <span className="text-fg-tertiary">
        {formatted?.timePart} {formatted?.timezonePart}
      </span>
    </span>
  )
}

export default function ApiKeysPage() {
  'use no memo'
  const { toast } = useToast()
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [search, setSearch] = useState('')
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'createdAt', desc: true },
  ])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState('')
  const [hours, setHours] = useState(8)
  const [created, setCreated] = useState<CreatedKey | null>(null)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [revokeKey, setRevokeKey] = useState<ApiKey | null>(null)
  const [revoking, setRevoking] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      setKeys((await request<{ keys: ApiKey[] }>()).keys)
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : 'Failed to load API keys.'
      )
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => {
    void load()
  }, [load])
  useKeydown((event) => {
    if (event.key === '/' && !createOpen && !revokeKey) {
      event.preventDefault()
      searchRef.current?.focus()
      return true
    }
  })
  const openCreate = () => {
    setName('')
    setHours(8)
    setCreated(null)
    setCreateError('')
    setCreateOpen(true)
  }
  const closeCreate = (open: boolean) => {
    if (creating) return
    setCreateOpen(open)
    if (!open) {
      setCreated(null)
      setCreateError('')
    }
  }
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setCreating(true)
    setCreateError('')
    try {
      setCreated(
        await request<CreatedKey>('', {
          method: 'POST',
          body: JSON.stringify({ name, hours }),
        })
      )
      await load()
    } catch (error) {
      setCreateError(
        error instanceof Error ? error.message : 'Failed to create API key.'
      )
    } finally {
      setCreating(false)
    }
  }
  async function revoke() {
    if (!revokeKey) return
    setRevoking(true)
    try {
      await request(`/${encodeURIComponent(revokeKey.id)}`, {
        method: 'DELETE',
      })
      setRevokeKey(null)
      toast(defaultSuccessToast('API key revoked.'))
      await load()
    } catch (error) {
      toast(
        defaultErrorToast(
          error instanceof Error ? error.message : 'Failed to revoke API key.'
        )
      )
    } finally {
      setRevoking(false)
    }
  }
  const columns = useMemo<ColumnDef<ApiKey>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Name',
        size: 240,
        minSize: 160,
        cell: ({ row }) => (
          <span className="truncate text-fg" title={row.original.name}>
            {row.original.name}
          </span>
        ),
      },
      {
        accessorKey: 'id',
        header: 'ID',
        size: 168,
        enableSorting: false,
        cell: ({ row }) => (
          <span
            className="truncate font-mono text-fg-tertiary"
            title={row.original.id}
          >
            {row.original.id}
          </span>
        ),
      },
      {
        accessorKey: 'createdAt',
        header: 'Created',
        size: 192,
        sortDescFirst: true,
        enableGlobalFilter: false,
        cell: ({ row }) => <Timestamp value={row.original.createdAt} />,
      },
      {
        accessorKey: 'expiresAt',
        header: 'Expires',
        size: 192,
        sortDescFirst: true,
        enableGlobalFilter: false,
        cell: ({ row }) => <Timestamp value={row.original.expiresAt} />,
      },
      {
        accessorKey: 'active',
        header: 'Status',
        size: 80,
        enableGlobalFilter: false,
        cell: ({ row }) => (
          <Badge variant={row.original.active ? 'positive' : 'default'}>
            {row.original.active ? 'Active' : 'Inactive'}
          </Badge>
        ),
      },
      {
        id: 'actions',
        header: '',
        size: 24,
        enableSorting: false,
        enableGlobalFilter: false,
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton
                className="relative z-10 size-5"
                aria-label={`Actions for ${row.original.name}`}
              >
                <IndicatorDotsIcon />
              </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuGroup>
                <DropdownMenuItem
                  variant="error"
                  onSelect={() => setRevokeKey(row.original)}
                >
                  Revoke key
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    []
  )
  const table = useReactTable({
    data: keys,
    columns,
    state: { globalFilter: search, sorting },
    onGlobalFilterChange: setSearch,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableMultiSort: false,
    enableSortingRemoval: false,
    enableColumnResizing: false,
  })
  const columnSizes = useColumnSizeVars(table)
  const rows = table.getRowModel().rows
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col pt-2 md:pt-3">
      <DashboardTabsList
        layoutKey="tabs-indicator-api-keys"
        tabs={[
          {
            id: 'list',
            label: 'List',
            href: '/api-keys',
            icon: <ListIcon className="size-4" />,
          },
        ]}
      />
      <ClientOnly className="flex h-full min-h-0 flex-col p-3 md:max-w-[calc(100svw-var(--sidebar-width-active))] md:p-6">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-3 max-sm:w-full">
            <div className="relative w-full sm:w-[280px]">
              <DebouncedInput
                ref={searchRef}
                aria-label="Search API keys"
                value={search}
                onChange={(value) => setSearch(String(value))}
                placeholder="Search by name or ID..."
                className="h-9 w-full pr-14"
                debounce={250}
                maxLength={128}
              />
              <Kbd
                keys={['/']}
                className="absolute top-1/2 right-2 -translate-y-1/2"
              />
            </div>
            <span className="prose-label-highlight flex h-9 items-center gap-1 uppercase">
              <span>
                {rows.length} {rows.length === 1 ? 'API key' : 'API keys'}
              </span>
              {search && <span className="text-fg-tertiary"> · filtered</span>}
            </span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <IconButton
              variant="secondary"
              aria-label="Refresh API keys"
              disabled={loading}
              onClick={() => void load()}
            >
              <RefreshIcon className={loading ? 'animate-spin' : ''} />
            </IconButton>
            <Button onClick={openCreate}>
              <AddIcon />
              Create API Key
            </Button>
          </div>
        </div>
        <div
          className={`mt-4 -mx-3 flex min-h-0 flex-1 overflow-x-auto bg-bg md:-mx-6 md:max-w-[calc(100svw-var(--sidebar-width-active))] ${SIDEBAR_TRANSITION_CLASSNAMES}`}
        >
          {loadError ? (
            <Empty
              title="Could Not Load API Keys"
              description={loadError}
              message={
                <Button asChild>
                  <a href="/oauth2/start">Sign in again</a>
                </Button>
              }
              className="min-h-72 px-3"
            />
          ) : loading && keys.length === 0 ? (
            <Empty
              title="Loading API Keys"
              description="Fetching your personal API keys..."
              className="min-h-72 px-3"
            />
          ) : keys.length === 0 || rows.length === 0 ? (
            <Empty
              title={search ? 'No Results Found' : 'No API Keys Yet'}
              description={
                search
                  ? 'No API keys match your current search.'
                  : 'Create a personal key to connect your SDK and scripts.'
              }
              message={
                <Button onClick={search ? () => setSearch('') : openCreate}>
                  {search ? 'Reset Filters' : 'Create API Key'}
                  {!search && <AddIcon />}
                </Button>
              }
              className="min-h-72 px-3"
            />
          ) : (
            <DataTable
              className={`h-full overflow-y-auto px-3 md:px-6 ${SIDEBAR_TRANSITION_CLASSNAMES}`}
              style={{
                ...columnSizes,
                minWidth: table.getTotalSize() + 24 * (columns.length - 1),
              }}
            >
              <DataTableHeader className="sticky top-0 z-30 bg-bg shadow-xs">
                {table.getHeaderGroups().map((group) => (
                  <DataTableRow
                    key={group.id}
                    className="-mx-2 w-[calc(100%+16px)] border-b-0 px-2"
                  >
                    {group.headers.map((header) => (
                      <DataTableHead
                        key={header.id}
                        header={header}
                        sorting={
                          sorting.find((sort) => sort.id === header.id)?.desc
                        }
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                      </DataTableHead>
                    ))}
                  </DataTableRow>
                ))}
              </DataTableHeader>
              <DataTableBody className={loading ? 'opacity-70' : ''}>
                {rows.map((row) => (
                  <DataTableRow
                    key={row.id}
                    className="group/row relative -mx-2 h-9 w-[calc(100%+16px)] border-b-0 px-2 transition-none hover:bg-bg-1"
                  >
                    <RowHoverFrame />
                    {row.getVisibleCells().map((cell) => (
                      <DataTableCell key={cell.id} cell={cell}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </DataTableCell>
                    ))}
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          )}
        </div>
      </ClientOnly>
      <Dialog open={createOpen} onOpenChange={closeCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {created ? 'API Key Created' : 'Create API Key'}
            </DialogTitle>
            <DialogDescription>
              {created
                ? 'Copy this key now. The full value will not be shown again.'
                : 'Create a personal key for SDK and script access. Keys are revoked when you leave the authorized team.'}
            </DialogDescription>
          </DialogHeader>
          {created ? (
            <>
              <pre
                id="new-api-key"
                className="select-all whitespace-pre-wrap break-all border bg-bg p-3 font-mono text-xs text-fg"
              >
                {created.apiKey}
              </pre>
              <p className="text-sm text-fg-tertiary">
                Expires <Timestamp value={created.expiresAt} />
              </p>
              <DialogFooter>
                <Button
                  variant="secondary"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(created.apiKey)
                      toast(defaultSuccessToast('API key copied.'))
                    } catch {
                      toast(
                        defaultErrorToast('Select and copy the key manually.')
                      )
                    }
                  }}
                >
                  <CopyIcon />
                  Copy Key
                </Button>
                <Button onClick={() => closeCreate(false)}>Done</Button>
              </DialogFooter>
            </>
          ) : (
            <form onSubmit={create} className="grid gap-4">
              <label htmlFor="api-key-name" className="grid gap-2">
                Name
                <Input
                  id="api-key-name"
                  autoFocus
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. local development"
                  maxLength={64}
                  required
                  autoComplete="off"
                />
              </label>
              <label htmlFor="api-key-lifetime" className="grid gap-2">
                Expires in
                <Select
                  value={String(hours)}
                  onValueChange={(value) => setHours(Number(value))}
                >
                  <SelectTrigger
                    id="api-key-lifetime"
                    aria-label="Key lifetime"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LIFETIMES.map((lifetime) => (
                      <SelectItem
                        key={lifetime.hours}
                        value={String(lifetime.hours)}
                      >
                        {lifetime.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              {createError && (
                <p role="alert" className="text-sm text-accent-error-highlight">
                  {createError}
                </p>
              )}
              <DialogFooter>
                <Button
                  type="button"
                  variant="quaternary"
                  onClick={() => closeCreate(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={creating}
                  loading={creating ? 'Creating...' : undefined}
                >
                  Create API Key
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={revokeKey !== null}
        onOpenChange={(open) => {
          if (!open && !revoking) setRevokeKey(null)
        }}
        title="Revoke API Key"
        description={
          <>
            Revoke{' '}
            <span className="font-medium text-fg">{revokeKey?.name}</span>? SDK
            requests using this key will immediately stop working.
          </>
        }
        confirm="Revoke Key"
        onConfirm={() => void revoke()}
        confirmProps={{
          disabled: revoking,
          loading: revoking ? 'Revoking...' : undefined,
        }}
      />
    </div>
  )
}
