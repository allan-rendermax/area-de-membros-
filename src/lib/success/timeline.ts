export type TimelineEvent = { at: string; kind: 'pedido' | 'email' | 'acesso' | 'item'; title: string; detail: string }

export type TimelineInput = {
  orders: { createdAt: string; productName: string; productCode: string; status: string }[]
  emails: { createdAt: string; kind: string; status: string; error: string | null }[]
  devices: { firstSeenAt: string; lastSeenAt: string }[]
  itemOpens: { createdAt: string; itemTitle: string; productTitle: string }[]
}

const EMAIL_LABEL: Record<string, string> = {
  acesso_novo: 'acesso chegou',
  produto_novo: 'produto novo',
  reenvio: 'reenvio de acesso',
}

export function buildTimeline(input: TimelineInput): TimelineEvent[] {
  const events: TimelineEvent[] = []

  for (const o of input.orders) {
    events.push({ at: o.createdAt, kind: 'pedido', title: `Pedido ${o.status}: ${o.productName || o.productCode}`, detail: o.productCode })
  }
  for (const e of input.emails) {
    events.push({
      at: e.createdAt,
      kind: 'email',
      title: `E-mail: ${EMAIL_LABEL[e.kind] ?? e.kind}`,
      detail: e.error ? `${e.status} — ${e.error}` : e.status,
    })
  }
  if (input.devices.length > 0) {
    const first = input.devices.map((d) => d.firstSeenAt).sort((a, b) => Date.parse(a) - Date.parse(b))[0]
    const last = input.devices.map((d) => d.lastSeenAt).sort((a, b) => Date.parse(b) - Date.parse(a))[0]
    events.push({ at: first, kind: 'acesso', title: 'Primeiro acesso', detail: '' })
    if (Date.parse(last) !== Date.parse(first)) events.push({ at: last, kind: 'acesso', title: 'Último acesso', detail: '' })
  }
  for (const i of input.itemOpens) {
    events.push({ at: i.createdAt, kind: 'item', title: `Abriu "${i.itemTitle}"`, detail: i.productTitle })
  }

  return events.sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
}
