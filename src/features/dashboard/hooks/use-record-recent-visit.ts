import {
  useRecentContacts,
  useRecentWorkspaces,
} from '@/features/dashboard/hooks/use-recently-viewed'
import { useEffect } from 'react'

/**
 * Records a workspace visit to the recently-viewed store once when the
 * workspace name becomes available. No-op if the name is missing.
 */
export function useRecordWorkspaceVisit(
  workspaceId: string | undefined,
  workspaceName: string | undefined,
) {
  const { record } = useRecentWorkspaces()

  useEffect(() => {
    if (!workspaceId || !workspaceName) return
    record({ id: workspaceId, name: workspaceName })
  }, [workspaceId, workspaceName, record])
}

/**
 * Records a contact visit to the recently-viewed store once when the
 * contact name and workspace become available.
 */
export function useRecordContactVisit(
  contactId: string | undefined,
  contactName: string | undefined,
  workspaceId: string | undefined,
) {
  const { record } = useRecentContacts()

  useEffect(() => {
    if (!contactId || !contactName || !workspaceId) return
    record({ id: contactId, name: contactName, workspaceId })
  }, [contactId, contactName, workspaceId, record])
}
