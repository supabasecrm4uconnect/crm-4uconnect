import { useEffect, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Users, CalendarCheck, Settings, LogOut, Menu, X, Archive } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useFollowUps } from '../contexts/FollowUpsContext'
import { useBranding } from '../contexts/BrandingContext'

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/leads',     icon: Users,           label: 'Leads'      },
  { to: '/arquivados', icon: Archive,        label: 'Arquivados' },
  { to: '/followups', icon: CalendarCheck,   label: 'Follow-ups' },
  { to: '/configuracoes', icon: Settings,    label: 'Configurações' },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  const { pendingCount } = useFollowUps()
  const { productName, company, appTitle, logoUrl } = useBranding()
  const [profile, setProfile] = useState<{ nome: string; email: string } | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('profiles').select('nome, email').eq('id', user.id).single()
        .then(({ data }) => { if (data) setProfile(data as { nome: string; email: string }) })
    })
  }, [])

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

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-emerald-50 text-emerald-600'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                }`
              }
            >
              <Icon size={17} />
              <span className="flex-1">{label}</span>
              {to === '/followups' && pendingCount > 0 && (
                <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
                  {pendingCount > 9 ? '9+' : pendingCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Perfil + Logout */}
        <div className="border-t border-slate-100">
          {profile && (
            <div className="px-4 py-3 flex items-center gap-2.5 border-b border-slate-50">
              <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                <span className="text-emerald-700 text-[10px] font-semibold">{initials}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-slate-800 text-xs font-medium truncate leading-tight">{profile.nome}</p>
                <p className="text-slate-400 text-[10px] truncate">{profile.email}</p>
              </div>
            </div>
          )}
          <div className="px-3 py-3">
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors w-full"
            >
              <LogOut size={17} />
              Sair
            </button>
          </div>
        </div>

      </aside>

      {/* Conteúdo */}
      <main className="md:ml-56 flex-1 flex flex-col min-h-screen min-w-0 overflow-x-hidden">

        {/* Header mobile */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-slate-100 sticky top-0 z-10">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <span className="text-slate-800 text-sm font-semibold">{appTitle}</span>
        </div>

        {children}
      </main>

    </div>
  )
}
