export type AgentConversation = {
  id: string
  storeId: string
  accountId: string
  platform: 'instagram' | 'facebook'
  customerName: string
  state: 'active' | 'escalated' | 'paused'
  pausedUntil: Date | null
  lastIncomingAt: Date | null
}

export type AgentMessage = {
  id: string
  direction: 'in' | 'out'
  author: 'cliente' | 'agente' | 'allan'
  text: string
  createdAt: Date
}
