import type { PlanType, PlanStatus } from '../types'

export interface PlanConfig {
  id: PlanType
  nome: string
  descricao: string
  maxUsuarios: number
  maxLeads: number
  diasVigencia: number
  valorPadrao: number
  badgeColor: string
  badgeBg: string
  badgeBorder: string
  destaque?: boolean
}

export const PLAN_PRESETS: Record<PlanType, PlanConfig> = {
  mensal: {
    id: 'mensal',
    nome: 'Plano Mensal',
    descricao: '1 usuário · até 500 leads',
    maxUsuarios: 1,
    maxLeads: 500,
    diasVigencia: 30,
    valorPadrao: 97.00,
    badgeColor: 'text-blue-700',
    badgeBg: 'bg-blue-50',
    badgeBorder: 'border-blue-200',
  },
  trimestral: {
    id: 'trimestral',
    nome: 'Plano Trimestral',
    descricao: '2 usuários · até 1.000 leads',
    maxUsuarios: 2,
    maxLeads: 1000,
    diasVigencia: 90,
    valorPadrao: 261.00,
    badgeColor: 'text-amber-700',
    badgeBg: 'bg-amber-50',
    badgeBorder: 'border-amber-200',
  },
  semestral: {
    id: 'semestral',
    nome: 'Plano Semestral',
    descricao: '3 usuários · até 2.000 leads',
    maxUsuarios: 3,
    maxLeads: 2000,
    diasVigencia: 180,
    valorPadrao: 462.00,
    badgeColor: 'text-purple-700',
    badgeBg: 'bg-purple-50',
    badgeBorder: 'border-purple-200',
  },
  anual: {
    id: 'anual',
    nome: 'Plano Anual',
    descricao: '5 usuários · até 5.000 leads',
    maxUsuarios: 5,
    maxLeads: 5000,
    diasVigencia: 365,
    valorPadrao: 756.00,
    badgeColor: 'text-emerald-700',
    badgeBg: 'bg-emerald-50',
    badgeBorder: 'border-emerald-200',
    destaque: true,
  },
  custom: {
    id: 'custom',
    nome: 'Plano Personalizado',
    descricao: 'Limites e usuários sob medida',
    maxUsuarios: 10,
    maxLeads: 10000,
    diasVigencia: 30,
    valorPadrao: 0,
    badgeColor: 'text-slate-700',
    badgeBg: 'bg-slate-100',
    badgeBorder: 'border-slate-300',
  },
}

export function getPlanConfig(planType?: PlanType | string | null): PlanConfig {
  if (planType && planType in PLAN_PRESETS) {
    return PLAN_PRESETS[planType as PlanType]
  }
  return PLAN_PRESETS.mensal
}

export function getPlanStatusLabel(status?: PlanStatus | string | null): {
  label: string
  color: string
  bg: string
  border: string
  dot: string
} {
  switch (status) {
    case 'ativo':
      return {
        label: 'Ativo',
        color: 'text-emerald-700',
        bg: 'bg-emerald-50',
        border: 'border-emerald-200',
        dot: 'bg-emerald-500',
      }
    case 'trial':
      return {
        label: 'Em Teste (Trial)',
        color: 'text-amber-700',
        bg: 'bg-amber-50',
        border: 'border-amber-200',
        dot: 'bg-amber-500',
      }
    case 'vencido':
      return {
        label: 'Vencido',
        color: 'text-red-700',
        bg: 'bg-red-50',
        border: 'border-red-200',
        dot: 'bg-red-500',
      }
    case 'bloqueado':
      return {
        label: 'Bloqueado',
        color: 'text-rose-800',
        bg: 'bg-rose-100',
        border: 'border-rose-300',
        dot: 'bg-rose-600',
      }
    default:
      return {
        label: 'Ativo',
        color: 'text-emerald-700',
        bg: 'bg-emerald-50',
        border: 'border-emerald-200',
        dot: 'bg-emerald-500',
      }
  }
}

export function isPlanExpired(expiraEm?: string | null): boolean {
  if (!expiraEm) return false
  const expDate = new Date(expiraEm)
  const now = new Date()
  return expDate.getTime() < now.getTime()
}

export function daysUntilExpiration(expiraEm?: string | null): number | null {
  if (!expiraEm) return null
  const expDate = new Date(expiraEm)
  const now = new Date()
  const diffTime = expDate.getTime() - now.getTime()
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}
