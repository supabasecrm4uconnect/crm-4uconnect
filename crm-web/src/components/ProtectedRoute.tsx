import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Clock, LogOut } from 'lucide-react'
import type { Session } from '@supabase/supabase-js'

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [active, setActive] = useState<boolean | undefined>(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  // Verifica se a conta foi liberada pelo administrador
  useEffect(() => {
    if (session === undefined) return
    if (!session) { setActive(undefined); return }

    let cancelled = false
    supabase.from('profiles').select('status').eq('id', session.user.id).single()
      .then(({ data }) => {
        if (!cancelled) setActive((data?.status ?? 'inativo') === 'ativo')
      })
    return () => { cancelled = true }
  }, [session])

  // Carregando sessão ou status
  if (session === undefined || (session && active === undefined)) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!session) return <Navigate to="/login" replace />

  // Conta criada mas ainda não liberada pelo administrador
  if (!active) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-4">
            <Clock size={22} className="text-amber-500" />
          </div>
          <h1 className="text-slate-900 text-lg font-semibold mb-2">Conta aguardando liberação</h1>
          <p className="text-slate-500 text-sm leading-relaxed mb-6">
            Seu cadastro foi criado com sucesso. O acesso ao CRM precisa ser liberado
            pelo administrador. Assim que isso acontecer, é só entrar novamente.
          </p>
          <button
            onClick={() => supabase.auth.signOut()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium transition"
          >
            <LogOut size={15} />
            Sair
          </button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
