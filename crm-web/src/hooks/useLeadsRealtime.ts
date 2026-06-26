import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { LeadWithRelations } from '../types'

const LEADS_SELECT = '*, lead_sources(id, nome), lead_segments(id, nome), profiles(id, nome)'

/**
 * Assina mudanças em tempo real na tabela `leads`.
 *
 * INSERT/UPDATE são COALESCIDOS por id: os eventos em rajada acumulam os ids
 * alterados e, após um debounce (~300ms), faz-se UMA query buscando só esses
 * ids (`.in('id', ...)`). O merge preserva a referência dos leads não alterados
 * — assim `React.memo` no LeadCard evita re-render dos cards que não mudaram
 * (mover 1 card re-renderiza só ele) e a importação de centenas continua barata
 * (1 query + 1 setState). DELETE é tratado imediatamente.
 */
export function useLeadsRealtime(
  setLeads: React.Dispatch<React.SetStateAction<LeadWithRelations[]>>,
) {
  useEffect(() => {
    const pending = new Set<string>()
    let timer: ReturnType<typeof setTimeout> | null = null
    let cancelled = false

    async function flush() {
      timer = null
      const ids = [...pending]
      pending.clear()
      if (ids.length === 0) return

      const { data } = await supabase.from('leads').select(LEADS_SELECT).in('id', ids)
      if (cancelled || !data) return

      const rows = data as LeadWithRelations[]
      const byId = new Map(rows.map((r) => [r.id, r]))

      setLeads((prev) => {
        const existing = new Set(prev.map((l) => l.id))
        // Substitui só os alterados; mantém a MESMA referência dos demais
        const merged = prev.map((l) => byId.get(l.id) ?? l)
        // Leads novos (INSERT) que ainda não estão na lista → entram no topo
        const novos = rows.filter((r) => !existing.has(r.id))
        return novos.length ? [...novos, ...merged] : merged
      })
    }

    function schedule(id: string) {
      pending.add(id)
      if (timer) clearTimeout(timer)
      timer = setTimeout(flush, 300)
    }

    const channel = supabase
      .channel('leads-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'leads' }, (payload) => {
        schedule(payload.new.id as string)
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'leads' }, (payload) => {
        schedule(payload.new.id as string)
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'leads' }, (payload) => {
        setLeads((prev) => prev.filter((l) => l.id !== payload.old.id))
      })
      .subscribe()

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      supabase.removeChannel(channel)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
}
