import { useEffect, useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Plus, Loader2, ToggleLeft, ToggleRight, X, Trash2, GitBranch,
  Globe, Tag, Users, Building2, User, Lock, GripVertical, Pencil,
  Eye, EyeOff, Shield, CheckCircle2, AlertCircle, Mail, Check, KeyRound, Save, ListChecks, Zap
} from 'lucide-react'
import {
  DndContext, PointerSensor, useSensor, useSensors, closestCenter,
  type DragEndEvent
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy, arrayMove,
  useSortable
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { InputIcon, iconInputCls } from '../components/FieldIcon'
import Layout from '../components/Layout'
import ConfirmModal from '../components/ConfirmModal'
import CustomSelect from '../components/CustomSelect'
import PlanManagementModal from '../components/PlanManagementModal'
import ConfiguracoesSkeleton from '../components/skeletons/ConfiguracoesSkeleton'
import { supabase } from '../lib/supabase'
import { useStatuses, COLOR_PRESETS, type StatusConfig } from '../contexts/StatusesContext'
import { useBranding } from '../contexts/BrandingContext'
import { departmentConfig, allDepartments, allActivityTypes, formatDate, normalizeCatalogName } from '../lib/helpers'
import { getPlanConfig, getPlanStatusLabel, daysUntilExpiration } from '../lib/plans'
import type { LeadSource, LeadSegment, Profile, Organization, DepartmentType } from '../types'


type Tab = 'comercial' | 'usuarios' | 'empresa'

function normalizeTab(tabStr: string | null): Tab {
  if (tabStr === 'usuarios') return 'usuarios'
  if (tabStr === 'empresa') return 'usuarios'
  return 'comercial'
}

const SYSTEM_STATUS_VALUES = ['novo', 'novo_lead', 'em_atendimento', 'proposta_enviada', 'fechado', 'perdido']

interface OrganizationIdentityCardProps {
  organization: Organization | null
  name: string
  saving: boolean
  saved: boolean
  error: string
  onNameChange: (value: string) => void
  onSubmit: (event: React.FormEvent) => void
}

function OrganizationIdentityCard({ organization, name, saving, saved, error, onNameChange, onSubmit }: OrganizationIdentityCardProps) {
  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-card space-y-4 animate-cascade-item">
      <div className="flex items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-900 flex items-center justify-center border border-slate-200/80 shadow-2xs">
            <Building2 size={18} className="text-slate-900" />
          </div>
          <div>
            <h2 className="text-slate-950 text-base font-bold">Informações da Empresa</h2>
            <p className="text-slate-500 text-xs">Identidade exibida no CRM</p>
          </div>
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">Nome da Empresa</label>
          <InputIcon icon={Building2}>
            <input
              value={name}
              onChange={event => onNameChange(event.target.value)}
              placeholder={organization?.nome || 'Ex: Imovvi Contabilidade'}
              required
              className={iconInputCls}
            />
          </InputIcon>
          <p className="text-[11px] text-slate-400 mt-1.5">Usado no CRM e nas comunicações da sua empresa.</p>
        </div>
        {error && <p className="text-xs font-medium text-red-600">{error}</p>}
        <div className="pt-1 flex items-center gap-3">
          <button
            type="submit"
            disabled={saving || !name.trim() || name.trim() === (organization?.nome_exibicao ?? organization?.nome ?? '').trim()}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200 disabled:cursor-not-allowed border border-emerald-700/50 text-white text-xs font-bold transition shadow-2xs cursor-pointer select-none"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? 'Salvando...' : 'Salvar nome'}
          </button>
          {saved && <span className="text-emerald-700 text-xs font-bold">Salvo!</span>}
        </div>
      </form>
    </div>
  )
}

interface SubscriptionSummaryCardProps {
  organization: Organization
  planName: string
  statusLabel: string
  statusClassName: string
  totalLeads: number
  maxLeads: number
  daysLeft: number | null
  onManagePlan?: () => void
}

