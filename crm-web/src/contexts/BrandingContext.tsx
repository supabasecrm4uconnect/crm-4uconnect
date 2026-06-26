import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// Nome fixo do produto (pode ser sobrescrito por env). A empresa cliente é
// anexada depois do traço: "Connect CRM — <Empresa>".
const PRODUCT_NAME = (import.meta.env.VITE_PRODUCT_NAME as string) || 'Connect CRM'

function buildTitle(company: string): string {
  return company ? `${PRODUCT_NAME} — ${company}` : PRODUCT_NAME
}

interface Branding {
  productName: string      // "Connect CRM"
  company: string          // nome da empresa (Nome de exibição), '' se não houver
  appTitle: string         // "Connect CRM — <Empresa>" (ou só "Connect CRM")
  logoUrl: string | null
  loading: boolean
  refresh: () => Promise<void>
}

const BrandingContext = createContext<Branding>({
  productName: PRODUCT_NAME,
  company: '',
  appTitle: PRODUCT_NAME,
  logoUrl: null,
  loading: true,
  refresh: async () => {},
})

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const [company, setCompany] = useState('')
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const apply = useCallback((comp: string, logo: string | null) => {
    setCompany(comp)
    setLogoUrl(logo)
    document.title = buildTitle(comp)
    setLoading(false)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { apply('', null); return }

    const { data: profile } = await supabase
      .from('profiles').select('organization_id').eq('id', user.id).single()
    const orgId = (profile as { organization_id: string | null } | null)?.organization_id
    if (orgId) {
      const { data: org } = await supabase
        .from('organizations').select('nome, nome_exibicao, logo_url').eq('id', orgId).single()
      if (org) {
        const o = org as { nome: string; nome_exibicao: string | null; logo_url: string | null }
        apply((o.nome_exibicao?.trim() || o.nome?.trim() || ''), o.logo_url || null)
        return
      }
    }
    apply('', null)
  }, [apply])

  useEffect(() => {
    load()
    const { data: sub } = supabase.auth.onAuthStateChange(() => { load() })
    return () => { sub.subscription.unsubscribe() }
  }, [load])

  return (
    <BrandingContext.Provider value={{ productName: PRODUCT_NAME, company, appTitle: buildTitle(company), logoUrl, loading, refresh: load }}>
      {children}
    </BrandingContext.Provider>
  )
}

export function useBranding() {
  return useContext(BrandingContext)
}
