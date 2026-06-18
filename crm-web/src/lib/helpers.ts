import type { ActivityType, ActivityStatus } from '../types'

export const activityTypeLabel: Record<ActivityType, string> = {
  ligar:              'Ligar',
  enviar_mensagem:    'Enviar mensagem',
  retornar_orcamento: 'Retornar orçamento',
  cobrar_resposta:    'Cobrar resposta',
  reuniao:            'Reunião',
  enviar_proposta:    'Enviar proposta',
  pos_venda:          'Pós-venda',
}

export const allActivityTypes = Object.entries(activityTypeLabel).map(([value, label]) => ({
  value: value as ActivityType,
  label,
}))

export const activityStatusConfig: Record<ActivityStatus, { label: string; color: string; bg: string }> = {
  pendente:  { label: 'Pendente',  color: 'text-amber-700',   bg: 'bg-amber-50'   },
  concluida: { label: 'Concluída', color: 'text-emerald-700', bg: 'bg-emerald-50' },
  atrasada:  { label: 'Atrasada',  color: 'text-red-600',     bg: 'bg-red-50'     },
}

export function formatWhatsApp(number: string): string {
  const d = number.replace(/\D/g, '')
  const local = d.startsWith('55') ? d.slice(2) : d
  if (local.length === 11) return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`
  if (local.length === 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`
  return number
}

export function normalizeWhatsApp(input: string): string {
  const d = input.replace(/\D/g, '')
  if (d.startsWith('55') && d.length >= 12) return d
  if (d.startsWith('0')) return '55' + d.slice(1)
  return '55' + d
}

export function whatsappLink(number: string): string {
  return `https://wa.me/${normalizeWhatsApp(number)}`
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  // Strings YYYY-MM-DD devem ser tratadas como data local, não UTC midnight
  const [y, m, d] = dateStr.substring(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR')
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export function getInitials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

const avatarPalette = [
  'bg-blue-100 text-blue-700',
  'bg-violet-100 text-violet-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-cyan-100 text-cyan-700',
]

export function getAvatarColor(name: string): string {
  const sum = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
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

export function isOverdue(dateStr: string): boolean {
  return dateStr < localDateStr()
}
