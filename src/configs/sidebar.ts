import {
  type Icon,
  KeyIcon,
  SandboxIcon,
  TemplateIcon,
} from '@/ui/primitives/icons'
import { PROTECTED_URLS } from './urls'

export type SidebarNavItem = {
  label: string
  href: string
  icon: Icon
  group?: string
  activeMatch?: string
}

export const SIDEBAR_MAIN_LINKS: SidebarNavItem[] = [
  {
    label: 'API Keys',
    href: PROTECTED_URLS.API_KEYS,
    icon: KeyIcon,
    activeMatch: '/api-keys',
  },
  {
    label: 'Sandboxes',
    href: PROTECTED_URLS.SANDBOXES,
    icon: SandboxIcon,
    activeMatch: `/sandboxes/**`,
  },
  {
    label: 'Templates',
    href: PROTECTED_URLS.TEMPLATES,
    icon: TemplateIcon,
    activeMatch: `/templates/**`,
  },
]

export const SIDEBAR_ALL_LINKS = [...SIDEBAR_MAIN_LINKS]
