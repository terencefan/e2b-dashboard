'use client'

import micromatch from 'micromatch'
import { usePathname } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { useClientConfig } from '@/features/client-config-provider'
import { SandboxIcon } from '@/ui/primitives/icons'
import { SIDEBAR_MAIN_LINKS, type SidebarNavItem } from '@/configs/sidebar'

import { useIsMobile } from '@/lib/hooks/use-mobile'
import { cn } from '@/lib/utils'
import { HoverPrefetchLink } from '@/ui/hover-prefetch-link'
import {
  SIDEBAR_TRANSITION_CLASSNAMES,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/ui/primitives/sidebar'

type GroupedLinks = {
  [key: string]: SidebarNavItem[]
}

const createGroupedLinks = (links: SidebarNavItem[]): GroupedLinks => {
  return links.reduce((acc, link) => {
    const group = link.group || 'ungrouped'
    if (!acc[group]) {
      acc[group] = []
    }
    acc[group].push(link)
    return acc
  }, {} as GroupedLinks)
}

export default function DashboardSidebarContent() {
  const pathname = usePathname()
  const isMobile = useIsMobile()
  const { setOpenMobile } = useSidebar()
  const { executionPool = 'pilot' } = useClientConfig()
  const [poolAccess, setPoolAccess] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    fetch('/access/pool-capability', {
      signal: controller.signal,
      cache: 'no-store',
    })
      .then((response) => setPoolAccess(response.status === 204))
      .catch(() => {})
    return () => controller.abort()
  }, [])

  const groupedNavLinks = useMemo(
    () =>
      createGroupedLinks(
        poolAccess
          ? [
              ...SIDEBAR_MAIN_LINKS,
              {
                label: 'Overview',
                group: 'Pool',
                href: `/pool?pool=${executionPool}`,
                icon: SandboxIcon,
                activeMatch: '/pool',
              },
              {
                label: 'Sandbox Heatmap',
                group: 'Pool',
                href: `/pool/heatmap?pool=${executionPool}`,
                icon: SandboxIcon,
                activeMatch: '/pool/heatmap',
              },
            ]
          : SIDEBAR_MAIN_LINKS
      ),
    [executionPool, poolAccess]
  )

  const isActive = (link: SidebarNavItem) => {
    if (!pathname || !link.activeMatch) return false

    return micromatch.isMatch(pathname, link.activeMatch)
  }

  return (
    <SidebarContent className="overflow-x-hidden gap-0">
      {Object.entries(groupedNavLinks).map(([group, links]) => (
        <SidebarGroup key={group}>
          {group !== 'ungrouped' && (
            <SidebarGroupLabel>{group}</SidebarGroupLabel>
          )}
          <SidebarMenu>
            {links.map((item) => {
              const href = item.href

              return (
                <SidebarMenuItem key={item.label}>
                  <SidebarMenuButton
                    isActive={isActive(item)}
                    asChild
                    tooltip={item.label}
                  >
                    <HoverPrefetchLink
                      href={href}
                      onClick={
                        isMobile
                          ? () => {
                              setOpenMobile(false)
                            }
                          : undefined
                      }
                    >
                      <item.icon
                        className={cn(
                          'transition-[size]',
                          SIDEBAR_TRANSITION_CLASSNAMES,
                          isActive(item) && 'text-accent-main-highlight'
                        )}
                      />
                      <span>{item.label}</span>
                    </HoverPrefetchLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            })}
          </SidebarMenu>
        </SidebarGroup>
      ))}
    </SidebarContent>
  )
}
