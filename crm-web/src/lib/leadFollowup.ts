import { supabase } from './supabase'

/**
 * Recalcula leads.proximo_followup como a data da atividade PENDENTE mais próxima
 * do lead (ou null se não houver nenhuma). Deve ser chamado sempre que uma atividade
 * é criada ou concluída, para o campo nunca ficar "travado" numa data antiga.
 */
export async function recalcProximoFollowup(leadId: string): Promise<string | null> {
  const { data } = await supabase
    .from('lead_activities')
    .select('data_agendada')
    .eq('lead_id', leadId)
    .eq('status_atividade', 'pendente')
    .order('data_agendada', { ascending: true })
    .limit(1)
    .maybeSingle()

  const proximo = data ? `${data.data_agendada}T12:00:00.000Z` : null
  await supabase.from('leads').update({ proximo_followup: proximo }).eq('id', leadId)
  return proximo
}
