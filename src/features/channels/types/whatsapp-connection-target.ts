export type WhatsappConnectionTarget =
  | {
      kind: 'create'
      workspaceId: string
    }
  | {
      kind: 'reconnect'
      workspaceId: string
      channelId: string
    }
