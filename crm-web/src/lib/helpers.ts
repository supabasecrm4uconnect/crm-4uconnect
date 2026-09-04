import type { ActivityType, ActivityStatus, LossReason } from '../types'

const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  ligar:              'Ligar',
  enviar_mensagem:    'Enviar mensagem',
  retornar_orcamento: 'Retornar orçamento',
  cobrar_resposta:    'Cobrar resposta',
  reuniao:            'Reunião',
  enviar_proposta:    'Enviar proposta',
  pos_venda:          'Pós-venda',
}

export function activityTypeLabel(type: ActivityType): string {
  return ACTIVITY_TYPE_LABELS[type]
}

export function allActivityTypes(): { value: ActivityType; label: string }[] {
  return (Object.keys(ACTIVITY_TYPE_LABELS) as ActivityType[]).map(value => ({ value, label: activityTypeLabel(value) }))
}

const ACTIVITY_STATUS_STYLE: Record<ActivityStatus, { label: string; color: string; bg: string }> = {
  pendente:  { label: 'Pendente',  color: 'text-amber-700',   bg: 'bg-amber-50'   },
  concluida: { label: 'Concluída', color: 'text-emerald-700', bg: 'bg-emerald-50' },
  cancelada: { label: 'Cancelada', color: 'text-slate-600',   bg: 'bg-slate-100'  },
  atrasada:  { label: 'Atrasada',  color: 'text-red-600',     bg: 'bg-red-50'     },
}

export function activityStatusConfig(status: ActivityStatus): { label: string; color: string; bg: string } {
  return ACTIVITY_STATUS_STYLE[status]
}

const LOSS_REASON_LABELS: Record<LossReason, string> = {
  preco:            'Preço',
  concorrencia:     'Concorrência',
  sem_resposta:     'Não respondeu',
  sem_orcamento:    'Sem orçamento',
  timing:           'Não era o momento',
  nao_qualificado:  'Não qualificado',
  outro:            'Outro',
}

export function lossReasonLabel(reason: string): string {
  return (LOSS_REASON_LABELS as Record<string, string>)[reason] ?? reason
}

export function allLossReasons(): { value: LossReason; label: string }[] {
  return (Object.keys(LOSS_REASON_LABELS) as LossReason[]).map(value => ({ value, label: lossReasonLabel(value) }))
}

export function formatWhatsApp(number?: string | null): string {
  if (!number) return ''
  const str = String(number)
  const d = str.replace(/\D/g, '')
  if (!d) return str
  const local = d.startsWith('55') ? d.slice(2) : d
  if (local.length === 11) return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`
  if (local.length === 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`
  return str
}

export function normalizeWhatsApp(input?: string | null): string {
  if (!input) return ''
  const str = String(input)
  const d = str.replace(/\D/g, '')
  if (!d) return ''
  if (d.startsWith('55') && d.length >= 12) return d
  if (d.startsWith('0')) return '55' + d.slice(1)
  return '55' + d
}

export function whatsappLink(number?: string | null): string {
  if (!number) return '#'
  const normalized = normalizeWhatsApp(number)
  return normalized ? `https://wa.me/${normalized}` : '#'
}

/**
 * Gera as variantes de um número BR considerando o 9º dígito de celular.
 * Ex.: 554299981280 ≡ 5542999981280 — o mesmo contato pode estar gravado
 * com ou sem o 9. Usado para deduplicar na importação de leads.
 */
export function phoneVariants(input?: string | null): string[] {
  if (!input) return []
  const n = normalizeWhatsApp(input)
  if (!n) return []
  const variants = new Set<string>([n])
  if (n.startsWith('55') && n.length >= 12) {
    const ddd = n.slice(2, 4)
    const num = n.slice(4)
    if (num.length === 9 && num[0] === '9') variants.add('55' + ddd + num.slice(1))
    if (num.length === 8) variants.add('55' + ddd + '9' + num)
  }
  return [...variants]
}

