export type LeadStatus = string

export type ActivityType =
  | 'ligar'
  | 'enviar_mensagem'
  | 'retornar_orcamento'
  | 'cobrar_resposta'
  | 'reuniao'
  | 'enviar_proposta'
  | 'pos_venda'

export type ActivityStatus = 'pendente' | 'concluida' | 'atrasada'

export interface Profile {
  id: string
  nome: string
  email: string
  tipo_usuario: 'admin' | 'atendente'
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
  created_at: string
  updated_at: string
}

export interface Organization {
  id: string
  nome: string
  nome_exibicao: string | null
  logo_url: string | null
  auto_arquivar_dias: number | null
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

export interface ExtensionLog {
  id: string
  user_id: string
  nivel: 'ERROR' | 'WARN' | 'INFO'
  modulo: string
  acao: string
  mensagem: string
  erro_tecnico: string | null
  contexto: Record<string, unknown> | null
  versao_extensao: string | null
  navegador: string | null
  url: string | null
  created_at: string
}
