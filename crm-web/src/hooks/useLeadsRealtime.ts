import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { LeadWithRelations } from '../types'

/**
 * Assina mudanças em tempo real na tabela `leads`.
 * Chame com a lista atual de leads e um setter para atualizá-la.
 *
 * Eventos tratados:
 *  - INSERT → adiciona o novo lead no início da lista
 *  - UPDATE → substitui o lead existente com os novos dados
 *  - DELETE → remove o lead da lista
 */
export function useLeadsRealtime(
  setLeads: React.Dispatch<React.SetStateAction<LeadWithRelations[]>>,
) {
  useEffect(() => {
    const channel = supabase
      .channel('leads-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'leads' },
        async (payload) => {
          // Busca o lead completo com relações para ter origem/segmento/profiles
          const { data } = await supabase
            .from('leads')
            .select('*, lead_sources(id, nome), lead_segments(id, nome), profiles(id, nome)')
            .eq('id', payload.new.id)
            .single()
          if (data) {
            setLeads((prev) => [data as LeadWithRelations, ...prev])
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'leads' },
        async (payload) => {
          const newData = payload.new as Partial<LeadWithRelations>

          // Atualiza imediatamente preservando as relações já carregadas
          setLeads((prev) =>
            prev.map((l) =>
              l.id === newData.id
                ? { ...l, ...newData, lead_sources: l.lead_sources, lead_segments: l.lead_segments, profiles: l.profiles }
                : l,
            ),
          )

          // Refetch em background para corrigir relações se origem/segmento mudou
          const { data } = await supabase
            .from('leads')
            .select('*, lead_sources(id, nome), lead_segments(id, nome), profiles(id, nome)')
            .eq('id', newData.id)
            .single()
          if (data) {
            setLeads((prev) =>
              prev.map((l) => (l.id === newData.id ? (data as LeadWithRelations) : l)),
            )
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'leads' },
        (payload) => {
          setLeads((prev) => prev.filter((l) => l.id !== payload.old.id))
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
}
