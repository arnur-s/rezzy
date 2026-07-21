import { List } from '@/components/list'
import { resolveWorkspaceIcon } from '@/entities/workspace'
import type { Workspace } from '@/entities/workspace'
import {
  useRecentContacts,
  useRecentWorkspaces,
} from '@/features/dashboard/hooks/use-recently-viewed'
import { m } from '@/paraglide/messages'
import { Card, Tabs } from '@heroui/react'
import { Link } from '@tanstack/react-router'
import { DynamicIcon } from 'lucide-react/dynamic'
import { useMemo } from 'react'

type Props = {
  workspaces: Array<Workspace>
}

export function QuickAccessPanel({ workspaces }: Props) {
  const { items: recentWorkspaces } = useRecentWorkspaces()
  const { items: contacts } = useRecentContacts()
  const workspaceById = useMemo(
    () => new Map(workspaces.map((workspace) => [workspace.id, workspace])),
    [workspaces],
  )

  return (
    <Card className="h-full">
      <Card.Header className="space-y-0 pb-2">
        <Card.Title className="text-sm font-semibold">
          {m.home_quick_access_title()}
        </Card.Title>
      </Card.Header>
      <Card.Content>
        <Tabs variant="secondary" defaultSelectedKey="workspaces">
          <Tabs.ListContainer>
            <Tabs.List aria-label={m.home_quick_access_title()}>
              <Tabs.Tab id="workspaces">
                {m.home_quick_access_tab_workspaces()}
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab id="contacts">
                {m.home_quick_access_tab_contacts()}
                <Tabs.Indicator />
              </Tabs.Tab>
            </Tabs.List>
          </Tabs.ListContainer>

          <Tabs.Panel id="workspaces" className="pt-3">
            {recentWorkspaces.length === 0 ? (
              <EmptyState message={m.home_quick_access_empty_workspaces()} />
            ) : (
              <List size="sm" className="-mx-1">
                {recentWorkspaces.map((entry) => (
                  <List.Item key={entry.id}>
                    <Link to="/workspaces/$id" params={{ id: entry.id }}>
                      <WorkspaceMark
                        icon={workspaceById.get(entry.id)?.icon ?? entry.icon}
                      />
                      <span className="text-foreground min-w-0 flex-1 truncate">
                        {entry.name}
                      </span>
                    </Link>
                  </List.Item>
                ))}
              </List>
            )}
          </Tabs.Panel>

          <Tabs.Panel id="contacts" className="pt-3">
            {contacts.length === 0 ? (
              <EmptyState message={m.home_quick_access_empty_contacts()} />
            ) : (
              <List size="sm" className="-mx-1">
                {contacts.map((entry) => (
                  <List.Item key={entry.id}>
                    <Link
                      to="/workspaces/$id/contacts"
                      params={{ id: entry.workspaceId ?? '' }}
                    >
                      <Mark name={entry.name} />
                      <span className="text-foreground min-w-0 flex-1 truncate">
                        {entry.name}
                      </span>
                    </Link>
                  </List.Item>
                ))}
              </List>
            )}
          </Tabs.Panel>
        </Tabs>
      </Card.Content>
    </Card>
  )
}

function Mark({ name }: { name: string }) {
  const initial = name.trim().charAt(0).toUpperCase() || '?'
  return (
    <span
      aria-hidden="true"
      className="bg-accent/10 text-accent flex size-6 shrink-0 items-center justify-center rounded-md text-[11px] font-semibold"
    >
      {initial}
    </span>
  )
}

function WorkspaceMark({ icon }: { icon: string | undefined }) {
  return (
    <span
      aria-hidden="true"
      className="bg-accent/10 text-accent flex size-6 shrink-0 items-center justify-center rounded-md"
    >
      <DynamicIcon name={resolveWorkspaceIcon(icon)} className="size-3.5" />
    </span>
  )
}

function EmptyState({ message }: { message: string }) {
  return <p className="text-foreground/50 px-1 py-2 text-xs">{message}</p>
}
