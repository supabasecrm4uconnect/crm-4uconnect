import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Session } from '@supabase/supabase-js'

export type ProfileStatus = 'ativo' | 'inativo'

export interface UserProfile {
  id: string
  nome: string
  email: string
  is_admin: boolean
  is_super_admin: boolean
  tipo_usuario?: string
  departamento?: string
  status: ProfileStatus
  organization_id?: string
  subscriptionActive?: boolean
}

interface AuthContextType {
  /** undefined = sessão ainda não verificada */
  session: Session | null | undefined
  /** undefined = status ainda não carregado */
  profileStatus: ProfileStatus | undefined
  /** Perfil global do usuário logado */
  profile: UserProfile | null | undefined
  /** Força atualização do perfil no estado global */
  refreshProfile: () => Promise<void>
}

const CACHE_KEY = 'crm_user_profile_cache'

function getCachedProfile(): UserProfile | null {
  try {
    const item = localStorage.getItem(CACHE_KEY)
    return item ? JSON.parse(item) : null
  } catch {
    return null
  }
}

function setCachedProfile(profile: UserProfile | null) {
  try {
    if (profile) localStorage.setItem(CACHE_KEY, JSON.stringify(profile))
    else localStorage.removeItem(CACHE_KEY)
  } catch {
    // localStorage pode estar indisponível em navegação privada ou ambientes restritos.
  }
}

const AuthContext = createContext<AuthContextType>({
  session: undefined,
  profileStatus: undefined,
  profile: undefined,
  refreshProfile: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [profile, setProfile] = useState<UserProfile | null | undefined>(() => getCachedProfile())
  const [profileStatus, setProfileStatus] = useState<ProfileStatus | undefined>(() => getCachedProfile()?.status)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => {
      setSession(s)
      if (!s) {
        setProfile(null)
        setProfileStatus(undefined)
        setCachedProfile(null)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (data && !error) {
        const isAdmin = data.is_admin === true || data.tipo_usuario === 'admin' || data.tipo_usuario === 'superadmin' || data.is_super_admin === true
        const isSuperAdmin = data.is_super_admin === true || data.tipo_usuario === 'superadmin'
        let subscriptionActive = false
        if (data.organization_id) {
          const { data: organization } = await supabase
            .from('organizations')
            .select('plano_status, plano_expira_em')
            .eq('id', data.organization_id)
            .maybeSingle()

          if (!organization) {
            subscriptionActive = false
          } else {
            const expiresAt = organization.plano_expira_em
              ? new Date(organization.plano_expira_em).getTime()
              : null
            subscriptionActive =
              (organization.plano_status === 'ativo' || organization.plano_status === 'trial') &&
              (expiresAt === null || expiresAt >= Date.now())
          }
        }

        const p: UserProfile = {
          id: data.id,
          nome: data.nome || data.email?.split('@')[0] || 'Usuário',
          email: data.email || '',
          is_admin: isAdmin,
          is_super_admin: isSuperAdmin,
          tipo_usuario: data.tipo_usuario || (isAdmin ? 'admin' : 'atendente'),
          departamento: data.departamento || 'comercial',
          status: (data.status ?? 'ativo') as ProfileStatus,
          organization_id: data.organization_id,
          subscriptionActive,
        }
        setProfile(p)
        setProfileStatus(p.status)
        setCachedProfile(p)
        return
      }
    } catch (err) {
      console.warn('Erro ao carregar perfil do usuário:', err)
    }
  }, [])

  useEffect(() => {
    if (session === undefined) return
    if (!session) {
      setProfile(null)
      setProfileStatus(undefined)
      setCachedProfile(null)
      return
    }

    fetchProfile(session.user.id)
  }, [session, fetchProfile])

  const refreshProfile = useCallback(async () => {
    if (session?.user?.id) {
      await fetchProfile(session.user.id)
    }
  }, [session, fetchProfile])

  return (
    <AuthContext.Provider value={{ session, profileStatus, profile, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
