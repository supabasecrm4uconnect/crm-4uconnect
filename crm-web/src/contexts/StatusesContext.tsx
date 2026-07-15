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
  auto_task_enabled: boolean | null
  auto_task_tipo: string | null
  auto_task_dias: number | null
  auto_task_descricao: string | null
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
  auto_task_enabled: false,
  auto_task_tipo: null,
  auto_task_dias: null,
  auto_task_descricao: null,
}

// Cache em localStorage por user ID — garante exibição instantânea no reload
// sem depender de timing de eventos de autenticação.
const STATUSES_CACHE_KEY_PREFIX = 'statuses-cache:'

function readStatusesCache(userId: string): StatusConfig[] | null {
  try {
    const raw = localStorage.getItem(STATUSES_CACHE_KEY_PREFIX + userId)
    if (!raw) return null
    return JSON.parse(raw) as StatusConfig[]
  } catch {
    return null
  }
}

function writeStatusesCache(userId: string, data: StatusConfig[]) {
  try {
    localStorage.setItem(STATUSES_CACHE_KEY_PREFIX + userId, JSON.stringify(data))
  } catch {
    // localStorage indisponível — ignora
  }
}

interface StatusesContextType {
  statuses: StatusConfig[]
  activeStatuses: StatusConfig[]
  getConfig: (value: string) => StatusConfig
  refresh: () => Promise<void>
  updateOne: (id: string, patch: Partial<StatusConfig>) => void
  loading: boolean
}

const StatusesContext = createContext<StatusesContextType>({
  statuses: [],
  activeStatuses: [],
  getConfig: () => FALLBACK,
  refresh: async () => {},
  updateOne: () => {},
  loading: true,
})

export function StatusesProvider({ children }: { children: React.ReactNode }) {
  const [statuses, setStatuses] = useState<StatusConfig[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    const { data } = await supabase.from('lead_statuses').select('*').order('ordem')
    const rows = (data as StatusConfig[]) ?? []
    setStatuses(rows)
    setLoading(false)

    // Escreve no cache após carregar dados válidos, keyed pelo user ID atual.
    if (rows.length > 0) {
      supabase.auth.getUser().then(({ data: u }) => {
        if (u.user) writeStatusesCache(u.user.id, rows)
      })
    }
  }

  useEffect(() => {
    // Usa getSession() como trigger primário: lê a sessão atual do localStorage de
    // forma determinística. Não depende do timing do evento INITIAL_SESSION do
    // onAuthStateChange, que pode disparar antes de o cliente ter a sessão pronta.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        // Já autenticado: inicializa a partir do cache (exibição instantânea) e
        // dispara load() em paralelo para dados frescos do banco.
        const cached = readStatusesCache(session.user.id)
        if (cached) {
          setStatuses(cached)
          setLoading(false)
        }
        load()
      }
      // Sem sessão: onAuthStateChange vai lidar quando o SIGNED_IN chegar.
    })

    // Recarrega ao fazer login e ao renovar token. Filtramos pelo parâmetro
    // `session` para não sobrescrever dados existentes em eventos de logout.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) load()
      else {
        // Usuário deslogou: limpa o estado (não o cache — será sobrescrito no próximo login)
        setStatuses([])
        setLoading(false)
      }
    })

    const channel = supabase
      .channel('statuses-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lead_statuses' }, () => {
        load()
      })
      .subscribe()

    return () => {
      sub.subscription.unsubscribe()
      supabase.removeChannel(channel)
    }
  }, [])

  const activeStatuses = statuses.filter(s => s.ativo)

  function getConfig(value: string): StatusConfig {
    return statuses.find(s => s.value === value) ?? { ...FALLBACK, value, label: value }
  }

  function updateOne(id: string, patch: Partial<StatusConfig>) {
    setStatuses(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s))
  }

  return (
    <StatusesContext.Provider value={{ statuses, activeStatuses, getConfig, refresh: load, updateOne, loading }}>
      {children}
    </StatusesContext.Provider>
  )
}

export function useStatuses() {
  return useContext(StatusesContext)
}
