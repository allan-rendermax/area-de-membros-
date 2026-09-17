const OUTCOME_LABEL: Record<string, string> = {
  liberado: 'Liberado',
  atualizado: 'Atualizado',
  sem_mudanca: 'Sem mudança',
  codigo_desconhecido: 'Código desconhecido',
  ignorado: 'Ignorado',
  invalido: 'Inválido',
  chave_invalida: 'Chave inválida',
  erro: 'Erro',
  processed: 'Processado',
  unauthorized: 'Chave inválida',
  invalid: 'Inválido',
  ignored: 'Ignorado',
  failed: 'Erro',
}

const OUTCOME_STYLE: Record<string, string> = {
  liberado: 'bg-sucesso/15 text-sucesso',
  atualizado: 'bg-alerta/15 text-alerta',
  codigo_desconhecido: 'bg-alerta/15 text-alerta',
  invalido: 'bg-destaque/15 text-destaque',
  chave_invalida: 'bg-destaque/15 text-destaque',
  erro: 'bg-destaque/15 text-destaque',
  failed: 'bg-destaque/15 text-destaque',
  unauthorized: 'bg-destaque/15 text-destaque',
  invalid: 'bg-destaque/15 text-destaque',
}

export function outcomeLabel(outcome: string | null): string {
  if (!outcome) return 'Processando'
  return OUTCOME_LABEL[outcome] ?? outcome
}

export function outcomeStyle(outcome: string | null): string {
  return (outcome && OUTCOME_STYLE[outcome]) || 'bg-superficie-2 text-texto-suave'
}

export const EMAIL_KIND_LABEL: Record<string, string> = {
  acesso_novo: 'Acesso chegou',
  produto_novo: 'Produto novo',
  reenvio: 'Reenvio',
}

export const EMAIL_STATUS_STYLE: Record<string, string> = {
  enviado: 'bg-sucesso/15 text-sucesso',
  falhou: 'bg-destaque/15 text-destaque',
  pendente: 'bg-alerta/15 text-alerta',
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
}

export const SUCCESS_STATUS_LABEL: Record<string, string> = {
  nunca_entrou: 'Nunca entrou',
  nao_abriu: 'Entrou e não abriu nada',
  ativo: 'Ativo',
  inativo: 'Inativo',
}

export const SUCCESS_STATUS_STYLE: Record<string, string> = {
  nunca_entrou: 'bg-destaque/15 text-destaque',
  nao_abriu: 'bg-alerta/15 text-alerta',
  ativo: 'bg-sucesso/15 text-sucesso',
  inativo: 'bg-superficie-2 text-texto-suave',
}
