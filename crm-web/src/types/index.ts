export type LeadStatus = string

export type ActivityType =
  | 'ligar'
  | 'enviar_mensagem'
  | 'retornar_orcamento'
  | 'cobrar_resposta'
  | 'reuniao'
  | 'enviar_proposta'
  | 'pos_venda'

export type ActivityStatus = 'pendente' | 'concluida' | 'cancelada' | 'atrasada'

export type LossReason =
  | 'preco'
  | 'concorrencia'
  | 'sem_resposta'
  | 'sem_orcamento'
  | 'timing'
  | 'nao_qualificado'
  | 'outro'

export type DepartmentType = 'comercial' | 'atendimento' | 'sdr' | 'financeiro' | 'gestao'

export interface Profile {
  id: string
  nome: string
  email: string
  tipo_usuario: 'admin' | 'atendente'
  departamento?: DepartmentType
  status: 'ativo' | 'inativo'
  organization_id: string | null
  created_at: string
  updated_at: string
}

export interface LeadSource {
  id: string
  nome: string
  ativo: boolean
  created_at: string
}

export interface LeadSegment {
  id: string
  nome: string
  ativo: boolean
  created_at: string
}

export interface Lead {
  id: string
  nome: string
  whatsapp: string
  foto_url: string | null
  origem_id: string | null
  segmento_id: string | null
  status: LeadStatus
  tags: string[]
  observacao: string | null
  valor: number | null
  responsavel_id: string | null
  proximo_followup: string | null
  arquivado: boolean
  arquivado_em: string | null
  motivo_perda: string | null
  created_at: string
  updated_at: string
}

export type PlanType = 'mensal' | 'trimestral' | 'semestral' | 'anual' | 'custom'
export type PlanStatus = 'ativo' | 'trial' | 'vencido' | 'bloqueado'

export interface Organization {
  id: string
  nome: string
  nome_exibicao: string | null
  logo_url: string | null
  responsavel_nome?: string | null
  responsavel_email?: string | null
  responsavel_telefone?: string | null
  plano?: PlanType | null
  plano_status?: PlanStatus | null
  max_usuarios?: number | null
  max_leads?: number | null
  plano_inicio?: string | null
  plano_expira_em?: string | null
  plano_valor_recorrente?: number | null
  created_at: string
}

export interface LeadWithRelations extends Lead {
  lead_sources: LeadSource | null
  lead_segments: LeadSegment | null
  profiles: Profile | null
}

export interface LeadStatusHistory {
  id: string
  lead_id: string
  status_anterior: string | null
  status_novo: string
  alterado_por: string | null
  created_at: string
  profiles?: { nome: string } | null
}

export interface LeadActivity {
  id: string
  lead_id: string
  tipo_atividade: ActivityType
  descricao: string | null
  data_agendada: string
  hora_agendada: string
  status_atividade: ActivityStatus
  criado_por: string | null
  criado_automaticamente: boolean
  concluido_em: string | null
  created_at: string
  updated_at: string
  leads?: { nome: string; whatsapp: string } | null
  profiles?: { nome: string } | null
}

export interface LeadNote {
  id: string
  lead_id: string
  nota: string
  criado_por: string | null
  created_at: string
  profiles?: { nome: string } | null
}