export function formatCurrency(value: number | null | undefined): string {
  if (value == null) return ''
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/** Converte texto de planilha/usuário (ex: "1.500,00", "R$ 2000", "1500.50") em número. */
export function parseCurrency(input: string | number | null | undefined): number | null {
  if (input == null || input === '') return null
  if (typeof input === 'number') return Number.isFinite(input) ? input : null
  let s = String(input).replace(/[^\d.,-]/g, '').trim()
  if (!s) return null
  // Se tem vírgula e ponto, assume formato pt-BR (ponto=milhar, vírgula=decimal)
  if (s.includes(',') && s.includes('.')) {
    s = s.replace(/\./g, '').replace(',', '.')
  } else if (s.includes(',')) {
    s = s.replace(',', '.')
  }
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : null
}

/** Chave estável para comparar nomes de origens e segmentos sem criar cópias visuais. */
export function normalizeCatalogName(value?: string | null): string {
  return String(value ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR')
}

export function formatDate(dateStr?: string | null): string {
  if (!dateStr) return ''
  // Strings YYYY-MM-DD devem ser tratadas como data local, não UTC midnight
  const parts = String(dateStr).substring(0, 10).split('-').map(Number)
  if (parts.length < 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) return ''
  return new Date(parts[0], parts[1] - 1, parts[2]).toLocaleDateString('pt-BR')
}

export function formatDateTime(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export function getInitials(name?: string | null): string {
  if (!name) return '?'
  return String(name).trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?'
}

const avatarPalette = [
  'bg-blue-100 text-blue-700',
  'bg-violet-100 text-violet-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-cyan-100 text-cyan-700',
]

export function getAvatarColor(name?: string | null): string {
  if (!name) return avatarPalette[0]
  const str = String(name)
  const sum = str.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  return avatarPalette[sum % avatarPalette.length]
}

export function toDatetimeLocal(iso: string | null): string {
  if (!iso) return ''
  return iso.slice(0, 16)
}

export function localDateStr(): string {
  const n = new Date()
  const pad = (x: number) => String(x).padStart(2, '0')
  return `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`
}

export function isOverdue(dateStr?: string | null, timeStr?: string | null): boolean {
  if (!dateStr) return false
  const now = new Date()
  const today = localDateStr()
  const dateOnly = String(dateStr).slice(0, 10)

  if (dateOnly < today) return true
  if (dateOnly > today) return false

  // Se a data for hoje, compara o horário agendado com a hora atual
  if (timeStr) {
    const pad = (x: number) => String(x).padStart(2, '0')
    const currentTime = `${pad(now.getHours())}:${pad(now.getMinutes())}`
    const targetTime = String(timeStr).slice(0, 5)
    return targetTime < currentTime
  }

  return false
}

/** Estados finais do funil — mesma convenção usada em vários pontos do app (Dashboard, automação do Pipeline) */
export const TERMINAL_STATUSES: string[] = ['fechado', 'perdido']

/** Data local (YYYY-MM-DD) daqui a `days` dias (aceita negativo) */
export function addDaysLocal(days: number): string {
  const n = new Date()
  n.setDate(n.getDate() + days)
  const pad = (x: number) => String(x).padStart(2, '0')
  return `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`
}

export function allDepartments(): { value: string; label: string; bg: string; color: string; dot: string }[] {
  return [
    { value: 'comercial',   label: 'Comercial / Vendas',     bg: 'bg-emerald-50 text-emerald-800 border-emerald-200',  color: 'text-emerald-700', dot: '#10b981' },
    { value: 'atendimento', label: 'Atendimento / Suporte',  bg: 'bg-blue-50 text-blue-800 border-blue-200',        color: 'text-blue-700',    dot: '#3b82f6' },
    { value: 'sdr',         label: 'Pré-Vendas / SDR',       bg: 'bg-purple-50 text-purple-800 border-purple-200',    color: 'text-purple-700',  dot: '#a855f7' },
    { value: 'financeiro',  label: 'Financeiro / Cobrança',  bg: 'bg-amber-50 text-amber-800 border-amber-200',      color: 'text-amber-700',   dot: '#f59e0b' },
    { value: 'gestao',      label: 'Diretoria / Gestão',     bg: 'bg-slate-100 text-slate-800 border-slate-300',      color: 'text-slate-800',   dot: '#475569' },
  ]
}

export function departmentConfig(dep?: string | null) {
  const list = allDepartments()
  return list.find(d => d.value === dep) || {
    value: dep || 'comercial',
    label: dep ? dep.charAt(0).toUpperCase() + dep.slice(1) : 'Geral',
    bg: 'bg-slate-100 text-slate-700 border-slate-200',
    color: 'text-slate-700',
    dot: '#94a3b8',
  }
}

export function departmentLabel(dep?: string | null): string {
  return departmentConfig(dep).label
}
