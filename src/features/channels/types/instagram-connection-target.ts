export type InstagramConnectionTarget =
  | {
      kind: 'create'
      workspaceId: string
    }
  | {
      kind: 'reconnect'
      workspaceId: string
      channelId: string
    }
