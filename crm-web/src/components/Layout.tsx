import { useEffect, useState, useRef } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Users, CalendarCheck, Settings, LogOut, Menu, X,
  Archive, Search, Headphones, Bell, ChevronDown,
  User, Building2
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useFollowUps } from '../contexts/FollowUpsContext'
import { useBranding } from '../contexts/BrandingContext'
import { supabase } from '../lib/supabase'
import CommandPalette from './CommandPalette'
import WhatsAppIcon from './WhatsAppIcon'
import UserProfileModal from './UserProfileModal'

export default function Layout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  const { profile, refreshProfile } = useAuth()
  const { pendingCount } = useFollowUps()
  const { productName, company, appTitle, logoUrl, loading: brandingLoading } = useBranding()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [showProfileModal, setShowProfileModal] = useState(false)

  const navItems = [
    { to: '/dashboard',     icon: LayoutDashboard, label: 'Dashboard'              },
    { to: '/leads',         icon: Users,           label: 'Leads'                  },
    { to: '/followups',     icon: CalendarCheck,   label: 'Follow-ups'             },
    ...(profile?.is_super_admin ? [{ to: '/clientes', icon: Building2, label: 'Clientes & Assinaturas' }] : []),
    { to: '/configuracoes', icon: Settings,        label: 'Configurações'          },
  ]

  // Menus suspensos do Top Header
  const [showSupportMenu, setShowSupportMenu] = useState(false)
  const [showFollowUpMenu, setShowFollowUpMenu] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)

  const supportMenuRef = useRef<HTMLDivElement>(null)
  const followUpMenuRef = useRef<HTMLDivElement>(null)
  const userMenuRef = useRef<HTMLDivElement>(null)

  // Fechamento ao clicar fora dos menus do cabeçalho
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (supportMenuRef.current && !supportMenuRef.current.contains(e.target as Node)) {
        setShowSupportMenu(false)
      }
      if (followUpMenuRef.current && !followUpMenuRef.current.contains(e.target as Node)) {
        setShowFollowUpMenu(false)
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const firstName = profile?.nome?.split(' ')[0] || 'Usuário'
  const initials = profile?.nome
    ? profile.nome.split(' ').filter(Boolean).slice(0, 2).map(n => n[0]).join('').toUpperCase()
    : '?'

  return (
    <div className="min-h-screen bg-slate-100/70 flex text-slate-800">

      {/* Overlay mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-xs z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar Lateral */}
      <aside className={`
        w-64 bg-white border-r border-slate-200/90 flex flex-col fixed h-full z-30
        transition-transform duration-200 shadow-sm
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0
      `}>

        {/* Logo / Branding — Bloco visual aumentado com h-14 (56px) dentro de container h-[72px] */}
        <div className="h-[72px] px-3.5 border-b border-slate-100 flex items-center shrink-0">
          {logoUrl ? (
            <div className="w-full h-14 rounded-lg overflow-hidden bg-white border border-slate-200/80 shadow-2xs flex items-center justify-center p-2">
              <img src={logoUrl} alt={company || productName} className="w-full h-full object-contain" />
            </div>
          ) : brandingLoading ? (
            <div className="w-full h-14 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 animate-pulse" />
          ) : (
            <div className="relative w-full h-14 rounded-lg overflow-hidden bg-emerald-950 shadow-sm flex items-center px-4">
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-950 via-emerald-900 to-emerald-700 rounded-lg" />
              <div className="relative z-10 flex items-center justify-between w-full min-w-0 gap-2">
                <p className="text-white text-sm font-bold leading-tight tracking-tight shrink-0">{productName}</p>
                {company && (
                  <span className="text-emerald-200 text-xs font-bold truncate bg-white/15 px-2.5 py-1 rounded-md border border-white/20 backdrop-blur-xs max-w-[130px]" title={company}>
                    {company}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Links de Navegação */}
        <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `relative flex items-center gap-3.5 px-3.5 py-3 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-brand-600 text-white font-bold shadow-xs border border-brand-700/60'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950 border border-transparent'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={18} className={isActive ? 'text-white' : 'text-slate-400'} />
                  <span className="flex-1">{label}</span>
                  {to === '/followups' && pendingCount > 0 && (
                    <span className={`inline-flex items-center justify-center min-w-[20px] h-[20px] px-1.5 rounded-full text-[11px] font-bold leading-none shadow-xs ${
                      isActive ? 'bg-white text-brand-700' : 'bg-red-500 text-white'
                    }`}>
                      {pendingCount > 9 ? '9+' : pendingCount}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

      </aside>

      {/* Conteúdo Principal com Top Header Bar Fixo */}
      <div className="md:ml-64 flex-1 flex flex-col min-h-screen min-w-0">

        {/* Top Header Bar — Fixo com h-[72px] alinhado perfeitamente com a Sidebar */}
        <header className="h-[72px] bg-white/95 backdrop-blur-md border-b border-slate-200/90 px-6 md:px-8 flex items-center justify-between sticky top-0 z-30 shadow-2xs">

          {/* Mobile Menu Button + App Title */}
          <div className="flex items-center gap-3 md:hidden">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <span className="text-slate-900 text-sm font-bold truncate">{appTitle}</span>
          </div>

          {/* Campo de Busca Estilo Search Anything (Desktop / Tablet) */}
          <div className="hidden sm:flex items-center flex-1 max-w-sm">
            <button
              onClick={() => setSearchOpen(true)}
              className="w-full flex items-center gap-2.5 px-3.5 py-2 rounded-lg border border-slate-200 bg-slate-50/70 hover:bg-white hover:border-slate-300 text-slate-400 hover:text-slate-600 text-xs font-medium transition-all shadow-2xs cursor-pointer group"
            >
              <Search size={15} className="text-slate-400 group-hover:text-brand-600 transition-colors" />
              <span className="flex-1 text-left text-slate-400 group-hover:text-slate-600">Buscar no CRM...</span>
              <kbd className="text-[10px] font-bold text-slate-500 bg-white border border-slate-200 rounded-md px-1.5 py-0.5 shadow-2xs">⌘K</kbd>
            </button>
          </div>

          {/* Ações à Direita: Suporte, Notificação de Follow-up, Divisor e Pílula de Perfil */}
          <div className="flex items-center gap-2 ml-auto">

            {/* Busca no Mobile */}
            <button
              onClick={() => setSearchOpen(true)}
              className="sm:hidden p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 transition-colors cursor-pointer"
              title="Buscar no CRM"
            >
              <Search size={16} />
            </button>

            {/* Ícone de Suporte */}
            <div className="relative" ref={supportMenuRef}>
              <button
                onClick={() => setShowSupportMenu(v => !v)}
                title="Central de Suporte & Ajuda"
                className={`p-2 rounded-lg border text-slate-600 hover:text-slate-900 transition-all cursor-pointer shadow-2xs ${
                  showSupportMenu
                    ? 'bg-brand-50 border-brand-300 text-brand-700 ring-2 ring-brand-500/20'
                    : 'bg-white border-slate-200/90 hover:bg-slate-50'
                }`}
              >
                <Headphones size={17} />
              </button>

              {showSupportMenu && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl border border-slate-200 shadow-dropdown z-50 p-3 animate-fade-in">
                  <p className="text-xs font-bold text-slate-900 mb-1">Suporte & Ajuda</p>
                  <p className="text-[11px] text-slate-500 mb-3">Precisa de auxílio técnico ou suporte sobre o CRM?</p>

                  <a
                    href="https://wa.me/5515992568868?text=Ol%C3%A1%2C+preciso+de+suporte+no+Connect+CRM"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 w-full px-3 py-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition mb-1.5 shadow-2xs"
                  >
                    <WhatsAppIcon size={14} />
                    Falar com o Suporte
                  </a>
                </div>
              )}
            </div>

            {/* Sino de Notificação / Follow-ups */}
            <div className="relative" ref={followUpMenuRef}>
              <button
                onClick={() => setShowFollowUpMenu(v => !v)}
                title="Follow-ups e Lembretes"
                className={`relative p-2 rounded-lg border text-slate-600 hover:text-slate-900 transition-all cursor-pointer shadow-2xs ${
                  showFollowUpMenu
                    ? 'bg-brand-50 border-brand-300 text-brand-700 ring-2 ring-brand-500/20'
                    : 'bg-white border-slate-200/90 hover:bg-slate-50'
                }`}
              >
                <Bell size={17} />
                {pendingCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-white animate-pulse" />
                )}
              </button>

              {showFollowUpMenu && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl border border-slate-200 shadow-dropdown z-50 p-3 animate-fade-in">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold text-slate-900">Follow-ups</p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      pendingCount > 0
                        ? 'bg-red-50 text-red-700 border-red-200'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}>
                      {pendingCount} pendente{pendingCount !== 1 ? 's' : ''}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-500 mb-3">
                    {pendingCount > 0
                      ? 'Você possui agendamentos que precisam de contato hoje.'
                      : 'Nenhum follow-up pendente. Tudo em dia!'}
                  </p>

                  <NavLink
                    to="/followups"
                    onClick={() => setShowFollowUpMenu(false)}
                    className="flex items-center justify-center gap-1.5 w-full px-3 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold transition shadow-2xs"
                  >
                    <CalendarCheck size={14} />
                    Ver follow-ups
                  </NavLink>
                </div>
              )}
            </div>

            {/* Divisor Vertical */}
            <div className="h-6 w-px bg-slate-200 mx-1" />

            {/* Pílula de Perfil do Usuário: "Olá, Nome" + Avatar + Dropdown Chevron */}
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setShowUserMenu(v => !v)}
                className={`flex items-center gap-2.5 pl-2.5 pr-2 py-1.5 rounded-lg transition-all cursor-pointer select-none border shadow-2xs ${
                  showUserMenu
                    ? 'bg-slate-100 border-slate-300'
                    : 'bg-white border-slate-200/90 hover:bg-slate-50 hover:border-slate-300'
                }`}
              >
                <span className="text-xs font-bold text-slate-800">
                  Olá, {firstName}
                </span>

                <div className="w-7 h-7 rounded-full bg-brand-100 text-brand-800 flex items-center justify-center font-bold text-xs shrink-0 border border-brand-200 shadow-2xs">
                  {initials}
                </div>

                <ChevronDown
                  size={13}
                  className={`text-slate-400 transition-transform duration-200 ${
                    showUserMenu ? 'rotate-180 text-brand-600' : ''
                  }`}
                />
              </button>

              {showUserMenu && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl border border-slate-200 shadow-dropdown z-50 p-2 animate-fade-in">
                  <div className="px-3 py-2.5 border-b border-slate-100 mb-1">
                    <p className="text-xs font-bold text-slate-900 truncate">
                      {profile?.nome || 'Usuário'} <span className="text-slate-300 font-normal mx-0.5">|</span> <span className="text-slate-500 font-semibold">{profile?.is_admin ? 'Administrador' : 'Atendente'}</span>
                    </p>
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">{profile?.email || ''}</p>
                  </div>

                  <NavLink
                    to="/configuracoes?tab=usuarios"
                    onClick={() => setShowUserMenu(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-950 transition"
                  >
                    <User size={14} className="text-slate-400" />
                    Meu Perfil
                  </NavLink>

                  <NavLink
                    to="/configuracoes"
                    onClick={() => setShowUserMenu(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-950 transition"
                  >
                    <Settings size={14} className="text-slate-400" />
                    Configurações
                  </NavLink>

                  <NavLink
                    to="/arquivados"
                    onClick={() => setShowUserMenu(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-950 transition"
                  >
                    <Archive size={14} className="text-slate-400" />
                    Leads Arquivados
                  </NavLink>

                  <div className="border-t border-slate-100 my-1" />

                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-50 transition cursor-pointer text-left"
                  >
                    <LogOut size={14} />
                    Sair da conta
                  </button>
                </div>
              )}
            </div>

          </div>

        </header>

        {/* Corpo da Página */}
        <main className="flex-1 min-w-0">
          {children}
        </main>

      </div>

      <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} />
      <UserProfileModal
        open={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        onProfileUpdated={refreshProfile}
      />

    </div>
  )
}
