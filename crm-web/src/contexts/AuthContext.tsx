import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Session } from '@supabase/supabase-js'

type ProfileStatus = 'ativo' | 'inativo'

interface AuthContextType {
  /** undefined = sessão ainda não verificada */
  session: Session | null | undefined
  /** undefined = status ainda não carregado (ou carregando após erro) */
  profileStatus: ProfileStatus | undefined
}

const AuthContext = createContext<AuthContextType>({
  session: undefined,
  profileStatus: undefined,
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [profileStatus, setProfileStatus] = useState<ProfileStatus | undefined>(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  // Verifica se a conta foi liberada pelo administrador. Roda uma única vez por
  // sessão (não a cada navegação de rota) e nunca trata erro de rede/consulta
  // como "conta inativa" — só bloqueia quando a consulta tem sucesso e retorna
  // um status explicitamente diferente de 'ativo'.
  useEffect(() => {
    if (session === undefined) return
    if (!session) { setProfileStatus(undefined); return }

    let cancelled = false
    let retryTimer: ReturnType<typeof setTimeout> | null = null

    async function loadStatus(attempt: number) {
      const { data, error } = await supabase
        .from('profiles')
        .select('status')
        .eq('id', session!.user.id)
        .single()

      if (cancelled) return

      if (error) {
        retryTimer = setTimeout(() => loadStatus(attempt + 1), Math.min(2000 * (attempt + 1), 10000))
        return
      }

      setProfileStatus((data?.status ?? 'inativo') as ProfileStatus)
    }

    loadStatus(0)
    return () => {
      cancelled = true
      if (retryTimer) clearTimeout(retryTimer)
    }
  }, [session])

  return (
    <AuthContext.Provider value={{ session, profileStatus }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
