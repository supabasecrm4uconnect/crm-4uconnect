import { useEffect, useState, useMemo } from 'react'
import { Navigate } from 'react-router-dom'
import {
  Building2, Search, Layers, DollarSign,
  Zap, Pencil, Mail, UserCheck, UserX
} from 'lucide-react'
import Layout from '../components/Layout'
import CustomSelect from '../components/CustomSelect'
import { InputIcon, iconInputCls } from '../components/FieldIcon'
import ClientModal from '../components/ClientModal'
import ClientesSkeleton from '../components/skeletons/ClientesSkeleton'
import WhatsAppIcon from '../components/WhatsAppIcon'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { formatCurrency, formatDate, whatsappLink } from '../lib/helpers'
import { getPlanConfig, getPlanStatusLabel, isPlanExpired, daysUntilExpiration } from '../lib/plans'
import type { Organization, PlanStatus, Profile } from '../types'

interface OrganizationWithMetrics extends Organization {
  totalLeadsCount: number
  initialProfileId: string | null
  initialProfileStatus: string | null
}

function getEffectivePlanStatus(org: Organization): PlanStatus {
  if (org.plano_status !== 'bloqueado' && isPlanExpired(org.plano_expira_em)) return 'vencido'
  return org.plano_status ?? 'ativo'
}

function hasActiveSubscription(org: Organization): boolean {
  return getEffectivePlanStatus(org) === 'ativo'
}

const statusFilterOptions = [
  { value: '', label: 'Todos os status' },
  { value: 'ativo', label: 'Ativo', dotColor: '#10b981' },
  { value: 'trial', label: 'Em Teste (Trial)', dotColor: '#f59e0b' },
  { value: 'vencido', label: 'Vencido', dotColor: '#ef4444' },
  { value: 'bloqueado', label: 'Bloqueado', dotColor: '#991b1b' },
]

const planFilterOptions = [
  { value: '', label: 'Todos os pacotes' },
  { value: 'mensal', label: 'Plano Mensal' },
  { value: 'trimestral', label: 'Plano Trimestral' },
  { value: 'semestral', label: 'Plano Semestral' },
  { value: 'anual', label: 'Plano Anual' },
  { value: 'custom', label: 'Personalizado' },
]

