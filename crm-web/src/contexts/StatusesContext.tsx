import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export interface StatusConfig {
  id: string
  value: string
  label: string
  color_text: string
  color_bg: string
  color_dot: string
  ordem: number
  ativo: boolean
}

export const COLOR_PRESETS = [
  { name: 'Cinza',     color_text: '#475569', color_bg: '#f1f5f9', color_dot: '#94a3b8' },
  { name: 'Azul',      color_text: '#1d4ed8', color_bg: '#eff6ff', color_dot: '#3b82f6' },
  { name: 'Âmbar',    color_text: '#b45309', color_bg: '#fffbeb', color_dot: '#f59e0b' },
  { name: 'Roxo',      color_text: '#6d28d9', color_bg: '#f5f3ff', color_dot: '#8b5cf6' },
  { name: 'Laranja',   color_text: '#c2410c', color_bg: '#fff7ed', color_dot: '#f97316' },
  { name: 'Verde',     color_text: '#065f46', color_bg: '#ecfdf5', color_dot: '#10b981' },
  { name: 'Vermelho',  color_text: '#dc2626', color_bg: '#fef2f2', color_dot: '#f87171' },
  { name: 'Ciano',     color_text: '#0e7490', color_bg: '#ecfeff', color_dot: '#06b6d4' },
  { name: 'Rosa',      color_text: '#be185d', color_bg: '#fdf2f8', color_dot: '#ec4899' },
]

const FALLBACK: StatusConfig = {
  id: '',
  value: '',
  label: 'Desconhecido',
  color_text: '#475569',
  color_bg: '#f1f5f9',
  color_dot: '#94a3b8',
  ordem: 99,
  ativo: true,
}

interface StatusesContextType {
  statuses: StatusConfig[]
  activeStatuses: StatusConfig[]
  getConfig: (value: string) => StatusConfig
  refresh: () => Promise<void>
  updateOne: (id: string, patch: Partial<StatusConfig>) => void
}

const StatusesContext = createContext<StatusesContextType>({
  statuses: [],
  activeStatuses: [],
  getConfig: () => FALLBACK,
  refresh: async () => {},
  updateOne: () => {},
})

export function StatusesProvider({ children }: { children: React.ReactNode }) {
  const [statuses, setStatuses] = useState<StatusConfig[]>([])

  async function load() {
    const { data } = await supabase.from('lead_statuses').select('*').order('ordem')
    setStatuses((data as StatusConfig[]) ?? [])
  }

  useEffect(() => {
    load()

    const channel = supabase
      .channel('statuses-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lead_statuses' }, () => {
        load()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const activeStatuses = statuses.filter(s => s.ativo)

  function getConfig(value: string): StatusConfig {
    return statuses.find(s => s.value === value) ?? { ...FALLBACK, value, label: value }
  }

  function updateOne(id: string, patch: Partial<StatusConfig>) {
    setStatuses(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s))
  }

  return (
    <StatusesContext.Provider value={{ statuses, activeStatuses, getConfig, refresh: load, updateOne }}>
      {children}
    </StatusesContext.Provider>
  )
}

export function useStatuses() {
  return useContext(StatusesContext)
}
