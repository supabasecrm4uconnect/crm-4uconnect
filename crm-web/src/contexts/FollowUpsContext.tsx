import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

interface FollowUpsContextType {
  pendingCount: number
}

const FollowUpsContext = createContext<FollowUpsContextType>({ pendingCount: 0 })

/** Retorna a data de hoje no formato YYYY-MM-DD no fuso local */
function todayLocal(): string {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm   = String(d.getMonth() + 1).padStart(2, '0')
  const dd   = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export function FollowUpsProvider({ children }: { children: React.ReactNode }) {
  const [pendingCount, setPendingCount] = useState(0)

  const refresh = useCallback(async () => {
    const today = todayLocal()
    // Conta atividades pendentes com data <= hoje (atrasadas + hoje)
    const { count } = await supabase
      .from('lead_activities')
      .select('id', { count: 'exact', head: true })
      .eq('status_atividade', 'pendente')
      .lte('data_agendada', today)

    setPendingCount(count ?? 0)
  }, [])

  useEffect(() => {
    // Carrega imediatamente
    refresh()

    // Escuta mudanças em tempo real na tabela lead_activities
    const channel = supabase
      .channel('followups-badge')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lead_activities' },
        () => { refresh() },
      )
      .subscribe()

    // Revalida à meia-noite para atualizar "hoje → atrasado" sem precisar recarregar
    const now   = new Date()
    const msUntilMidnight =
      new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - now.getTime()

    const midnightTimer = setTimeout(() => {
      refresh()
    }, msUntilMidnight)

    return () => {
      supabase.removeChannel(channel)
      clearTimeout(midnightTimer)
    }
  }, [refresh])

  return (
    <FollowUpsContext.Provider value={{ pendingCount }}>
      {children}
    </FollowUpsContext.Provider>
  )
}

export function useFollowUps() {
  return useContext(FollowUpsContext)
}