export default function Clientes() {
  const { profile } = useAuth()

  const [organizations, setOrganizations] = useState<OrganizationWithMetrics[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [planFilter, setPlanFilter] = useState<string>('')
  const [releasingOrgId, setReleasingOrgId] = useState<string | null>(null)

  // Modal de Criação / Edição de Cliente
  const [modalOpen, setModalOpen] = useState(false)
  const [editingClient, setEditingClient] = useState<Organization | null>(null)

  useEffect(() => {
    if (profile?.is_super_admin) void loadClients()
  }, [profile?.is_super_admin])

  async function loadClients() {
    setLoading(true)
    try {
      // 1. Carrega todas as organizações
      const { data: orgsData, error: orgsError } = await supabase
        .from('organizations')
        .select('*')
        .order('created_at', { ascending: false })

      if (orgsError) throw orgsError

      const orgs = (orgsData as Organization[]) ?? []

      // 2. Busca somente contagens agregadas autorizadas para superadmin.
      // Nenhum dado pessoal ou conteúdo de leads de clientes é retornado.
      const { data: leadCountsData, error: leadCountsError } = await supabase
        .rpc('get_superadmin_organization_lead_counts')

      if (leadCountsError) throw leadCountsError

      const leadCounts = new Map(
        ((leadCountsData as { organization_id: string; total_leads: number }[]) ?? [])
          .map(item => [item.organization_id, Number(item.total_leads)])
      )

      // 3. Cada empresa nova possui uma única conta inicial. Só ela pode ser
      // liberada nesta tela; organizações legadas com mais de um perfil não
      // recebem ação automática para evitar ativar alguém indevidamente.
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, organization_id, status, created_at')
        .order('created_at', { ascending: true })

      if (profilesError) throw profilesError

      const profiles = (profilesData as Pick<Profile, 'id' | 'organization_id' | 'status' | 'created_at'>[]) ?? []

      // Agrupa métricas
      const enriched: OrganizationWithMetrics[] = orgs.map(o => {
        const orgLeads = leadCounts.get(o.id) ?? 0
        const orgProfiles = profiles.filter(p => p.organization_id === o.id)
        const initialProfile = orgProfiles.length === 1 ? orgProfiles[0] : null

        return {
          ...o,
          totalLeadsCount: orgLeads,
          initialProfileId: initialProfile?.id ?? null,
          initialProfileStatus: initialProfile?.status ?? null,
        }
      })

      setOrganizations(enriched)
    } catch (err) {
      console.error('[Clientes] Erro ao carregar clientes:', err)
    } finally {
      setLoading(false)
    }
  }

  function handleOpenEdit(org: Organization) {
    setEditingClient(org)
    setModalOpen(true)
  }

  function handleSaved() {
    loadClients()
  }

  async function handleToggleStatus(org: OrganizationWithMetrics) {
    if (org.plano_status === 'bloqueado' && isPlanExpired(org.plano_expira_em)) return

    const nextStatus: PlanStatus = org.plano_status === 'bloqueado' ? 'ativo' : 'bloqueado'
    const { error } = await supabase
      .from('organizations')
      .update({ plano_status: nextStatus })
      .eq('id', org.id)

    if (error) {
      console.error('[Clientes] Erro ao alterar status da assinatura:', error)
      return
    }

    setOrganizations(prev => prev.map(o => o.id === org.id ? { ...o, plano_status: nextStatus } : o))
  }

  async function handleReleaseAccount(org: OrganizationWithMetrics) {
    if (!org.initialProfileId || getEffectivePlanStatus(org) === 'vencido' || org.plano_status === 'bloqueado') return

    setReleasingOrgId(org.id)
    const { error } = await supabase
      .from('profiles')
      .update({ status: 'ativo' })
      .eq('id', org.initialProfileId)

    if (error) {
      console.error('[Clientes] Erro ao liberar conta:', error)
      setReleasingOrgId(null)
      return
    }

    setOrganizations(prev => prev.map(o => o.id === org.id ? { ...o, initialProfileStatus: 'ativo' } : o))
    setReleasingOrgId(null)
  }

  // Filtragem dos clientes
  const filteredClients = useMemo(() => {
    return organizations.filter(o => {
      const q = search.toLowerCase().trim()
      const matchesSearch =
        !q ||
        o.nome.toLowerCase().includes(q) ||
        (o.nome_exibicao && o.nome_exibicao.toLowerCase().includes(q)) ||
        (o.responsavel_nome && o.responsavel_nome.toLowerCase().includes(q)) ||
        (o.responsavel_email && o.responsavel_email.toLowerCase().includes(q)) ||
        (o.responsavel_telefone && o.responsavel_telefone.toLowerCase().includes(q)) ||
        (o.plano && o.plano.toLowerCase().includes(q))

      const matchesStatus = !statusFilter || getEffectivePlanStatus(o) === statusFilter
      const matchesPlan = !planFilter || o.plano === planFilter

      return matchesSearch && matchesStatus && matchesPlan
    })
  }, [organizations, search, statusFilter, planFilter])

  // Métricas Globais (KPIs)
  const metrics = useMemo(() => {
    const totalClients = organizations.length
    const activeOrganizations = organizations.filter(hasActiveSubscription)
    const activeClients = activeOrganizations.length
    const totalMRR = activeOrganizations.reduce((acc, o) => acc + (Number(o.plano_valor_recorrente) || 0), 0)
    const totalLeads = organizations.reduce((acc, o) => acc + o.totalLeadsCount, 0)

    return {
      totalClients,
      activeClients,
      totalMRR,
      totalLeads,
    }
  }, [organizations])

  if (profile !== undefined && !profile?.is_super_admin) {
    return <Navigate to="/leads" replace />
  }

  return (
    <Layout>
      <div className="px-8 py-8 w-full min-w-0 space-y-6">

        {/* Header Principal */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-slate-950 text-xl font-bold tracking-tight flex items-center gap-2">
              Clientes & Assinaturas
            </h1>
            <p className="text-slate-600 text-sm mt-0.5">
              Gestão centralizada de empresas clientes, dados de contato, planos contratados e controle de vigência
            </p>
          </div>

        </div>

        {loading ? (
          <ClientesSkeleton />
        ) : (
          <>
            {/* KPI Cards no Topo */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

              {/* Total de Empresas */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-card">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Total de Clientes
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-200/60 shadow-2xs">
                    <Building2 size={16} />
                  </div>
                </div>
                <div className="mt-2.5">
                  <span className="text-2xl font-black text-slate-950">{metrics.totalClients}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
                  <strong className="text-slate-700">{metrics.activeClients}</strong> assinaturas ativas
                </div>
              </div>

              {/* Receita Recorrente Ativa */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-card">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Receita Recorrente Ativa
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200/60 shadow-2xs">
                    <DollarSign size={16} />
                  </div>
                </div>
                <div className="mt-2.5">
                  <span className="text-2xl font-black text-emerald-700">{formatCurrency(metrics.totalMRR)}</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Soma das assinaturas ativas e dentro da vigência
                </p>
              </div>

              {/* Base de Leads Total */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-card">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Leads na Plataforma
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-200/60 shadow-2xs">
                    <Layers size={16} />
                  </div>
                </div>
                <div className="mt-2.5">
                  <span className="text-2xl font-black text-slate-950">{metrics.totalLeads.toLocaleString('pt-BR')}</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Total de oportunidades cadastradas
                </p>
              </div>

            </div>

            {/* Barra de Busca e Filtros */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-card flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <InputIcon icon={Search}>
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar empresa, contato, email ou telefone..."
                    className={iconInputCls}
                  />
                </InputIcon>
              </div>

              <div className="w-full sm:w-48">
                <CustomSelect
                  value={statusFilter}
                  onChange={val => setStatusFilter(val)}
                  options={statusFilterOptions}
                  placeholder="Filtrar por status"
                  buttonClassName="w-full"
                />
              </div>

              <div className="w-full sm:w-48">
                <CustomSelect
                  value={planFilter}
                  onChange={val => setPlanFilter(val)}
                  options={planFilterOptions}
                  placeholder="Filtrar por plano"
                  buttonClassName="w-full"
                />
              </div>
            </div>

            {/* Tabela Rica de Clientes */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-card overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="text-slate-950 text-sm font-bold">Empresas Clientes Cadastradas</h2>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-200/70 text-slate-700">
                    {filteredClients.length}
                  </span>
                </div>
              </div>

              {filteredClients.length === 0 ? (
                <div className="p-12 text-center">
                  <Building2 size={32} className="text-slate-300 mx-auto mb-2" />
                  <p className="text-slate-700 font-bold text-sm">Nenhum cliente encontrado</p>
                  <p className="text-slate-400 text-xs mt-0.5">Tente ajustar os filtros de busca.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                        <th className="py-3 px-4">Cliente / Empresa</th>
                        <th className="py-3 px-4">Contato / Responsável</th>
                        <th className="py-3 px-4">Plano</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Vigência</th>
                        <th className="py-3 px-4">Leads</th>
                        <th className="py-3 px-4 text-right">Mensalidade</th>
                        <th className="py-3 px-4 text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                      {filteredClients.map((c, idx) => {
                        const planConfig = getPlanConfig(c.plano)
                        const effectivePlanStatus = getEffectivePlanStatus(c)
                        const statusConfig = getPlanStatusLabel(effectivePlanStatus)
                        const daysLeft = daysUntilExpiration(c.plano_expira_em)
                        const maxLeads = c.max_leads ?? 500
                        const canReleaseAccount = Boolean(c.initialProfileId)
                          && c.initialProfileStatus !== 'ativo'
                          && effectivePlanStatus !== 'vencido'
                          && c.plano_status !== 'bloqueado'

                        return (
                          <tr
                            key={c.id}
                            className="hover:bg-slate-50/80 transition animate-cascade-item"
                            style={{ animationDelay: `${idx * 30}ms` }}
                          >
                            {/* Nome & Avatar */}
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-800 text-white font-black text-xs flex items-center justify-center shadow-2xs shrink-0">
                                  {(c.nome_exibicao || c.nome || 'E').slice(0, 2).toUpperCase()}
                                </div>
                                <div>
                                  <span className="font-bold text-slate-900 block text-xs truncate max-w-[180px]">
                                    {c.nome_exibicao || c.nome}
                                  </span>
                                  {c.nome_exibicao && c.nome !== c.nome_exibicao && (
                                    <span className="text-[11px] text-slate-400 block truncate max-w-[180px]">
                                      {c.nome}
                                    </span>
                                  )}
                                  <span className="text-[10px] text-slate-400 block">
                                    Cliente desde {formatDate(c.created_at.slice(0, 10))}
                                  </span>
                                </div>
                              </div>
                            </td>

                            {/* Contato / Responsável */}
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <div>
                                <span className="font-bold text-slate-800 block text-xs">
                                  {c.responsavel_nome || <span className="text-slate-400 font-normal">Não informado</span>}
                                </span>
                                <div className="flex items-center gap-2 mt-0.5">
                                  {c.responsavel_email && (
                                    <a
                                      href={`mailto:${c.responsavel_email}`}
                                      className="text-[11px] text-slate-500 hover:text-emerald-700 flex items-center gap-1"
                                      title={c.responsavel_email}
                                    >
                                      <Mail size={11} className="text-slate-400" />
                                      <span className="truncate max-w-[120px]">{c.responsavel_email}</span>
                                    </a>
                                  )}
                                  {c.responsavel_telefone && (
                                    <a
                                      href={whatsappLink(c.responsavel_telefone)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-[11px] text-emerald-700 hover:text-emerald-800 flex items-center gap-1 font-semibold"
                                      title="Abrir WhatsApp"
                                    >
                                      <WhatsAppIcon size={12} className="text-emerald-600" />
                                      {c.responsavel_telefone}
                                    </a>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* Plano */}
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-bold text-[11px] ${planConfig.badgeBg} ${planConfig.badgeColor} border ${planConfig.badgeBorder}`}>
                                <Zap size={11} />
                                {planConfig.nome}
                              </span>
                            </td>

                            {/* Status */}
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-semibold text-[11px] ${statusConfig.bg} ${statusConfig.color} border ${statusConfig.border}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`} />
                                {statusConfig.label}
                              </span>
                            </td>

                            {/* Vigência */}
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <div>
                                <span className="font-semibold text-slate-800 block text-xs">
                                  {c.plano_expira_em ? formatDate(c.plano_expira_em.slice(0, 10)) : 'Indeterminado'}
                                </span>
                                {daysLeft != null && (
                                  <span className={`text-[10px] font-bold ${
                                    daysLeft <= 0
                                      ? 'text-red-600'
                                      : daysLeft <= 7
                                      ? 'text-amber-600'
                                      : 'text-slate-400'
                                  }`}>
                                    {daysLeft <= 0 ? 'Assinatura vencida' : `${daysLeft} dias restantes`}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Leads */}
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <div className="w-28 space-y-1">
                                <div className="flex justify-between text-[10px] font-semibold text-slate-600">
                                  <span>{c.totalLeadsCount.toLocaleString('pt-BR')} / {maxLeads.toLocaleString('pt-BR')}</span>
                                </div>
                                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${
                                      c.totalLeadsCount >= maxLeads ? 'bg-amber-500' : 'bg-blue-600'
                                    }`}
                                    style={{ width: `${Math.min(100, (c.totalLeadsCount / maxLeads) * 100)}%` }}
                                  />
                                </div>
                              </div>
                            </td>

                            {/* Mensalidade */}
                            <td className="py-3.5 px-4 whitespace-nowrap text-right font-bold text-slate-800">
                              {c.plano_valor_recorrente != null && c.plano_valor_recorrente > 0
                                ? formatCurrency(c.plano_valor_recorrente)
                                : <span className="text-slate-400 font-normal">--</span>}
                            </td>

                            {/* Ações */}
                            <td className="py-3.5 px-4 whitespace-nowrap text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                {canReleaseAccount && (
                                  <button
                                    type="button"
                                    onClick={() => handleReleaseAccount(c)}
                                    disabled={releasingOrgId === c.id}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200 disabled:cursor-not-allowed border border-emerald-700/50 transition shadow-2xs cursor-pointer select-none"
                                    title="Liberar a conta inicial desta empresa"
                                  >
                                    <UserCheck size={12} />
                                    {releasingOrgId === c.id ? 'Liberando...' : 'Liberar conta'}
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleOpenEdit(c)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 transition shadow-2xs cursor-pointer select-none"
                                  title="Gerenciar dados e plano do cliente"
                                >
                                  <Pencil size={12} className="text-slate-500" />
                                  Gerenciar
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleToggleStatus(c)}
                                  disabled={c.plano_status === 'bloqueado' && isPlanExpired(c.plano_expira_em)}
                                  className={`p-1.5 rounded-lg border transition shadow-2xs cursor-pointer select-none disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200 ${
                                    c.plano_status === 'bloqueado'
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                      : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-amber-700'
                                  }`}
                                  title={c.plano_status === 'bloqueado'
                                    ? isPlanExpired(c.plano_expira_em) ? 'Renove a vigência antes de liberar o acesso' : 'Desbloquear acesso'
                                    : 'Bloquear acesso do cliente'}
                                >
                                  {c.plano_status === 'bloqueado' ? <UserCheck size={13} /> : <UserX size={13} />}
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* Modal de Cadastro / Edição de Cliente e Plano */}
        <ClientModal
          client={editingClient}
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          onSaved={handleSaved}
        />

      </div>
    </Layout>
  )
}