function SubscriptionSummaryCard({ organization, planName, statusLabel, statusClassName, totalLeads, maxLeads, daysLeft, onManagePlan }: SubscriptionSummaryCardProps) {
  const monthlyValue = Number(organization.plano_valor_recorrente ?? 0)

  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-card space-y-4 animate-cascade-item">
      <div className="flex items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200">
            <Zap size={18} />
          </div>
          <div>
            <h2 className="text-slate-950 text-base font-bold">Seu Plano</h2>
            <p className="text-slate-500 text-xs">Informações da sua assinatura</p>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold text-white px-2.5 py-1 rounded-md ${statusClassName}`}>
          {statusLabel}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="rounded-lg bg-slate-50 border border-slate-100 p-3">
          <span className="block text-slate-400 text-[10px] font-bold uppercase tracking-wide">Plano contratado</span>
          <strong className="block text-slate-800 mt-1">{planName}</strong>
        </div>
        <div className="rounded-lg bg-slate-50 border border-slate-100 p-3">
          <span className="block text-slate-400 text-[10px] font-bold uppercase tracking-wide">Leads</span>
          <strong className="block text-slate-800 mt-1">{totalLeads.toLocaleString('pt-BR')} / {maxLeads.toLocaleString('pt-BR')}</strong>
        </div>
        <div className="rounded-lg bg-slate-50 border border-slate-100 p-3 col-span-2">
          <span className="block text-slate-400 text-[10px] font-bold uppercase tracking-wide">Mensalidade</span>
          <strong className="block text-slate-800 mt-1">
            {monthlyValue > 0 ? monthlyValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'Conforme combinado'}
          </strong>
        </div>
      </div>
      <p className="text-[11px] text-slate-500">
        {organization.plano_expira_em
          ? <>Vigência até <strong className="text-slate-700">{formatDate(organization.plano_expira_em.slice(0, 10))}</strong>{daysLeft != null && ` (${daysLeft <= 0 ? 'vencido' : `${daysLeft} dias restantes`})`}.</>
          : 'Acesso contínuo.'}
      </p>
      <div className="flex flex-wrap gap-2 pt-1">
        {onManagePlan && (
          <button type="button" onClick={onManagePlan} className="px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition cursor-pointer">
            Gerenciar plano
          </button>
        )}
        <a href="https://wa.me/5515992568868?text=Ol%C3%A1%2C%20preciso%20de%20ajuda%20com%20o%20plano%20do%20Connect%20CRM." target="_blank" rel="noopener noreferrer" className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition">
          Falar com suporte
        </a>
      </div>
    </div>
  )
}

interface SortablePipelineStatusItemProps {
  status: StatusConfig
  index: number
  onEdit: (status: StatusConfig) => void
  onToggle: (id: string, ativo: boolean) => void
  onDelete: (status: StatusConfig) => void
}

function SortablePipelineStatusItem({
  status: s,
  index: idx,
  onEdit,
  onToggle,
  onDelete,
}: SortablePipelineStatusItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: s.id })
  const transformStyle = transform ? CSS.Translate.toString({ ...transform, x: 0 }) : undefined
  const isSystem = SYSTEM_STATUS_VALUES.includes(s.value)

  return (
    <div
      ref={setNodeRef}
      style={{ transform: transformStyle, transition, opacity: isDragging ? 0.35 : 1 }}
      className={`p-3 sm:px-4 flex items-center justify-between gap-2.5 transition select-none ${
        isDragging ? 'bg-emerald-50/80 z-30 ring-2 ring-emerald-500/30 shadow-md' : s.ativo ? 'hover:bg-slate-50/70' : 'bg-slate-50/40 opacity-60'
      }`}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {/* Grip Handle para arrastar e reordenar */}
        <button
          {...attributes}
          {...listeners}
          type="button"
          className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-600 touch-none shrink-0 p-1 -ml-1 rounded hover:bg-slate-100 transition"
          title="Arraste para reordenar esta etapa no funil"
        >
          <GripVertical size={14} />
        </button>

        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider bg-slate-100 px-1.5 py-0.5 rounded-md shrink-0">
          #{idx + 1}
        </span>

        <div
          onClick={() => onEdit(s)}
          className="cursor-pointer group flex items-center gap-2 min-w-0 flex-1"
          title="Clique para editar esta etapa do funil"
        >
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold truncate shrink-0 transition group-hover:scale-102"
            style={{ color: s.color_text, background: s.color_bg }}
          >
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: s.color_dot }} />
            {s.label}
          </span>
          {s.auto_task_enabled && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200/80 px-1.5 py-0.5 rounded-md shrink-0" title={`Tarefa automática: ${s.auto_task_tipo || 'tarefa'} em ${s.auto_task_dias ?? 2} dias`}>
              <Zap size={9} /> Auto
            </span>
          )}
          {isSystem ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400 bg-slate-100/90 border border-slate-200/80 px-1.5 py-0.5 rounded-md shrink-0">
              <Lock size={9} /> Sistema
            </span>
          ) : (
            <span className="text-[11px] font-mono text-slate-400 truncate hidden xl:inline">
              {s.value}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={() => onEdit(s)}
          className="p-1 text-slate-300 hover:text-slate-600 transition rounded-lg hover:bg-slate-100 cursor-pointer"
          title="Editar etapa"
        >
          <Pencil size={13} />
        </button>

        {isSystem ? (
          <span className="p-1 text-slate-300 cursor-not-allowed" title="Status vital do sistema (permanece sempre ativo)">
            <ToggleRight size={20} className="text-slate-300" />
          </span>
        ) : (
          <button
            type="button"
            onClick={() => onToggle(s.id, s.ativo)}
            className={`transition cursor-pointer ${s.ativo ? 'text-emerald-600 hover:text-emerald-700' : 'text-slate-300 hover:text-slate-400'}`}
            title={s.ativo ? 'Desativar etapa' : 'Ativar etapa'}
          >
            {s.ativo ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
          </button>
        )}

        {isSystem ? (
          <div className="p-1 text-slate-300 cursor-not-allowed" title="Status essencial do sistema — não pode ser excluído">
            <Lock size={13} />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => onDelete(s)}
            className="p-1 text-slate-300 hover:text-red-500 transition rounded-lg hover:bg-red-50 cursor-pointer"
            title="Excluir status"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
    </div>
  )
}

export default function Configuracoes() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = normalizeTab(searchParams.get('tab'))

  function handleTabChange(tab: Tab) {
    if (tab === activeTab) return
    setSearchParams({ tab }, { replace: true })
  }

  const { statuses, refresh: refreshStatuses, updateOne: updateStatus } = useStatuses()
  const { refresh: refreshBranding } = useBranding()
  const [sources,  setSources]  = useState<LeadSource[]>([])
  const [segments, setSegments] = useState<LeadSegment[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading,  setLoading]  = useState(true)
  const [myUserId, setMyUserId] = useState<string | null>(null)
  const [myOrgId,  setMyOrgId]  = useState<string | null>(null)
  const [isAdmin,  setIsAdmin]  = useState(false)

  // Meu Perfil
  const [myProfile,    setMyProfile]    = useState<Profile | null>(null)
  const [myNome,       setMyNome]       = useState('')
  const [savingMyName, setSavingMyName] = useState(false)
  const [myNameSaved,  setMyNameSaved]  = useState(false)
  const [myNameError,  setMyNameError]  = useState('')

  // Senha
  const [senhaAtual,         setSenhaAtual]         = useState('')
  const [novaSenha,          setNovaSenha]          = useState('')
  const [confirmarSenha,     setConfirmarSenha]     = useState('')
  const [showSenhaAtual,     setShowSenhaAtual]     = useState(false)
  const [showNovaSenha,      setShowNovaSenha]      = useState(false)
  const [showConfirmarSenha, setShowConfirmarSenha] = useState(false)
  const [savingPassword,     setSavingPassword]     = useState(false)
  const [passwordSaved,      setPasswordSaved]      = useState(false)
  const [passwordError,      setPasswordError]      = useState('')

  // Origens
  const [newSource,            setNewSource]            = useState('')
  const [savingSource,         setSavingSource]         = useState(false)
  const [showSourceModal,      setShowSourceModal]      = useState(false)
  const [editingSource,        setEditingSource]        = useState<LeadSource | null>(null)
  const [sourceError,          setSourceError]          = useState('')
  const [confirmDeleteSource,  setConfirmDeleteSource]  = useState<string | null>(null)
  const [deletingSource,       setDeletingSource]       = useState(false)

  // Segmentos
  const [newSegment,           setNewSegment]           = useState('')
  const [savingSegment,        setSavingSegment]        = useState(false)
  const [showSegmentModal,     setShowSegmentModal]     = useState(false)
  const [editingSegment,       setEditingSegment]       = useState<LeadSegment | null>(null)
  const [segmentError,         setSegmentError]         = useState('')
  const [confirmDeleteSegment, setConfirmDeleteSegment] = useState<string | null>(null)
  const [deletingSegment,      setDeletingSegment]      = useState(false)

  // Status (Pipeline)
  const [showStatusModal,     setShowStatusModal]     = useState(false)
  const [statusForm,          setStatusForm]          = useState({
    label: '',
    preset: 0,
    auto_task_enabled: false,
    auto_task_tipo: 'ligar',
    auto_task_dias: 2,
    auto_task_descricao: '',
  })
  const [savingStatus,        setSavingStatus]        = useState(false)
  const [editingStatus,       setEditingStatus]       = useState<StatusConfig | null>(null)
  const [confirmDeleteStatus, setConfirmDeleteStatus] = useState<StatusConfig | null>(null)
  const [deletingStatus,      setDeletingStatus]      = useState(false)
  const [statusDeleteError,   setStatusDeleteError]   = useState<string | null>(null)
  const [statusFormError,     setStatusFormError]     = useState('')

  // Empresa / Marca & Planos
  const [org,            setOrg]            = useState<Organization | null>(null)
  const [orgNome,        setOrgNome]        = useState('')
  const [savingMarca,    setSavingMarca]    = useState(false)
  const [marcaSaved,     setMarcaSaved]     = useState(false)
  const [orgError,       setOrgError]       = useState('')
  const [showPlanModal,  setShowPlanModal]  = useState(false)
  const [planLimitWarning, setPlanLimitWarning] = useState<{ title: string; message: string } | null>(null)
  const [totalLeads,     setTotalLeads]     = useState<number>(0)

  // Dirty state checks para habilitar botão de salvar apenas se houver alterações reais
  const statusOriginalPreset = useMemo(() => {
    if (!editingStatus) return 0
    const idx = COLOR_PRESETS.findIndex(p => p.color_dot === editingStatus.color_dot || p.color_bg === editingStatus.color_bg)
    return idx >= 0 ? idx : 0
  }, [editingStatus])

  const isStatusDirty = editingStatus
    ? (
        statusForm.label.trim() !== editingStatus.label ||
        statusForm.preset !== statusOriginalPreset ||
        statusForm.auto_task_enabled !== (editingStatus.auto_task_enabled ?? false) ||
        (statusForm.auto_task_enabled && (
          statusForm.auto_task_tipo !== (editingStatus.auto_task_tipo ?? 'ligar') ||
          statusForm.auto_task_dias !== (editingStatus.auto_task_dias ?? 2) ||
          statusForm.auto_task_descricao.trim() !== (editingStatus.auto_task_descricao ?? '').trim()
        ))
      )
    : statusForm.label.trim().length > 0

  const isSourceDirty = editingSource
    ? (newSource.trim() !== editingSource.nome)
    : newSource.trim().length > 0

  const isSegmentDirty = editingSegment
    ? (newSegment.trim() !== editingSegment.nome)
    : newSegment.trim().length > 0

  const activityTypeOptions = useMemo(() => allActivityTypes().map(a => ({
    value: a.value,
    label: a.label,
  })), [])

  const departmentOptions = useMemo(() => allDepartments().map(d => ({
    value: d.value,
    label: d.label.split(' / ')[0],
    dotColor: d.dot,
  })), [])

  const roleOptions = useMemo(() => [
    { value: 'atendente', label: 'Atendente' },
    { value: 'admin', label: 'Admin' },
  ], [])

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user

    if (user) {
      setMyUserId(user.id)

      // 1. Busca o próprio perfil do usuário logado
      const { data: selfProf } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      const myProf = selfProf as Profile | null
      if (myProf) {
        setMyProfile(myProf)
        setMyNome(myProf.nome || '')
        setIsAdmin(myProf.tipo_usuario === 'admin' || (myProf as any).is_super_admin === true)
        setMyOrgId(myProf.organization_id || null)

        // Mesmo para superadmin, esta tela trabalha com o catálogo da própria
        // organização. Isso evita misturar origens e segmentos de clientes.
        if (myProf.organization_id) {
          const [sourcesRes, segmentsRes, leadsCountRes] = await Promise.all([
            supabase.from('lead_sources').select('*').eq('organization_id', myProf.organization_id).order('nome'),
            supabase.from('lead_segments').select('*').eq('organization_id', myProf.organization_id).order('nome'),
            supabase.from('leads').select('*', { count: 'exact', head: true }).eq('organization_id', myProf.organization_id),
          ])
          setSources(sourcesRes.data ?? [])
          setSegments(segmentsRes.data ?? [])
          setTotalLeads(leadsCountRes.count ?? 0)
        } else {
          setSources([])
          setSegments([])
          setTotalLeads(0)
        }

        // 2. Carrega estritamente os perfis da organização atual
        // 3. Carrega os dados da organização
        if (myProf.organization_id) {
          const { data: orgData } = await supabase
            .from('organizations')
            .select('*')
            .eq('id', myProf.organization_id)
            .single()
          if (orgData) {
            const o = orgData as Organization
            setOrg(o)
            setOrgNome(o.nome_exibicao ?? o.nome ?? '')
          }
        }
      }
    }

    setLoading(false)
  }

  // --- Empresa / Marca ---
  async function saveMarca(e: React.FormEvent) {
    e.preventDefault()
    if (!myOrgId) return
    const nomeEmpresa = orgNome.trim()
    if (!nomeEmpresa) {
      setOrgError('Informe o nome da empresa.')
      return
    }
    setSavingMarca(true)
    setMarcaSaved(false)
    setOrgError('')
    const { error } = await supabase.from('organizations').update({
      nome: nomeEmpresa,
      nome_exibicao: nomeEmpresa,
    }).eq('id', myOrgId)
    setSavingMarca(false)
    if (error) { setOrgError('Não foi possível salvar a marca. Tente novamente.'); return }
    setOrg(current => current ? { ...current, nome: nomeEmpresa, nome_exibicao: nomeEmpresa } : current)
    setMarcaSaved(true)
    await refreshBranding()
    setTimeout(() => setMarcaSaved(false), 2500)
  }

  // --- Opener Helpers ---
  function openNewStatus() {
    setEditingStatus(null)
    setStatusFormError('')
    setStatusForm({
      label: '',
      preset: 0,
      auto_task_enabled: false,
      auto_task_tipo: 'ligar',
      auto_task_dias: 2,
      auto_task_descricao: '',
    })
    setShowStatusModal(true)
  }

  function openEditStatus(s: StatusConfig) {
    setEditingStatus(s)
    setStatusFormError('')
    const idx = COLOR_PRESETS.findIndex(p => p.color_dot === s.color_dot || p.color_bg === s.color_bg)
    setStatusForm({
      label: s.label,
      preset: idx >= 0 ? idx : 0,
      auto_task_enabled: s.auto_task_enabled ?? false,
      auto_task_tipo: s.auto_task_tipo ?? 'ligar',
      auto_task_dias: s.auto_task_dias ?? 2,
      auto_task_descricao: s.auto_task_descricao ?? '',
    })
    setShowStatusModal(true)
  }

  function openNewSource() {
    setEditingSource(null)
    setNewSource('')
    setSourceError('')
    setShowSourceModal(true)
  }

  function openEditSource(s: LeadSource) {
    setEditingSource(s)
    setNewSource(s.nome)
    setSourceError('')
    setShowSourceModal(true)
  }

  function openNewSegment() {
    setEditingSegment(null)
    setNewSegment('')
    setSegmentError('')
    setShowSegmentModal(true)
  }

  function openEditSegment(s: LeadSegment) {
    setEditingSegment(s)
    setNewSegment(s.nome)
    setSegmentError('')
    setShowSegmentModal(true)
  }

  // --- Reloaders Granulares (Evita piscar/recarregar todas as colunas) ---
  async function reloadSources() {
    if (!myOrgId) return
    const { data } = await supabase.from('lead_sources').select('*').eq('organization_id', myOrgId).order('nome')
    if (data) setSources(data)
  }

  async function reloadSegments() {
    if (!myOrgId) return
    const { data } = await supabase.from('lead_segments').select('*').eq('organization_id', myOrgId).order('nome')
    if (data) setSegments(data)
  }

  // --- Sources ---
  async function saveSource(e: React.FormEvent) {
    e.preventDefault()
    if (!newSource.trim() || !isSourceDirty) return
    const nome = newSource.trim().replace(/\s+/g, ' ')
    const duplicate = sources.some(s => s.id !== editingSource?.id && normalizeCatalogName(s.nome) === normalizeCatalogName(nome))
    if (duplicate) {
      setSourceError('Já existe uma origem com este nome.')
      return
    }
    setSavingSource(true)
    setSourceError('')
    let error
    if (editingSource) {
      ;({ error } = await supabase.from('lead_sources').update({ nome }).eq('id', editingSource.id))
    } else {
      ;({ error } = await supabase.from('lead_sources').insert({ nome, organization_id: myOrgId }))
    }
    if (error) {
      setSavingSource(false)
      setSourceError('Não foi possível salvar. Uma origem equivalente pode já existir.')
      return
    }
    setNewSource('')
    setEditingSource(null)
    setSavingSource(false)
    setShowSourceModal(false)
    reloadSources()
  }

  async function toggleSource(id: string, ativo: boolean) {
    setSources(prev => prev.map(s => s.id === id ? { ...s, ativo: !ativo } : s))
    await supabase.from('lead_sources').update({ ativo: !ativo }).eq('id', id)
  }

  async function deleteSource(id: string) {
    setDeletingSource(true)
    setSources(prev => prev.filter(s => s.id !== id))
    await supabase.from('lead_sources').delete().eq('id', id)
    setDeletingSource(false)
    setConfirmDeleteSource(null)
    reloadSources()
  }

  // --- Segments ---
  async function saveSegment(e: React.FormEvent) {
    e.preventDefault()
    if (!newSegment.trim() || !isSegmentDirty) return
    const nome = newSegment.trim().replace(/\s+/g, ' ')
    const duplicate = segments.some(s => s.id !== editingSegment?.id && normalizeCatalogName(s.nome) === normalizeCatalogName(nome))
    if (duplicate) {
      setSegmentError('Já existe um segmento com este nome.')
      return
    }
    setSavingSegment(true)
    setSegmentError('')
    let error
    if (editingSegment) {
      ;({ error } = await supabase.from('lead_segments').update({ nome }).eq('id', editingSegment.id))
    } else {
      ;({ error } = await supabase.from('lead_segments').insert({ nome, organization_id: myOrgId }))
    }
    if (error) {
      setSavingSegment(false)
      setSegmentError('Não foi possível salvar. Um segmento equivalente pode já existir.')
      return
    }
    setNewSegment('')
    setEditingSegment(null)
    setSavingSegment(false)
    setShowSegmentModal(false)
    reloadSegments()
  }

  async function toggleSegment(id: string, ativo: boolean) {
    setSegments(prev => prev.map(s => s.id === id ? { ...s, ativo: !ativo } : s))
    await supabase.from('lead_segments').update({ ativo: !ativo }).eq('id', id)
  }

  async function deleteSegment(id: string) {
    setDeletingSegment(true)
    setSegments(prev => prev.filter(s => s.id !== id))
    await supabase.from('lead_segments').delete().eq('id', id)
    setDeletingSegment(false)
    setConfirmDeleteSegment(null)
    reloadSegments()
  }

  // --- Status (Pipeline) ---
  async function saveStatus(e: React.FormEvent) {
    e.preventDefault()
    if (!statusForm.label.trim()) return
    setStatusFormError('')
    setSavingStatus(true)
    const preset = COLOR_PRESETS[statusForm.preset]
    if (editingStatus) {
      await supabase.from('lead_statuses').update({
        label: statusForm.label.trim(),
        color_text: preset.color_text,
        color_bg: preset.color_bg,
        color_dot: preset.color_dot,
        auto_task_enabled: statusForm.auto_task_enabled,
        auto_task_tipo: statusForm.auto_task_enabled ? statusForm.auto_task_tipo : null,
        auto_task_dias: statusForm.auto_task_enabled ? statusForm.auto_task_dias : null,
        auto_task_descricao: statusForm.auto_task_enabled ? (statusForm.auto_task_descricao.trim() || null) : null,
      }).eq('id', editingStatus.id)
      await refreshStatuses()
    } else {
      const value = statusForm.label.trim()
        .toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_]/g, '')
      const maxOrdem = statuses.length > 0 ? Math.max(...statuses.map(s => s.ordem)) + 1 : 0
      if (statuses.some(s => s.value === value)) {
        setSavingStatus(false)
        setStatusFormError('Já existe uma etapa com este nome.')
        return
      }
      const { error } = await supabase.from('lead_statuses').insert({
        value,
        label: statusForm.label.trim(),
        color_text: preset.color_text,
        color_bg: preset.color_bg,
        color_dot: preset.color_dot,
        ordem: maxOrdem,
        organization_id: myOrgId,
        auto_task_enabled: statusForm.auto_task_enabled,
        auto_task_tipo: statusForm.auto_task_enabled ? statusForm.auto_task_tipo : null,
        auto_task_dias: statusForm.auto_task_enabled ? statusForm.auto_task_dias : null,
        auto_task_descricao: statusForm.auto_task_enabled ? (statusForm.auto_task_descricao.trim() || null) : null,
      })
      if (error) {
        setSavingStatus(false)
        setStatusFormError('Não foi possível salvar. Uma etapa equivalente pode já existir.')
        return
      }
      await refreshStatuses()
    }
    setStatusForm({
      label: '',
      preset: 0,
      auto_task_enabled: false,
      auto_task_tipo: 'ligar',
      auto_task_dias: 2,
      auto_task_descricao: '',
    })
    setEditingStatus(null)
    setSavingStatus(false)
    setShowStatusModal(false)
  }

  async function toggleStatus(id: string, ativo: boolean) {
    const s = statuses.find(st => st.id === id)
    if (s && SYSTEM_STATUS_VALUES.includes(s.value) && ativo) {
      // Bloqueia desativação de status de sistema
      return
    }
    updateStatus(id, { ativo: !ativo })
    await supabase.from('lead_statuses').update({ ativo: !ativo }).eq('id', id)
  }

  async function deleteStatus(status: StatusConfig) {
    if (SYSTEM_STATUS_VALUES.includes(status.value)) {
      setStatusDeleteError('Este status é essencial para o funcionamento do sistema e não pode ser excluído.')
      return
    }
    setDeletingStatus(true)
    setStatusDeleteError(null)
    const { count } = await supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('status', status.value)
    if (count && count > 0) {
      setDeletingStatus(false)
      setStatusDeleteError(`Não é possível excluir: ${count} lead${count > 1 ? 's estão' : ' está'} neste status. Mova ${count > 1 ? 'os leads' : 'o lead'} para outro status antes de excluir.`)
      return
    }
    await supabase.from('lead_statuses').delete().eq('id', status.id)
    await refreshStatuses()
    setDeletingStatus(false)
    setConfirmDeleteStatus(null)
  }

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  )

  async function handleStatusDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = statuses.findIndex(s => s.id === active.id)
    const newIndex = statuses.findIndex(s => s.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const reordered = arrayMove(statuses, oldIndex, newIndex)

    const updates = reordered.map((s, idx) =>
      supabase.from('lead_statuses').update({ ordem: idx }).eq('id', s.id)
    )
    await Promise.all(updates)
    await refreshStatuses()
  }

  // --- Meu Perfil & Segurança ---
  async function handleSaveMyName(e: React.FormEvent) {
    e.preventDefault()
    if (!myUserId || !myNome.trim()) return
    setSavingMyName(true)
    setMyNameSaved(false)
    setMyNameError('')

    try {
      const { error: profileErr } = await supabase
        .from('profiles')
        .update({ nome: myNome.trim() })
        .eq('id', myUserId)

      if (profileErr) throw profileErr

      await supabase.auth.updateUser({ data: { nome: myNome.trim() } })
      if (myProfile) {
        setMyProfile({ ...myProfile, nome: myNome.trim() })
      }
      setMyNameSaved(true)
      setTimeout(() => setMyNameSaved(false), 3500)
    } catch (err: any) {
      setMyNameError(err?.message || 'Erro ao atualizar nome.')
    } finally {
      setSavingMyName(false)
    }
  }

  async function handleUpdatePassword(e: React.FormEvent) {
    e.preventDefault()
    setPasswordError('')
    setPasswordSaved(false)

    if (!senhaAtual) {
      setPasswordError('Informe sua senha atual.')
      return
    }
    if (novaSenha.length < 6) {
      setPasswordError('A nova senha deve ter no mínimo 6 caracteres.')
      return
    }
    if (novaSenha !== confirmarSenha) {
      setPasswordError('As senhas digitadas não coincidem.')
      return
    }
    if (novaSenha === senhaAtual) {
      setPasswordError('A nova senha deve ser diferente da senha atual.')
      return
    }

    setSavingPassword(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !user.email) {
        setPasswordError('Sessão expirada. Faça login novamente.')
        setSavingPassword(false)
        return
      }

      // Reautentica com a senha atual para validação prévia
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: senhaAtual,
      })

      if (verifyError) {
        setPasswordError('A senha atual informada está incorreta.')
        setSavingPassword(false)
        return
      }

      // Atualiza para a nova senha
      const { error: updateError } = await supabase.auth.updateUser({
        password: novaSenha,
      })

      if (updateError) throw updateError

      setPasswordSaved(true)
      setSenhaAtual('')
      setNovaSenha('')
      setConfirmarSenha('')
      setTimeout(() => setPasswordSaved(false), 4000)
    } catch (err: any) {
      setPasswordError(err?.message || 'Erro ao alterar a senha.')
    } finally {
      setSavingPassword(false)
    }
  }

  // Computed Plan helpers
  const activeUsersCount = useMemo(() => profiles.filter(p => p.status === 'ativo').length, [profiles])
  const maxAllowedUsers = org?.max_usuarios ?? 1
  const maxAllowedLeads = org?.max_leads ?? 500
  const planCfg = useMemo(() => getPlanConfig(org?.plano), [org?.plano])
  const planStatusCfg = useMemo(() => getPlanStatusLabel(org?.plano_status), [org?.plano_status])
  const daysLeft = useMemo(() => daysUntilExpiration(org?.plano_expira_em), [org?.plano_expira_em])
  const planStatusBadgeClass = useMemo(() => {
    switch (org?.plano_status) {
      case 'trial': return 'bg-amber-600'
      case 'vencido': return 'bg-red-600'
      case 'bloqueado': return 'bg-rose-700'
      default: return 'bg-emerald-600'
    }
  }, [org?.plano_status])

  // Mantido apenas para compatibilidade com registros legados; a interface não expõe gestão de equipe.
  async function toggleProfileStatus(id: string, status: string) {
    const newStatus = status === 'ativo' ? 'inativo' : 'ativo'

    if (newStatus === 'ativo') {
      const activeCount = profiles.filter(p => p.status === 'ativo' && p.id !== id).length + 1
      const maxUsers = org?.max_usuarios ?? 1
      if (activeCount > maxUsers) {
        setPlanLimitWarning({
          title: 'Limite de Usuários Atingido',
          message: `Seu plano atual (${planCfg.nome}) permite até ${maxUsers} ${maxUsers === 1 ? 'colaborador ativo' : 'colaboradores ativos'}.`,
        })
        return
      }
    }

    setProfiles(prev => prev.map(p => p.id === id ? { ...p, status: newStatus } : p))
    await supabase.from('profiles').update({ status: newStatus }).eq('id', id)
  }

  async function updateProfileDepartamento(id: string, departamento: DepartmentType) {
    setProfiles(prev => prev.map(p => p.id === id ? { ...p, departamento } : p))
    await supabase.from('profiles').update({ departamento }).eq('id', id)
  }

  async function updateProfileRole(id: string, tipo_usuario: 'admin' | 'atendente') {
    setProfiles(prev => prev.map(p => p.id === id ? { ...p, tipo_usuario } : p))
    const { error } = await supabase.from('profiles').update({ tipo_usuario }).eq('id', id)
    if (error) {
      console.error('[Configuracoes] Erro ao atualizar cargo:', error)
      loadAll()
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="px-8 py-8 w-full min-w-0">
          <div className="mb-6">
            <h1 className="text-slate-950 text-xl font-bold tracking-tight">Configurações</h1>
            <p className="text-slate-600 text-sm mt-0.5">Gerencie regras do funil comercial e os parâmetros da sua conta</p>
          </div>
          <ConfiguracoesSkeleton />
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="px-8 py-8 w-full min-w-0">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-slate-950 text-xl font-bold tracking-tight">Configurações</h1>
          <p className="text-slate-600 text-sm mt-0.5">Gerencie regras do funil comercial e os parâmetros da sua conta</p>
        </div>

        {/* Abas Principais (TABS) — Cantos rounded-xl e ativo verde sólido */}
        <div className="flex items-center gap-1.5 bg-slate-100/90 p-1.5 rounded-xl border border-slate-200/80 mb-7 max-w-2xl shadow-2xs">
          <button
            type="button"
            onClick={() => handleTabChange('comercial')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer select-none ${
              activeTab === 'comercial'
                ? 'bg-emerald-600 text-white shadow-xs border border-emerald-700/60'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <GitBranch size={15} className={activeTab === 'comercial' ? 'text-white' : 'text-slate-400'} />
            <span className="truncate">Regras Comerciais & Funil</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('usuarios')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer select-none relative ${
              activeTab === 'usuarios'
                ? 'bg-emerald-600 text-white shadow-xs border border-emerald-700/60'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <User size={15} className={activeTab === 'usuarios' ? 'text-white' : 'text-slate-400'} />
            <span className="truncate">Minha Conta & Planos</span>
          </button>
        </div>

        {/* Tab 1: Regras Comerciais & Funil */}
        {activeTab === 'comercial' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">

            {/* Coluna 1: Status do Pipeline */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-card overflow-hidden flex flex-col relative min-h-[460px] animate-cascade-item">
              <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200/60 shadow-2xs">
                    <GitBranch size={16} />
                  </div>
                  <div>
                    <h2 className="text-slate-950 text-sm font-bold">Status do Pipeline</h2>
                    <p className="text-slate-500 text-xs">Etapas do funil ({statuses.length})</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={openNewStatus}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-2xs cursor-pointer shrink-0"
                >
                  <Plus size={13} /> Nova Etapa
                </button>
              </div>

              {/* Modal Contextual Centrado na Coluna 1 */}
              {showStatusModal && (
                <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4 z-20 animate-fade-in">
                  <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-sm overflow-hidden animate-scale-in">
                    <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50/60">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200/60">
                          {editingStatus ? <Pencil size={14} /> : <GitBranch size={14} />}
                        </div>
                        <h3 className="text-slate-900 text-sm font-bold">
                          {editingStatus ? 'Editar Etapa do Funil' : 'Nova Etapa do Funil'}
                        </h3>
                      </div>
                      <button
                        onClick={() => { setShowStatusModal(false); setEditingStatus(null) }}
                        className="text-slate-400 hover:text-slate-600 transition cursor-pointer"
                      >
                        <X size={16} />
                      </button>
                    </div>
                    <form onSubmit={saveStatus} className="p-4.5 space-y-3.5">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">Nome da Etapa *</label>
                        <InputIcon icon={Tag}>
                          <input
                            autoFocus
                            value={statusForm.label}
                            onChange={e => { setStatusFormError(''); setStatusForm(f => ({ ...f, label: e.target.value })) }}
                            placeholder="Ex: Negociação, Em proposta..."
                            required
                            className={iconInputCls}
                          />
                        </InputIcon>
                        {statusFormError && <p className="mt-1.5 text-xs font-medium text-red-600">{statusFormError}</p>}
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">Cor da Etapa</label>
                        <div className="flex flex-wrap gap-1.5">
                          {COLOR_PRESETS.map((preset, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => setStatusForm(f => ({ ...f, preset: i }))}
                              title={preset.name}
                              className={`w-6 h-6 rounded-full transition ring-offset-2 cursor-pointer ${statusForm.preset === i ? 'ring-2 ring-emerald-500 scale-110' : 'hover:scale-105'}`}
                              style={{ background: preset.color_dot }}
                            />
                          ))}
                        </div>
                        <div className="mt-2.5 flex items-center gap-2">
                          <span
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold"
                            style={{ color: COLOR_PRESETS[statusForm.preset].color_text, background: COLOR_PRESETS[statusForm.preset].color_bg }}
                          >
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: COLOR_PRESETS[statusForm.preset].color_dot }} />
                            {statusForm.label || 'Prévia visual'}
                          </span>
                        </div>
                      </div>

                      {/* Tarefa Automática */}
                      <div className="pt-2.5 border-t border-slate-100 space-y-2.5">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={statusForm.auto_task_enabled}
                            onChange={e => setStatusForm(f => ({ ...f, auto_task_enabled: e.target.checked }))}
                            className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                          />
                          <span className="text-xs font-bold text-slate-700">
                            Criar tarefa automática ao mover lead
                          </span>
                        </label>

                        {statusForm.auto_task_enabled && (
                          <div className="space-y-2.5 pl-6 pt-1 animate-fade-in">
                            <div>
                              <label className="block text-[11px] font-bold text-slate-600 mb-1">Tipo de Tarefa</label>
                              <CustomSelect
                                value={statusForm.auto_task_tipo}
                                onChange={val => setStatusForm(f => ({ ...f, auto_task_tipo: val }))}
                                options={activityTypeOptions}
                                placeholder="Selecione o tipo"
                                icon={ListChecks}
                                buttonClassName="w-full"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-600 mb-1">Prazo (dias a partir de hoje)</label>
                              <input
                                type="number"
                                min={0}
                                value={statusForm.auto_task_dias}
                                onChange={e => setStatusForm(f => ({ ...f, auto_task_dias: Math.max(0, Number(e.target.value)) }))}
                                className="w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-600 mb-1">Descrição padrão (opcional)</label>
                              <textarea
                                value={statusForm.auto_task_descricao}
                                onChange={e => setStatusForm(f => ({ ...f, auto_task_descricao: e.target.value }))}
                                rows={2}
                                placeholder="Ex: Entrar em contato para dar continuidade"
                                className="w-full p-2 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition resize-none"
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => { setShowStatusModal(false); setEditingStatus(null) }}
                          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 transition cursor-pointer shadow-2xs select-none"
                        >
                          <X size={14} className="text-slate-400" />
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          disabled={savingStatus || !statusForm.label.trim() || !isStatusDirty}
                          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200 disabled:cursor-not-allowed border border-emerald-700/50 text-white text-xs font-bold transition cursor-pointer shadow-2xs select-none"
                        >
                          {savingStatus ? <Loader2 size={13} className="animate-spin" /> : editingStatus ? <Check size={13} /> : <Plus size={13} />}
                          {savingStatus ? 'Salvando...' : editingStatus ? 'Salvar Alterações' : 'Criar Etapa'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* Lista de Status com Reordenação por Arrastar (Drag & Drop) */}
              <div className="divide-y divide-slate-100 max-h-[620px] overflow-y-auto">
                {statuses.length === 0 ? (
                  <div className="p-8 text-center">
                    <p className="text-slate-400 text-xs">Nenhum status cadastrado.</p>
                  </div>
                ) : (
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleStatusDragEnd}>
                    <SortableContext items={statuses.map(s => s.id)} strategy={verticalListSortingStrategy}>
                      {statuses.map((s, idx) => (
                        <SortablePipelineStatusItem
                          key={s.id}
                          status={s}
                          index={idx}
                          onEdit={openEditStatus}
                          onToggle={toggleStatus}
                          onDelete={status => { setStatusDeleteError(null); setConfirmDeleteStatus(status) }}
                        />
                      ))}
                    </SortableContext>
                  </DndContext>
                )}
              </div>
            </div>

            {/* Coluna 2: Origens de Leads */}
            <div
              className="bg-white rounded-xl border border-slate-200 shadow-card overflow-hidden flex flex-col relative min-h-[460px] animate-cascade-item"
              style={{ animationDelay: '80ms' }}
            >
              <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-900 flex items-center justify-center border border-slate-200/80 shadow-2xs">
                    <Globe size={16} />
                  </div>
                  <div>
                    <h2 className="text-slate-950 text-sm font-bold">Origens de Leads</h2>
                    <p className="text-slate-500 text-xs">Canais de atração ({sources.length})</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={openNewSource}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-2xs cursor-pointer shrink-0"
                >
                  <Plus size={13} /> Nova Origem
                </button>
              </div>

              {/* Modal Contextual Centrado na Coluna 2 */}
              {showSourceModal && (
                <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4 z-20 animate-fade-in">
                  <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-sm overflow-hidden animate-scale-in">
                    <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50/60">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-xl bg-slate-100 text-slate-900 flex items-center justify-center border border-slate-200/80">
                          {editingSource ? <Pencil size={14} /> : <Globe size={14} />}
                        </div>
                        <h3 className="text-slate-900 text-sm font-bold">
                          {editingSource ? 'Editar Origem' : 'Nova Origem de Leads'}
                        </h3>
                      </div>
                      <button
                        onClick={() => { setShowSourceModal(false); setEditingSource(null) }}
                        className="text-slate-400 hover:text-slate-600 transition cursor-pointer"
                      >
                        <X size={16} />
                      </button>
                    </div>
                    <form onSubmit={saveSource} className="p-4.5 space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">Nome do Canal / Origem *</label>
                        <InputIcon icon={Globe}>
                          <input
                            autoFocus
                            value={newSource}
                            onChange={e => { setSourceError(''); setNewSource(e.target.value) }}
                            placeholder="Ex: Instagram Ads, Indicação..."
                            required
                            className={iconInputCls}
                          />
                        </InputIcon>
                        {sourceError && <p className="mt-1.5 text-xs font-medium text-red-600">{sourceError}</p>}
                      </div>
                      <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => { setShowSourceModal(false); setEditingSource(null) }}
                          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 transition cursor-pointer shadow-2xs select-none"
                        >
                          <X size={14} className="text-slate-400" />
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          disabled={savingSource || !newSource.trim() || !isSourceDirty}
                          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200 disabled:cursor-not-allowed border border-emerald-700/50 text-white text-xs font-bold transition cursor-pointer shadow-2xs select-none"
                        >
                          {savingSource ? <Loader2 size={13} className="animate-spin" /> : editingSource ? <Check size={13} /> : <Plus size={13} />}
                          {savingSource ? 'Salvando...' : editingSource ? 'Salvar Alterações' : 'Criar Origem'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* Lista de Origens */}
              <div className="divide-y divide-slate-100 max-h-[540px] overflow-y-auto">
                {sources.length === 0 && (
                  <div className="p-8 text-center">
                    <p className="text-slate-400 text-xs">Nenhuma origem cadastrada.</p>
                  </div>
                )}
                {sources.map(s => (
                  <div
                    key={s.id}
                    className={`p-3 sm:px-4 flex items-center justify-between gap-3 transition ${
                      s.ativo ? 'hover:bg-slate-50/70' : 'bg-slate-50/40 opacity-60'
                    }`}
                  >
                    <div
                      onClick={() => openEditSource(s)}
                      className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer group"
                      title="Clique para editar esta origem"
                    >
                      <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-900 flex items-center justify-center shrink-0 border border-slate-200/80 group-hover:bg-slate-200 transition">
                        <Globe size={13} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className={`text-xs font-bold truncate ${s.ativo ? 'text-slate-900 group-hover:text-emerald-700' : 'text-slate-400 line-through'}`}>
                          {s.nome}
                        </h3>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => openEditSource(s)}
                        className="p-1 text-slate-300 hover:text-slate-600 transition rounded-lg hover:bg-slate-100 cursor-pointer"
                        title="Editar origem"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleSource(s.id, s.ativo)}
                        className={`transition cursor-pointer ${s.ativo ? 'text-emerald-600 hover:text-emerald-700' : 'text-slate-300 hover:text-slate-400'}`}
                        title={s.ativo ? 'Desativar origem' : 'Ativar origem'}
                      >
                        {s.ativo ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteSource(s.id)}
                        className="p-1 text-slate-300 hover:text-red-500 transition rounded-lg hover:bg-red-50 cursor-pointer"
                        title="Excluir origem"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Coluna 3: Segmentos de Leads */}
            <div
              className="bg-white rounded-xl border border-slate-200 shadow-card overflow-hidden flex flex-col relative min-h-[460px] animate-cascade-item"
              style={{ animationDelay: '160ms' }}
            >
              <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-900 flex items-center justify-center border border-slate-200/80 shadow-2xs">
                    <Tag size={16} />
                  </div>
                  <div>
                    <h2 className="text-slate-950 text-sm font-bold">Segmentos dos Leads</h2>
                    <p className="text-slate-500 text-xs">Classificação e nichos ({segments.length})</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={openNewSegment}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-2xs cursor-pointer shrink-0"
                >
                  <Plus size={13} /> Novo Segmento
                </button>
              </div>

              {/* Modal Contextual Centrado na Coluna 3 */}
              {showSegmentModal && (
                <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4 z-20 animate-fade-in">
                  <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-sm overflow-hidden animate-scale-in">
                    <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50/60">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-xl bg-slate-100 text-slate-900 flex items-center justify-center border border-slate-200/80">
                          {editingSegment ? <Pencil size={14} /> : <Tag size={14} />}
                        </div>
                        <h3 className="text-slate-900 text-sm font-bold">
                          {editingSegment ? 'Editar Segmento' : 'Novo Segmento'}
                        </h3>
                      </div>
                      <button
                        onClick={() => { setShowSegmentModal(false); setEditingSegment(null) }}
                        className="text-slate-400 hover:text-slate-600 transition cursor-pointer"
                      >
                        <X size={16} />
                      </button>
                    </div>
                    <form onSubmit={saveSegment} className="p-4.5 space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">Nome do Segmento / Nicho *</label>
                        <InputIcon icon={Tag}>
                          <input
                            autoFocus
                            value={newSegment}
                            onChange={e => { setSegmentError(''); setNewSegment(e.target.value) }}
                            placeholder="Ex: Varejo, B2B, Serviços..."
                            required
                            className={iconInputCls}
                          />
                        </InputIcon>
                        {segmentError && <p className="mt-1.5 text-xs font-medium text-red-600">{segmentError}</p>}
                      </div>
                      <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => { setShowSegmentModal(false); setEditingSegment(null) }}
                          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 transition cursor-pointer shadow-2xs select-none"
                        >
                          <X size={14} className="text-slate-400" />
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          disabled={savingSegment || !newSegment.trim() || !isSegmentDirty}
                          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200 disabled:cursor-not-allowed border border-emerald-700/50 text-white text-xs font-bold transition cursor-pointer shadow-2xs select-none"
                        >
                          {savingSegment ? <Loader2 size={13} className="animate-spin" /> : editingSegment ? <Check size={13} /> : <Plus size={13} />}
                          {savingSegment ? 'Salvando...' : editingSegment ? 'Salvar Alterações' : 'Criar Segmento'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* Lista de Segmentos */}
              <div className="divide-y divide-slate-100 max-h-[540px] overflow-y-auto">
                {segments.length === 0 && (
                  <div className="p-8 text-center">
                    <p className="text-slate-400 text-xs">Nenhum segmento cadastrado.</p>
                  </div>
                )}
                {segments.map(s => (
                  <div
                    key={s.id}
                    className={`p-3 sm:px-4 flex items-center justify-between gap-3 transition ${
                      s.ativo ? 'hover:bg-slate-50/70' : 'bg-slate-50/40 opacity-60'
                    }`}
                  >
                    <div
                      onClick={() => openEditSegment(s)}
                      className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer group"
                      title="Clique para editar este segmento"
                    >
                      <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-900 flex items-center justify-center shrink-0 border border-slate-200/80 group-hover:bg-slate-200 transition">
                        <Tag size={13} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className={`text-xs font-bold truncate ${s.ativo ? 'text-slate-900 group-hover:text-purple-700' : 'text-slate-400 line-through'}`}>
                          {s.nome}
                        </h3>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => openEditSegment(s)}
                        className="p-1 text-slate-300 hover:text-slate-600 transition rounded-lg hover:bg-slate-100 cursor-pointer"
                        title="Editar segmento"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleSegment(s.id, s.ativo)}
                        className={`transition cursor-pointer ${s.ativo ? 'text-emerald-600 hover:text-emerald-700' : 'text-slate-300 hover:text-slate-400'}`}
                        title={s.ativo ? 'Desativar segmento' : 'Ativar segmento'}
                      >
                        {s.ativo ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteSegment(s.id)}
                        className="p-1 text-slate-300 hover:text-red-500 transition rounded-lg hover:bg-red-50 cursor-pointer"
                        title="Excluir segmento"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* Tab 2: Minha Conta & Planos */}
        {activeTab === 'usuarios' && (
          isAdmin ? (
            /* Layout de conta: perfil e segurança à esquerda; plano e uso à direita. */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Lado Esquerdo: Meu Perfil & Segurança Unificados */}
              <div className="lg:col-span-5 bg-white p-6 rounded-xl border border-slate-200 shadow-card space-y-6">
                {/* Header do Perfil */}
                <div>
                  <div className="flex items-center justify-between gap-3 mb-5">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white font-black text-lg flex items-center justify-center shadow-sm">
                        {myNome.split(' ').filter(Boolean).slice(0, 2).map(n => n[0]).join('').toUpperCase() || 'U'}
                      </div>
                      <div>
                        <h2 className="text-slate-950 text-base font-bold">Meu Perfil</h2>
                        <p className="text-slate-500 text-xs">Identificação e dados de acesso</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-wider bg-brand-50 text-brand-800 border border-brand-200 px-2 py-0.5 rounded-md">
                      Sua Conta
                    </span>
                  </div>

                  <form onSubmit={handleSaveMyName} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">Nome Completo</label>
                      <InputIcon icon={User}>
                        <input
                          value={myNome}
                          onChange={e => setMyNome(e.target.value)}
                          placeholder="Seu nome completo"
                          required
                          className={iconInputCls}
                        />
                      </InputIcon>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">E-mail de Acesso</label>
                      <InputIcon icon={Mail}>
                        <input
                          value={myProfile?.email || ''}
                          disabled
                          className={`${iconInputCls} bg-slate-50 text-slate-500 cursor-not-allowed`}
                        />
                      </InputIcon>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">Departamento</span>
                        <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border ${departmentConfig(myProfile?.departamento).bg} w-full truncate`}>
                          <Building2 size={13} className="shrink-0" />
                          <span className="truncate">{departmentConfig(myProfile?.departamento).label.split(' / ')[0]}</span>
                        </span>
                      </div>
                      <div>
                        <span className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">Permissão</span>
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border w-full truncate bg-violet-50 text-violet-700 border-violet-200">
                          <Shield size={13} className="shrink-0" />
                          <span className="truncate">Administrador</span>
                        </span>
                      </div>
                    </div>

                    {myNameError && (
                      <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-600 text-xs flex items-center gap-2">
                        <AlertCircle size={14} className="shrink-0" />
                        {myNameError}
                      </div>
                    )}

                    <div className="pt-1 flex items-center gap-3">
                      <button
                        type="submit"
                        disabled={savingMyName || !myNome.trim() || myNome.trim() === myProfile?.nome}
                        className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200 disabled:cursor-not-allowed border border-emerald-700/50 text-white text-xs font-bold transition cursor-pointer shadow-2xs select-none"
                      >
                        {savingMyName ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        {savingMyName ? 'Salvando...' : 'Salvar Nome'}
                      </button>
                      {myNameSaved && (
                        <span className="text-emerald-700 text-xs font-bold bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 flex items-center gap-1.5 animate-fade-in">
                          <CheckCircle2 size={14} /> Atualizado!
                        </span>
                      )}
                    </div>
                  </form>
                </div>

                {/* Divisor & Seção de Senha Integrada */}
                <div className="pt-5 border-t border-slate-100">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-900 flex items-center justify-center border border-slate-200/80 shadow-2xs">
                      <KeyRound size={16} className="text-slate-900" />
                    </div>
                    <div>
                      <h3 className="text-slate-950 text-sm font-bold">Alterar Minha Senha</h3>
                      <p className="text-slate-500 text-xs">Exige confirmação da senha atual</p>
                    </div>
                  </div>

                  <form onSubmit={handleUpdatePassword} className="space-y-3.5">
                    {/* Senha Atual */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">Senha Atual *</label>
                      <div className="relative">
                        <InputIcon icon={Lock}>
                          <input
                            type={showSenhaAtual ? 'text' : 'password'}
                            value={senhaAtual}
                            onChange={e => setSenhaAtual(e.target.value)}
                            placeholder="Digite sua senha atual"
                            required
                            className={`${iconInputCls} pr-10`}
                          />
                        </InputIcon>
                        <button
                          type="button"
                          onClick={() => setShowSenhaAtual(!showSenhaAtual)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          {showSenhaAtual ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                    </div>

                    {/* Nova Senha */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">Nova Senha *</label>
                      <div className="relative">
                        <InputIcon icon={Lock}>
                          <input
                            type={showNovaSenha ? 'text' : 'password'}
                            value={novaSenha}
                            onChange={e => setNovaSenha(e.target.value)}
                            placeholder="Mínimo de 6 caracteres"
                            required
                            className={`${iconInputCls} pr-10`}
                          />
                        </InputIcon>
                        <button
                          type="button"
                          onClick={() => setShowNovaSenha(!showNovaSenha)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          {showNovaSenha ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                    </div>

                    {/* Confirmar Nova Senha */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">Confirmar Nova Senha *</label>
                      <div className="relative">
                        <InputIcon icon={Lock}>
                          <input
                            type={showConfirmarSenha ? 'text' : 'password'}
                            value={confirmarSenha}
                            onChange={e => setConfirmarSenha(e.target.value)}
                            placeholder="Repita a nova senha"
                            required
                            className={`${iconInputCls} pr-10`}
                          />
                        </InputIcon>
                        <button
                          type="button"
                          onClick={() => setShowConfirmarSenha(!showConfirmarSenha)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          {showConfirmarSenha ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                    </div>

                    {passwordError && (
                      <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-600 text-xs flex items-center gap-2">
                        <AlertCircle size={14} className="shrink-0" />
                        {passwordError}
                      </div>
                    )}

                    <div className="pt-1 flex items-center gap-3">
                      <button
                        type="submit"
                        disabled={savingPassword || !senhaAtual || !novaSenha || !confirmarSenha}
                        className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 active:bg-amber-800 disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200 disabled:cursor-not-allowed border border-amber-700/50 text-white text-xs font-bold transition cursor-pointer shadow-2xs select-none"
                      >
                        {savingPassword ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
                        {savingPassword ? 'Verificando...' : 'Alterar Senha'}
                      </button>
                      {passwordSaved && (
                        <span className="text-emerald-700 text-xs font-bold bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 flex items-center gap-1.5 animate-fade-in">
                          <CheckCircle2 size={14} /> Senha alterada!
                        </span>
                      )}
                    </div>
                  </form>
                </div>
              </div>

              {/* Lado Direito: plano e consumo da organização */}
              <div className="lg:col-span-7 space-y-4">

                <OrganizationIdentityCard
                  organization={org}
                  name={orgNome}
                  saving={savingMarca}
                  saved={marcaSaved}
                  error={orgError}
                  onNameChange={setOrgNome}
                  onSubmit={saveMarca}
                />

                {org && <SubscriptionSummaryCard organization={org} planName={planCfg.nome} statusLabel={planStatusCfg.label} statusClassName={planStatusBadgeClass} totalLeads={totalLeads} maxLeads={maxAllowedLeads} daysLeft={daysLeft} onManagePlan={() => setShowPlanModal(true)} />}

                <div className="hidden bg-white rounded-xl border border-slate-200 shadow-card overflow-visible">
                  <div className="px-6 py-4.5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center border border-brand-200/60 shadow-2xs">
                        <Users size={18} />
                      </div>
                      <div>
                        <h2 className="text-slate-950 text-base font-bold">Acesso individual por empresa</h2>
                        <p className="text-slate-500 text-xs">Gestão de colaboradores desativada.</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-600 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
                        {activeUsersCount} de {maxAllowedUsers} {maxAllowedUsers === 1 ? 'ativo' : 'ativos'}
                      </span>

                      <span className="text-[11px] text-slate-500 max-w-48 text-right">
                        Cada empresa utiliza uma conta própria. Novos acessos são criados pelo cadastro inicial.
                      </span>
                    </div>
                  </div>

                <div className="divide-y divide-slate-100 overflow-visible min-h-[140px]">
                  {profiles.map((p, idx) => {
                    const isMe = p.id === myUserId
                    const isPendingOrInactive = p.status !== 'ativo'

                    return (
                      <div
                        key={p.id}
                        className={`p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition animate-cascade-item relative ${
                          isPendingOrInactive ? 'bg-amber-50/40' : 'hover:bg-slate-50/70'
                        }`}
                        style={{ animationDelay: `${idx * 40}ms`, zIndex: profiles.length - idx }}
                      >
                        {/* Usuário info */}
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className={`w-10 h-10 rounded-xl text-white font-black text-xs flex items-center justify-center shadow-2xs shrink-0 ${
                            isPendingOrInactive
                              ? 'bg-gradient-to-br from-amber-400 to-amber-600'
                              : p.tipo_usuario === 'admin'
                              ? 'bg-gradient-to-br from-violet-500 to-purple-700'
                              : 'bg-gradient-to-br from-emerald-500 to-teal-700'
                          }`}>
                            {(p.nome || p.email || 'U').split(' ').filter(Boolean).slice(0, 2).map(n => n[0]).join('').toUpperCase()}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-slate-900 text-sm font-bold truncate">
                                {p.nome || 'Sem nome cadastrado'}
                              </span>
                              {isMe && (
                                <span className="text-[10px] font-black uppercase tracking-wider bg-brand-50 text-brand-800 border border-brand-200 px-2 py-0.5 rounded-md">
                                  Você
                                </span>
                              )}
                              {isPendingOrInactive && (
                                <span className="text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                                  <AlertCircle size={10} /> Aguardando Liberação
                                </span>
                              )}
                            </div>
                            <p className="text-slate-400 text-xs truncate">{p.email}</p>
                          </div>
                        </div>

                        {/* Ações e Controles: Departamento, Permissão e Liberação */}
                        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                          {/* Departamento */}
                          <div className="flex flex-col">
                            <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400 mb-0.5">
                              Depto
                            </span>
                            <div className="w-[125px]">
                              <CustomSelect
                                value={p.departamento || 'comercial'}
                                onChange={val => updateProfileDepartamento(p.id, val as DepartmentType)}
                                options={departmentOptions}
                                placeholder="Departamento"
                                align="right"
                                buttonClassName="w-full h-8 text-xs py-1"
                              />
                            </div>
                          </div>

                          {/* Cargo / Permissão */}
                          <div className="flex flex-col">
                            <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400 mb-0.5">
                              Cargo
                            </span>
                            <div className="w-[110px]">
                              <CustomSelect
                                value={p.tipo_usuario || 'atendente'}
                                onChange={val => updateProfileRole(p.id, val as 'admin' | 'atendente')}
                                options={roleOptions}
                                placeholder="Cargo"
                                disabled={isMe}
                                align="right"
                                buttonClassName="w-full h-8 text-xs py-1"
                              />
                            </div>
                          </div>

                          {/* Status / Botão de Liberação de Acesso */}
                          <div className="flex flex-col">
                            <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400 mb-0.5">
                              Acesso
                            </span>
                            {isPendingOrInactive ? (
                              <button
                                onClick={() => toggleProfileStatus(p.id, p.status || 'inativo')}
                                className="h-8 px-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1 shadow-2xs cursor-pointer animate-pulse"
                                title="Clique para liberar o acesso deste usuário"
                              >
                                <CheckCircle2 size={13} />
                                Liberar
                              </button>
                            ) : (
                              <div className="flex items-center gap-1.5 h-8">
                                <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-xl">
                                  <CheckCircle2 size={11} /> Ativo
                                </span>
                                {!isMe && (
                                  <>
                                    <button
                                      onClick={() => toggleProfileStatus(p.id, p.status || 'ativo')}
                                      className="text-slate-400 hover:text-amber-600 text-xs font-bold transition cursor-pointer px-1.5 py-1 rounded hover:bg-amber-50"
                                      title="Bloquear acesso temporariamente"
                                    >
                                      Bloquear
                                    </button>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
                </div>
              </div>
            </div>
          ) : (
            /* Layout para Usuário Comum (Não-Admin): 2 Colunas Balanceadas (Meu Perfil & Empresa à esquerda + Alterar Senha à direita) */
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              {/* Coluna 1: Meu Perfil & Identificação da Empresa */}
              <div className="space-y-6">
                {/* Card 1: Meu Perfil */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-card space-y-6 animate-cascade-item">
                  <div>
                    <div className="flex items-center justify-between gap-3 mb-5">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white font-black text-lg flex items-center justify-center shadow-sm">
                          {myNome.split(' ').filter(Boolean).slice(0, 2).map(n => n[0]).join('').toUpperCase() || 'U'}
                        </div>
                        <div>
                          <h2 className="text-slate-950 text-base font-bold">Meu Perfil</h2>
                          <p className="text-slate-500 text-xs">Identificação e dados de acesso</p>
                        </div>
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-wider bg-brand-50 text-brand-800 border border-brand-200 px-2 py-0.5 rounded-md">
                        Sua Conta
                      </span>
                    </div>

                    <form onSubmit={handleSaveMyName} className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">Nome Completo</label>
                        <InputIcon icon={User}>
                          <input
                            value={myNome}
                            onChange={e => setMyNome(e.target.value)}
                            placeholder="Seu nome completo"
                            required
                            className={iconInputCls}
                          />
                        </InputIcon>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">E-mail de Acesso</label>
                        <InputIcon icon={Mail}>
                          <input
                            value={myProfile?.email || ''}
                            disabled
                            className={`${iconInputCls} bg-slate-50 text-slate-500 cursor-not-allowed`}
                          />
                        </InputIcon>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <span className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">Departamento</span>
                          <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border ${departmentConfig(myProfile?.departamento).bg} w-full truncate`}>
                            <Building2 size={13} className="shrink-0" />
                            <span className="truncate">{departmentConfig(myProfile?.departamento).label.split(' / ')[0]}</span>
                          </span>
                        </div>
                        <div>
                          <span className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">Permissão</span>
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border w-full truncate bg-slate-100 text-slate-700 border-slate-200">
                            <Shield size={13} className="shrink-0" />
                            <span className="truncate">Atendente</span>
                          </span>
                        </div>
                      </div>

                      {myNameError && (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-600 text-xs flex items-center gap-2">
                          <AlertCircle size={14} className="shrink-0" />
                          {myNameError}
                        </div>
                      )}

                      <div className="pt-1 flex items-center gap-3">
                        <button
                          type="submit"
                          disabled={savingMyName || !myNome.trim() || myNome.trim() === myProfile?.nome}
                          className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200 disabled:cursor-not-allowed border border-emerald-700/50 text-white text-xs font-bold transition cursor-pointer shadow-2xs select-none"
                        >
                          {savingMyName ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                          {savingMyName ? 'Salvando...' : 'Salvar Nome'}
                        </button>
                        {myNameSaved && (
                          <span className="text-emerald-700 text-xs font-bold bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 flex items-center gap-1.5 animate-fade-in">
                            <CheckCircle2 size={14} /> Atualizado!
                          </span>
                        )}
                      </div>
                    </form>
                  </div>
                </div>

                <OrganizationIdentityCard
                  organization={org}
                  name={orgNome}
                  saving={savingMarca}
                  saved={marcaSaved}
                  error={orgError}
                  onNameChange={setOrgNome}
                  onSubmit={saveMarca}
                />

                {org && <SubscriptionSummaryCard organization={org} planName={planCfg.nome} statusLabel={planStatusCfg.label} statusClassName={planStatusBadgeClass} totalLeads={totalLeads} maxLeads={maxAllowedLeads} daysLeft={daysLeft} />}
              </div>

              {/* Coluna 2: Alterar Minha Senha */}
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-card animate-cascade-item" style={{ animationDelay: '120ms' }}>
                <div className="flex items-center gap-3 pb-4 border-b border-slate-100 mb-5">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-900 flex items-center justify-center border border-slate-200/80 shadow-2xs">
                    <KeyRound size={18} className="text-slate-900" />
                  </div>
                  <div>
                    <h3 className="text-slate-950 text-base font-bold">Alterar Minha Senha</h3>
                    <p className="text-slate-500 text-xs">Exige confirmação da senha atual</p>
                  </div>
                </div>

                <form onSubmit={handleUpdatePassword} className="space-y-4">
                  {/* Senha Atual */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Senha Atual *</label>
                    <div className="relative">
                      <InputIcon icon={Lock}>
                        <input
                          type={showSenhaAtual ? 'text' : 'password'}
                          value={senhaAtual}
                          onChange={e => setSenhaAtual(e.target.value)}
                          placeholder="Digite sua senha atual"
                          required
                          className={`${iconInputCls} pr-10`}
                        />
                      </InputIcon>
                      <button
                        type="button"
                        onClick={() => setShowSenhaAtual(!showSenhaAtual)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showSenhaAtual ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>

                  {/* Nova Senha */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Nova Senha *</label>
                    <div className="relative">
                      <InputIcon icon={Lock}>
                        <input
                          type={showNovaSenha ? 'text' : 'password'}
                          value={novaSenha}
                          onChange={e => setNovaSenha(e.target.value)}
                          placeholder="Mínimo de 6 caracteres"
                          required
                          className={`${iconInputCls} pr-10`}
                        />
                      </InputIcon>
                      <button
                        type="button"
                        onClick={() => setShowNovaSenha(!showNovaSenha)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showNovaSenha ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>

                  {/* Confirmar Nova Senha */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Confirmar Nova Senha *</label>
                    <div className="relative">
                      <InputIcon icon={Lock}>
                        <input
                          type={showConfirmarSenha ? 'text' : 'password'}
                          value={confirmarSenha}
                          onChange={e => setConfirmarSenha(e.target.value)}
                          placeholder="Repita a nova senha"
                          required
                          className={`${iconInputCls} pr-10`}
                        />
                      </InputIcon>
                      <button
                        type="button"
                        onClick={() => setShowConfirmarSenha(!showConfirmarSenha)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showConfirmarSenha ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>

                  {passwordError && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-600 text-xs flex items-center gap-2">
                      <AlertCircle size={14} className="shrink-0" />
                      {passwordError}
                    </div>
                  )}

                  <div className="pt-2 flex items-center gap-3">
                    <button
                      type="submit"
                      disabled={savingPassword || !senhaAtual || !novaSenha || !confirmarSenha}
                      className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 active:bg-amber-800 disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200 disabled:cursor-not-allowed border border-amber-700/50 text-white text-xs font-bold transition cursor-pointer shadow-2xs select-none"
                    >
                      {savingPassword ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
                      {savingPassword ? 'Verificando...' : 'Alterar Senha'}
                    </button>
                    {passwordSaved && (
                      <span className="text-emerald-700 text-xs font-bold bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 flex items-center gap-1.5 animate-fade-in">
                        <CheckCircle2 size={14} /> Senha alterada!
                      </span>
                    )}
                  </div>
                </form>
              </div>
            </div>
          )
        )}

        {/* Tab 3: Empresa */}
        {activeTab === 'empresa' && (
          <div className="max-w-2xl space-y-6">
            {orgError && (
              <div className="bg-red-50 border border-red-100 rounded-lg px-3.5 py-2.5 mb-4">
                <p className="text-red-600 text-sm">{orgError}</p>
              </div>
            )}

            {/* Card 1: Identificação da Empresa */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-card overflow-hidden">
              <div className="px-6 py-4.5 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-900 flex items-center justify-center border border-slate-200/80 shadow-2xs">
                  <Building2 size={18} className="text-slate-900" />
                </div>
                <div>
                  <h2 className="text-slate-950 text-base font-bold">Identificação da Empresa</h2>
                  <p className="text-slate-500 text-xs">Nome exibido no CRM e nas comunicações</p>
                </div>
              </div>
              <form onSubmit={saveMarca} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Nome da Empresa</label>
                  <InputIcon icon={Building2}>
                    <input
                      value={orgNome}
                      onChange={e => setOrgNome(e.target.value)}
                      placeholder={org?.nome || 'Ex: Immovi Contabilidade'}
                      className={iconInputCls}
                    />
                  </InputIcon>
                  <p className="text-[11px] text-slate-400 mt-1.5">
                    Aparece no CRM e nas comunicações da empresa.
                  </p>
                </div>

                <div className="pt-2 flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={savingMarca || !orgNome.trim() || orgNome.trim() === (org?.nome_exibicao ?? org?.nome ?? '').trim()}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200 disabled:cursor-not-allowed border border-emerald-700/50 text-white text-xs font-bold transition shadow-2xs cursor-pointer select-none"
                  >
                    {savingMarca ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    {savingMarca ? 'Salvando...' : 'Salvar Alterações'}
                  </button>
                  {marcaSaved && (
                    <span className="text-emerald-700 text-xs font-bold bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 flex items-center gap-1.5 animate-fade-in">
                      <CheckCircle2 size={14} /> Salvo com sucesso!
                    </span>
                  )}
                </div>
              </form>
            </div>

          </div>
        )}

      </div>

      {/* Modal: Gerenciar Plano & Assinatura (Exclusivo Super Admin) */}
      {org && (myProfile as any)?.is_super_admin && (
        <PlanManagementModal
          organization={org}
          open={showPlanModal}
          onClose={() => setShowPlanModal(false)}
          onSaved={updatedOrg => setOrg(updatedOrg)}
        />
      )}

      {/* Modal: Aviso de Limite de Usuários Atingido */}
      {planLimitWarning && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-sm overflow-hidden animate-scale-in">
            <div className="px-6 py-5 border-b border-slate-100 bg-amber-50/60 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 border border-amber-200">
                <AlertCircle size={18} />
              </div>
              <div>
                <h2 className="text-slate-950 text-sm font-bold">{planLimitWarning.title}</h2>
                <p className="text-slate-500 text-[11px]">Ação bloqueada pelas cotas do plano</p>
              </div>
            </div>
            <div className="p-6">
              <p className="text-slate-600 text-xs leading-relaxed">{planLimitWarning.message}</p>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50/50">
              <button
                type="button"
                onClick={() => setPlanLimitWarning(null)}
                className="px-4 py-2 rounded-lg text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 transition cursor-pointer shadow-2xs select-none"
              >
                Entendido
              </button>
              <button
                type="button"
                onClick={() => {
                  setPlanLimitWarning(null)
                  setShowPlanModal(true)
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-2xs cursor-pointer select-none"
              >
                <Zap size={13} />
                Gerenciar Plano
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Excluir status */}
      {confirmDeleteStatus && (
        <ConfirmModal
          title="Excluir status"
          description={<>Tem certeza que deseja excluir <span className="font-medium text-slate-700">{confirmDeleteStatus.label}</span>? Esta ação não pode ser desfeita.</>}
          error={statusDeleteError}
          loading={deletingStatus}
          onCancel={() => { setConfirmDeleteStatus(null); setStatusDeleteError(null) }}
          onConfirm={() => deleteStatus(confirmDeleteStatus)}
        />
      )}

      {/* Modal: Excluir origem */}
      {confirmDeleteSource && (
        <ConfirmModal
          title="Excluir origem"
          description={<>Tem certeza que deseja excluir <span className="font-medium text-slate-700">{sources.find(s => s.id === confirmDeleteSource)?.nome}</span>? Esta ação não pode ser desfeita.</>}
          loading={deletingSource}
          onCancel={() => setConfirmDeleteSource(null)}
          onConfirm={() => deleteSource(confirmDeleteSource)}
        />
      )}

      {/* Modal: Excluir segmento */}
      {confirmDeleteSegment && (
        <ConfirmModal
          title="Excluir segmento"
          description={<>Tem certeza que deseja excluir <span className="font-medium text-slate-700">{segments.find(s => s.id === confirmDeleteSegment)?.nome}</span>? Esta ação não pode ser desfeita.</>}
          loading={deletingSegment}
          onCancel={() => setConfirmDeleteSegment(null)}
          onConfirm={() => deleteSegment(confirmDeleteSegment)}
        />
      )}

    </Layout>
  )
}
