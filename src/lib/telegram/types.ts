export type Actor = { userId: number; chatId: number }
export type Button = { text: string; callback_data: string }
export type ActionState = 'ready' | 'awaiting_email' | 'confirm' | 'processing' | 'done' | 'uncertain' | 'cancelled'
export type SupportAction = Actor & {
  id: string; kind: 'resend' | 'correct'; customerId: string; storeId: string
  expectedEmail: string; newEmail: string | null; state: ActionState; expiresAt: string
  promptId: number | null; logId: string | null; result: string | null
}
export type CustomerLookup = {
  customer: { id: string; email: string; name: string; blocked: boolean } | null
  storeId: string; storeName: string
  orders: { transaction: string; status: string }[]
  products: { id: string; title: string; level: 'basic' | 'complete' }[]
  delivery: string
  suggestions: { id: string; email: string; name: string }[]
}
export type ActionResult = { state: 'done' | 'uncertain'; text: string; logId?: string }
export interface SupportRepository {
  acceptUpdate(id: number): Promise<boolean>
  createAction(action: Omit<SupportAction, 'id' | 'promptId' | 'newEmail' | 'logId' | 'result'>): Promise<SupportAction>
  getAction(id: string, actor: Actor): Promise<SupportAction | null>
  transition(id: string, actor: Actor, from: ActionState[], patch: Partial<Pick<SupportAction, 'state' | 'newEmail' | 'promptId' | 'logId' | 'result'>>): Promise<SupportAction | null>
  findReply(actor: Actor, promptId: number): Promise<SupportAction | null>
  claim(id: string, actor: Actor): Promise<SupportAction | null>
}
export type SupportDeps = {
  allowedUsers: number[]; now: () => Date; repo: SupportRepository
  io: { send(chatId: number, text: string, buttons?: Button[][], forceReply?: boolean): Promise<number>; ack(id: string): Promise<void> }
  ops: { lookup(email: string): Promise<CustomerLookup>; lookupId(id: string): Promise<CustomerLookup | null>; execute(action: SupportAction): Promise<ActionResult> }
}
