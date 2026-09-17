export const ui = {
  h1: 'text-xl font-bold',
  card: 'rounded-lg border border-borda bg-superficie',
  label: 'flex flex-col gap-1 text-sm font-medium text-texto-suave',
  input:
    'rounded-md border border-borda bg-fundo px-3 py-2 text-base font-normal text-texto placeholder:text-texto-suave focus:border-destaque focus:outline-none',
  checkbox: 'flex items-center gap-2 text-sm font-medium text-texto',
  button: 'rounded-md bg-destaque px-4 py-2 text-sm font-semibold text-white hover:bg-destaque-hover disabled:opacity-60',
  buttonGhost: 'rounded-md border border-borda px-3 py-2 text-sm text-texto hover:bg-superficie-2',
  buttonDanger: 'rounded-md border border-destaque/50 px-3 py-2 text-sm text-destaque hover:bg-destaque/10',
  table: 'w-full min-w-[640px] text-left text-sm',
  th: 'px-4 py-2 font-medium text-texto-suave',
  td: 'px-4 py-2 align-top',
  pill: 'inline-block rounded-full px-2 py-0.5 text-xs font-medium',
  notice: 'rounded-md border border-borda bg-superficie-2 px-3 py-2 text-sm',
  chip: (active: boolean) =>
    `rounded-full px-3 py-1 text-sm ${active ? 'bg-destaque text-white' : 'bg-superficie-2 text-texto-suave hover:text-texto'}`,
} as const
