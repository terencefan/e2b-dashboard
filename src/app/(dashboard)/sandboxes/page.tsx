import { SandboxesPageContent } from '@/features/dashboard/sandboxes/list/page-content'
import { HydrateClient, prefetch, trpc } from '@/trpc/server'

export default async function SandboxesListPage() {
  prefetch(
    trpc.sandboxes.listSandboxesPaginated.infiniteQueryOptions({
      limit: 50,
    })
  )

  return (
    <HydrateClient>
      <SandboxesPageContent />
    </HydrateClient>
  )
}
