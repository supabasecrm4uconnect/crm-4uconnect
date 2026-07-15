import { useEffect, useRef, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Users, CalendarCheck, Settings, LogOut, Menu, X, Archive, Activity, Search, ChevronDown } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useFollowUps } from '../contexts/FollowUpsContext'
import { useBranding } from '../contexts/BrandingContext'
import CommandPalette from './CommandPalette'

const navItems = [
  { to: '/dashboard',     icon: LayoutDashboard, label: 'Dashboard'      },
  { to: '/leads',         icon: Users,           label: 'Leads'          },
  { to: '/arquivados',    icon: Archive,         label: 'Arquivados'     },
  { to: '/followups',     icon: CalendarCheck,   label: 'Follow-ups'     },
  { to: '/configuracoes', icon: Settings,        label: 'Configurações'  },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  const { pendingCount } = useFollowUps()
  const { productName, company, appTitle, logoUrl, loading: brandingLoading } = useBranding()
  const [profile, setProfile] = useState<{ nome: string; email: string; is_admin: boolean } | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const profileMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('profiles').select('nome, email, is_admin').eq('id', user.id).single()
        .then(({ data }) => { if (data) setProfile(data as { nome: string; email: string; is_admin: boolean }) })
    })
  }, [])

  useEffect(() => {
    if (!profileMenuOpen) return
    function handleOutside(e: MouseEvent) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setProfileMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [profileMenuOpen])

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const initials = profile?.nome
    ? profile.nome.split(' ').filter(Boolean).slice(0, 2).map(n => n[0]).join('').toUpperCase()
    : '?'

  return (
    <div className="min-h-screen bg-slate-50 flex overflow-x-hidden">

      {/* Overlay mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        w-56 bg-white border-r border-slate-100 flex flex-col fixed h-full z-30
        transition-transform duration-200
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0
      `}>

        {/* Logo / Branding */}
        <div className="px-3 pt-3 pb-2 border-b border-slate-100">
          {logoUrl ? (
            <div className="w-full h-24 rounded-xl overflow-hidden bg-white border border-slate-100">
              <img src={logoUrl} alt={company || productName} className="w-full h-full object-cover" />
            </div>
          ) : brandingLoading ? (
            // Placeholder neutro enquanto o branding carrega — evita o flash verde
            // antes de sabermos se a org tem logo.
            <div className="w-full h-24 rounded-xl overflow-hidden bg-slate-50 border border-slate-100 animate-pulse" />
          ) : (
            <div className="relative w-full h-24 rounded-xl overflow-hidden bg-emerald-950">
              <div className="absolute inset-0 bg-gradient-to-tr from-emerald-950 via-emerald-900/85 to-emerald-700/50 rounded-xl" />
              <div className="relative z-10 flex flex-col justify-end h-full px-3 pb-2.5">
                <p className="text-white text-sm font-bold leading-tight tracking-tight">{productName}</p>
                {company && <p className="text-emerald-300 text-[10px] font-medium truncate">{company}</p>}
              </div>
            </div>
          )}
        </div>

        {/* Busca global */}
        <div className="px-3 pt-3">
          <button
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-400 hover:border-slate-300 hover:text-slate-500 transition-colors"
          >
            <Search size={15} />
            <span className="flex-1 text-left">Buscar lead...</span>
            <kbd className="text-[10px] font-medium bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5">⌘K</kbd>
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `relative flex items-center gap-3 pl-4 pr-3 py-3 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-brand-50 text-brand-700 font-semibold'
                    : 'text-slate-500 font-medium hover:bg-slate-50 hover:text-slate-700'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-full bg-brand-500" />}
                  <Icon size={17} />
                  <span className="flex-1">{label}</span>
                  {to === '/followups' && pendingCount > 0 && (
                    <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
                      {pendingCount > 9 ? '9+' : pendingCount}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}
          {profile?.is_admin && (
            <NavLink
              to="/diagnostico"
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `relative flex items-center gap-3 pl-4 pr-3 py-3 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-brand-50 text-brand-700 font-semibold'
                    : 'text-slate-500 font-medium hover:bg-slate-50 hover:text-slate-700'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-full bg-brand-500" />}
                  <Activity size={17} />
                  <span className="flex-1">Diagnóstico</span>
                </>
              )}
            </NavLink>
          )}
        </nav>

      </aside>

      {/* Conteúdo */}
      <main className="md:ml-56 flex-1 flex flex-col min-h-screen min-w-0 overflow-x-hidden">

        {/* Header — hamburger+título só no mobile; perfil sempre no canto direito */}
        <div className="flex items-center gap-3 px-4 md:px-8 py-3 bg-white border-b border-slate-100 sticky top-0 z-10">
          <button
            onClick={() => setSidebarOpen(true)}
            className="md:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <span className="md:hidden text-slate-800 text-sm font-semibold">{appTitle}</span>

          {/* Perfil (menu suspenso: sair) — sempre renderiza, mesmo antes do
              perfil carregar, pra logout nunca ficar inacessível */}
          <div className="relative ml-auto" ref={profileMenuRef}>
            <button
              onClick={() => setProfileMenuOpen(v => !v)}
              className={`flex items-center gap-2.5 pl-1.5 pr-1.5 md:pr-3 py-1.5 rounded-lg transition-colors ${profileMenuOpen ? 'bg-slate-50' : 'hover:bg-slate-50'}`}
            >
              <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                <span className="text-emerald-700 text-[10px] font-semibold">{initials}</span>
              </div>
              <div className="hidden md:block min-w-0 text-left">
                <p className="text-slate-800 text-xs font-medium truncate leading-tight max-w-[160px]">{profile?.nome ?? ' '}</p>
                <p className="text-slate-400 text-[10px] truncate max-w-[160px]">{profile?.email ?? ' '}</p>
              </div>
              <ChevronDown size={14} className={`hidden md:block text-slate-400 shrink-0 transition-transform ${profileMenuOpen ? 'rotate-180' : ''}`} />
            </button>
            {profileMenuOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-48 bg-white rounded-xl border border-slate-100 shadow-lg py-1.5 z-30">
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-3 px-3.5 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors w-[calc(100%-12px)] mx-1.5"
                >
                  <LogOut size={16} />
                  Sair
                </button>
              </div>
            )}
          </div>
        </div>

        {children}
      </main>

      <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} />

    </div>
  )
}
