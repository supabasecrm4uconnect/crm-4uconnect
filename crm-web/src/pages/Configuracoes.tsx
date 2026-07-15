import { useEffect, useState } from 'react'
import { Plus, Loader2, ToggleLeft, ToggleRight, X, Trash2, UserCog, GitBranch, Globe, Tag, Users, Building2, Upload, Image as ImageIcon } from 'lucide-react'
import { InputIcon, iconInputCls } from '../components/FieldIcon'
import Layout from '../components/Layout'
import ConfirmModal from '../components/ConfirmModal'
import { supabase } from '../lib/supabase'
import { useStatuses, COLOR_PRESETS, type StatusConfig } from '../contexts/StatusesContext'
import { useBranding } from '../contexts/BrandingContext'
import type { LeadSource, LeadSegment, Profile, Organization } from '../types'


type Tab = 'pipeline' | 'origens' | 'segmentos' | 'usuarios' | 'empresa'

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'pipeline',  label: 'Pipeline',   icon: GitBranch },
  { id: 'origens',   label: 'Origens',    icon: Globe     },
  { id: 'segmentos', label: 'Segmentos',  icon: Tag       },
  { id: 'usuarios',  label: 'Usuários',   icon: Users     },
  { id: 'empresa',   label: 'Empresa',    icon: Building2 },
]

export default function Configuracoes() {
  const { statuses, refresh: refreshStatuses, updateOne: updateStatus } = useStatuses()
  const { refresh: refreshBranding } = useBranding()
  const [sources,  setSources]  = useState<LeadSource[]>([])
  const [segments, setSegments] = useState<LeadSegment[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading,  setLoading]  = useState(true)
  const [myUserId, setMyUserId] = useState<string | null>(null)
  const [myOrgId,  setMyOrgId]  = useState<string | null>(null)
  const [isAdmin,  setIsAdmin]  = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('pipeline')

  const [newSource,      setNewSource]      = useState('')
  const [savingSource,   setSavingSource]   = useState(false)
  const [newSegment,     setNewSegment]     = useState('')
  const [savingSegment,  setSavingSegment]  = useState(false)

  const [confirmDeleteSource,  setConfirmDeleteSource]  = useState<string | null>(null)
  const [deletingSource,       setDeletingSource]       = useState(false)
  const [confirmDeleteSegment, setConfirmDeleteSegment] = useState<string | null>(null)
  const [deletingSegment,      setDeletingSegment]      = useState(false)

  // Status
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [statusForm,      setStatusForm]      = useState({ label: '', preset: 0 })
  const [savingStatus,    setSavingStatus]    = useState(false)
  const [editingStatus,   setEditingStatus]   = useState<StatusConfig | null>(null)
  const [editLabel,       setEditLabel]       = useState('')
  const [confirmDeleteStatus, setConfirmDeleteStatus] = useState<StatusConfig | null>(null)
  const [deletingStatus,      setDeletingStatus]      = useState(false)
  const [statusDeleteError,   setStatusDeleteError]   = useState<string | null>(null)

  // Empresa / Marca
  const [org,            setOrg]            = useState<Organization | null>(null)
  const [orgNome,        setOrgNome]        = useState('')
  const [savingMarca,    setSavingMarca]    = useState(false)
  const [marcaSaved,     setMarcaSaved]     = useState(false)
  const [uploadingLogo,  setUploadingLogo]  = useState(false)
  const [orgError,       setOrgError]       = useState('')
  const [confirmRemoveLogo, setConfirmRemoveLogo] = useState(false)
  const [removingLogo,      setRemovingLogo]      = useState(false)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const [sourcesRes, segmentsRes, profilesRes, myProfileRes] = await Promise.all([
      supabase.from('lead_sources').select('*').order('nome'),
      supabase.from('lead_segments').select('*').order('nome'),
      supabase.from('profiles').select('id, nome, email, tipo_usuario, status, organization_id, created_at, updated_at').order('nome'),
      user ? supabase.from('profiles').select('tipo_usuario, organization_id').eq('id', user.id).single() : Promise.resolve({ data: null }),
    ])
    setSources(sourcesRes.data   ?? [])
    setSegments(segmentsRes.data ?? [])
    setProfiles((profilesRes.data ?? []) as Profile[])
    if (user) setMyUserId(user.id)
    if (myProfileRes.data) {
      const mp = myProfileRes.data as { tipo_usuario: string; organization_id: string }
      setIsAdmin(mp.tipo_usuario === 'admin')
      setMyOrgId(mp.organization_id)
      if (mp.organization_id) {
        const { data: orgData } = await supabase
          .from('organizations')
          .select('id, nome, nome_exibicao, logo_url, created_at')
          .eq('id', mp.organization_id).single()
        if (orgData) {
          const o = orgData as Organization
          setOrg(o)
          setOrgNome(o.nome_exibicao ?? '')
        }
      }
    }
    setLoading(false)
  }

  // --- Empresa / Marca ---
  async function saveMarca(e: React.FormEvent) {
    e.preventDefault()
    if (!myOrgId) return
    setSavingMarca(true)
    setMarcaSaved(false)
    setOrgError('')
    const { error } = await supabase.from('organizations').update({
      nome_exibicao: orgNome.trim() || null,
    }).eq('id', myOrgId)
    setSavingMarca(false)
    if (error) { setOrgError('Não foi possível salvar a marca. Tente novamente.'); return }
    setMarcaSaved(true)
    await refreshBranding()
    setTimeout(() => setMarcaSaved(false), 2500)
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !myOrgId) return
    setUploadingLogo(true)
    setOrgError('')
    const ext = (file.name.split('.').pop() || 'png').toLowerCase()
    const path = `${myOrgId}/logo_${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage.from('org-logos').upload(path, file, { upsert: true })
    if (upErr) { setUploadingLogo(false); e.target.value = ''; setOrgError('Falha ao enviar o logo.'); return }
    const { data: pub } = supabase.storage.from('org-logos').getPublicUrl(path)
    const { error: updErr } = await supabase.from('organizations').update({ logo_url: pub.publicUrl }).eq('id', myOrgId)
    if (updErr) { setUploadingLogo(false); e.target.value = ''; setOrgError('Logo enviado, mas falha ao salvar. Tente novamente.'); return }
    setOrg(prev => prev ? { ...prev, logo_url: pub.publicUrl } : prev)
    await refreshBranding()
    setUploadingLogo(false)
    e.target.value = ''
  }

  async function removeLogo() {
    if (!myOrgId) return
    setRemovingLogo(true)
    setOrgError('')
    const { error } = await supabase.from('organizations').update({ logo_url: null }).eq('id', myOrgId)
    setRemovingLogo(false)
    if (error) { setOrgError('Não foi possível remover o logo.'); return }
    setOrg(prev => prev ? { ...prev, logo_url: null } : prev)
    await refreshBranding()
    setConfirmRemoveLogo(false)
  }

  // --- Sources ---
  async function addSource(e: React.FormEvent) {
    e.preventDefault()
    if (!newSource.trim()) return
    setSavingSource(true)
    await supabase.from('lead_sources').insert({ nome: newSource.trim(), organization_id: myOrgId })
    setNewSource('')
    setSavingSource(false)
    loadAll()
  }

  async function toggleSource(id: string, ativo: boolean) {
    setSources(prev => prev.map(s => s.id === id ? { ...s, ativo: !ativo } : s))
    await supabase.from('lead_sources').update({ ativo: !ativo }).eq('id', id)
  }

  async function deleteSource(id: string) {
    setDeletingSource(true)
    await supabase.from('lead_sources').delete().eq('id', id)
    setDeletingSource(false)
    setConfirmDeleteSource(null)
    loadAll()
  }

  // --- Segments ---
  async function addSegment(e: React.FormEvent) {
    e.preventDefault()
    if (!newSegment.trim()) return
    setSavingSegment(true)
    await supabase.from('lead_segments').insert({ nome: newSegment.trim(), organization_id: myOrgId })
    setNewSegment('')
    setSavingSegment(false)
    loadAll()
  }

  async function toggleSegment(id: string, ativo: boolean) {
    setSegments(prev => prev.map(s => s.id === id ? { ...s, ativo: !ativo } : s))
    await supabase.from('lead_segments').update({ ativo: !ativo }).eq('id', id)
  }

  async function deleteSegment(id: string) {
    setDeletingSegment(true)
    await supabase.from('lead_segments').delete().eq('id', id)
    setDeletingSegment(false)
    setConfirmDeleteSegment(null)
    loadAll()
  }

  // --- Status ---
  async function addStatus(e: React.FormEvent) {
    e.preventDefault()
    if (!statusForm.label.trim()) return
    setSavingStatus(true)
    const preset = COLOR_PRESETS[statusForm.preset]
    const value = statusForm.label.trim()
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '')
    const maxOrdem = statuses.length > 0 ? Math.max(...statuses.map(s => s.ordem)) + 1 : 0
    await supabase.from('lead_statuses').insert({
      value, label: statusForm.label.trim(),
      color_text: preset.color_text, color_bg: preset.color_bg, color_dot: preset.color_dot,
      ordem: maxOrdem,
      organization_id: myOrgId,
    })
    await refreshStatuses()
    setStatusForm({ label: '', preset: 0 })
    setSavingStatus(false)
    setShowStatusModal(false)
  }

  async function toggleStatus(id: string, ativo: boolean) {
    updateStatus(id, { ativo: !ativo })
    await supabase.from('lead_statuses').update({ ativo: !ativo }).eq('id', id)
  }

  async function saveEditLabel() {
    if (!editingStatus || !editLabel.trim()) return
    await supabase.from('lead_statuses').update({ label: editLabel.trim() }).eq('id', editingStatus.id)
    await refreshStatuses()
    setEditingStatus(null)
  }

  async function deleteStatus(status: StatusConfig) {
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

  // --- Users ---
  async function toggleProfileStatus(id: string, status: string) {
    const newStatus = status === 'ativo' ? 'inativo' : 'ativo'
    setProfiles(prev => prev.map(p => p.id === id ? { ...p, status: newStatus } : p))
    await supabase.from('profiles').update({ status: newStatus }).eq('id', id)
  }

  if (loading) {
    return (
      <Layout>
        <div className="px-8 py-8 max-w-3xl">
          <div className="mb-6">
            <h1 className="text-slate-900 text-xl font-semibold">Configurações</h1>
            <p className="text-slate-500 text-sm mt-0.5">Gerencie origens, segmentos, status do pipeline e usuários</p>
          </div>
          <div className="flex gap-1 bg-slate-100 p-1 rounded-xl mb-6 animate-pulse">
            {TABS.map(({ id }) => <div key={id} className="flex-1 h-9 rounded-lg" />)}
          </div>
          <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 animate-pulse">
              <div className="h-4 w-40 bg-slate-100 rounded mb-2" />
              <div className="h-3 w-64 bg-slate-100 rounded" />
            </div>
            <div className="px-6 py-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between py-1 animate-pulse">
                  <div className="flex items-center gap-2.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-slate-100" />
                    <div className="h-3.5 w-32 bg-slate-100 rounded" />
                  </div>
                  <div className="h-5 w-9 bg-slate-100 rounded-full" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="px-8 py-8 max-w-3xl animate-fade-in">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-slate-900 text-xl font-semibold">Configurações</h1>
          <p className="text-slate-500 text-sm mt-0.5">Gerencie origens, segmentos, status do pipeline e usuários</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl mb-6">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === id
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        {/* Tab: Pipeline */}
        {activeTab === 'pipeline' && (
          <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="text-slate-900 text-sm font-semibold">Status do pipeline</h2>
              <p className="text-slate-400 text-xs mt-0.5">Cada status corresponde a uma etapa no funil de leads</p>
            </div>
            <div className="px-6 py-4">
              <div className="space-y-1 mb-4">
                {statuses.length === 0 && <p className="text-slate-400 text-sm">Nenhum status cadastrado.</p>}
                {statuses.map(s => (
                  <div key={s.id} className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color_dot }} />
                      {editingStatus?.id === s.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            autoFocus
                            value={editLabel}
                            onChange={e => setEditLabel(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') saveEditLabel(); if (e.key === 'Escape') setEditingStatus(null) }}
                            className="px-2 py-1 rounded border border-emerald-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                          <button onClick={saveEditLabel} className="text-xs text-emerald-600 hover:text-emerald-700 font-medium">Salvar</button>
                          <button onClick={() => setEditingStatus(null)} className="text-xs text-slate-400 hover:text-slate-600">Cancelar</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setEditingStatus(s); setEditLabel(s.label) }}
                          className={`text-sm text-left hover:underline ${s.ativo ? 'text-slate-800' : 'text-slate-400 line-through'}`}
                          title="Clique para editar o nome"
                        >
                          {s.label}
                        </button>
                      )}
                      <span className="text-xs text-slate-400 font-mono hidden sm:block">{s.value}</span>
                    </div>
                    <div className="flex items-center gap-1 ml-3 shrink-0">
                      <button
                        onClick={() => toggleStatus(s.id, s.ativo)}
                        className={`transition ${s.ativo ? 'text-emerald-500 hover:text-emerald-600' : 'text-slate-300 hover:text-slate-400'}`}
                        title={s.ativo ? 'Desativar coluna' : 'Ativar coluna'}
                      >
                        {s.ativo ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                      </button>
                      <button
                        onClick={() => { setStatusDeleteError(null); setConfirmDeleteStatus(s) }}
                        className="p-1 text-slate-300 hover:text-red-500 transition rounded"
                        title="Excluir status"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setShowStatusModal(true)}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium transition"
              >
                <Plus size={14} /> Novo status
              </button>
            </div>
          </div>
        )}

        {/* Tab: Origens */}
        {activeTab === 'origens' && (
          <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="text-slate-900 text-sm font-semibold">Origens dos leads</h2>
              <p className="text-slate-400 text-xs mt-0.5">De onde vêm seus leads: redes sociais, indicação, site, etc.</p>
            </div>
            <div className="px-6 py-4">
              <div className="space-y-1 mb-4">
                {sources.length === 0 && <p className="text-slate-400 text-sm">Nenhuma origem cadastrada.</p>}
                {sources.map(s => (
                  <div key={s.id} className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0">
                    <span className={`text-sm ${s.ativo ? 'text-slate-800' : 'text-slate-400 line-through'}`}>{s.nome}</span>
                    <div className="flex items-center gap-1">
                      <button onClick={() => toggleSource(s.id, s.ativo)} className={`transition ${s.ativo ? 'text-emerald-500 hover:text-emerald-600' : 'text-slate-300 hover:text-slate-400'}`} title={s.ativo ? 'Desativar' : 'Ativar'}>
                        {s.ativo ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                      </button>
                      <button onClick={() => setConfirmDeleteSource(s.id)} className="p-1 text-slate-300 hover:text-red-500 transition rounded" title="Excluir origem">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <form onSubmit={addSource} className="flex gap-2">
                <InputIcon icon={Globe} className="flex-1">
                  <input value={newSource} onChange={e => setNewSource(e.target.value)} placeholder="Nova origem..." className={iconInputCls} />
                </InputIcon>
                <button type="submit" disabled={savingSource || !newSource.trim()} className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300 text-white text-sm font-medium transition shrink-0">
                  {savingSource ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  Adicionar
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Tab: Segmentos */}
        {activeTab === 'segmentos' && (
          <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="text-slate-900 text-sm font-semibold">Segmentos</h2>
              <p className="text-slate-400 text-xs mt-0.5">Categorize seus leads por tipo de mercado ou produto</p>
            </div>
            <div className="px-6 py-4">
              <div className="space-y-1 mb-4">
                {segments.length === 0 && <p className="text-slate-400 text-sm">Nenhum segmento cadastrado.</p>}
                {segments.map(s => (
                  <div key={s.id} className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0">
                    <span className={`text-sm ${s.ativo ? 'text-slate-800' : 'text-slate-400 line-through'}`}>{s.nome}</span>
                    <div className="flex items-center gap-1">
                      <button onClick={() => toggleSegment(s.id, s.ativo)} className={`transition ${s.ativo ? 'text-emerald-500 hover:text-emerald-600' : 'text-slate-300 hover:text-slate-400'}`} title={s.ativo ? 'Desativar' : 'Ativar'}>
                        {s.ativo ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                      </button>
                      <button onClick={() => setConfirmDeleteSegment(s.id)} className="p-1 text-slate-300 hover:text-red-500 transition rounded" title="Excluir segmento">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <form onSubmit={addSegment} className="flex gap-2">
                <InputIcon icon={Tag} className="flex-1">
                  <input value={newSegment} onChange={e => setNewSegment(e.target.value)} placeholder="Novo segmento..." className={iconInputCls} />
                </InputIcon>
                <button type="submit" disabled={savingSegment || !newSegment.trim()} className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300 text-white text-sm font-medium transition shrink-0">
                  {savingSegment ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  Adicionar
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Tab: Usuários */}
        {activeTab === 'usuarios' && (
          <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="text-slate-900 text-sm font-semibold">Usuários</h2>
              <p className="text-slate-400 text-xs mt-0.5">Atendentes e administradores com acesso ao CRM</p>
            </div>
            <div className="px-6 py-4">
              <div className="space-y-1 mb-5">
                {profiles.length === 0 && <p className="text-slate-400 text-sm">Nenhum usuário cadastrado.</p>}
                {profiles.map(p => {
                  const ativo = p.status === 'ativo'
                  return (
                    <div key={p.id} className="flex items-center justify-between py-3 border-b border-slate-50 last:border-0">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${ativo ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                          <span className={`text-xs font-semibold ${ativo ? 'text-emerald-700' : 'text-slate-500'}`}>
                            {p.nome.split(' ').filter(Boolean).slice(0, 2).map((n: string) => n[0]).join('').toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className={`text-sm font-medium truncate ${ativo ? 'text-slate-800' : 'text-slate-400'}`}>{p.nome}</p>
                          <p className="text-xs text-slate-400 truncate">{p.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.tipo_usuario === 'admin' ? 'bg-violet-50 text-violet-700' : 'bg-slate-100 text-slate-600'}`}>
                          {p.tipo_usuario === 'admin' ? 'Admin' : 'Atendente'}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ativo ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                          {ativo ? 'Liberado' : 'Aguardando'}
                        </span>
                        {isAdmin && p.id !== myUserId && (
                          <button
                            onClick={() => toggleProfileStatus(p.id, p.status)}
                            className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg font-medium transition ${ativo ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-emerald-500 text-white hover:bg-emerald-600'}`}
                            title={ativo ? 'Bloquear acesso ao CRM' : 'Liberar acesso ao CRM'}
                          >
                            {ativo ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                            {ativo ? 'Bloquear' : 'Liberar'}
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="flex items-start gap-3 bg-slate-50 rounded-xl px-4 py-3.5">
                <UserCog size={16} className="text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-slate-700 text-xs font-medium">Como adicionar novos atendentes?</p>
                  <p className="text-slate-400 text-xs mt-0.5 leading-relaxed">
                    O atendente deve se cadastrar pela tela de login usando o botão <strong className="text-slate-500">"Criar conta"</strong>.
                    A conta nasce <strong className="text-slate-500">bloqueada</strong> e aparece aqui como "Aguardando" — então o admin
                    clica em <strong className="text-slate-500">"Liberar"</strong> para dar acesso ao CRM.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab: Empresa / Marca */}
        {activeTab === 'empresa' && orgError && (
          <div className="bg-red-50 border border-red-100 rounded-lg px-3.5 py-2.5 mb-4">
            <p className="text-red-600 text-sm">{orgError}</p>
          </div>
        )}
        {activeTab === 'empresa' && (
          <div className="space-y-6">
            {/* Marca */}
            <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100">
                <h2 className="text-slate-900 text-sm font-semibold">Marca da empresa</h2>
                <p className="text-slate-400 text-xs mt-0.5">Nome e logo exibidos no CRM para esta organização</p>
              </div>
              <form onSubmit={saveMarca} className="px-6 py-5 space-y-5">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Nome de exibição</label>
                  <InputIcon icon={Building2}>
                    <input
                      value={orgNome}
                      onChange={e => setOrgNome(e.target.value)}
                      placeholder={org?.nome || 'Ex: Immovi Contabilidade'}
                      className={iconInputCls}
                    />
                  </InputIcon>
                  <p className="text-xs text-slate-400 mt-1">Aparece na barra lateral e no título da aba. Vazio = usa o nome interno ({org?.nome}).</p>
                  <div className="flex items-center gap-3 mt-3">
                    <button type="submit" disabled={savingMarca} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300 text-white text-sm font-medium transition">
                      {savingMarca && <Loader2 size={14} className="animate-spin" />}
                      {savingMarca ? 'Salvando...' : 'Salvar nome'}
                    </button>
                    {marcaSaved && <span className="text-emerald-600 text-sm font-medium">Salvo!</span>}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Logo</label>
                  <div className="flex items-center gap-4">
                    <div className="w-28 h-20 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
                      {org?.logo_url
                        ? <img src={org.logo_url} alt="Logo" className="w-full h-full object-cover" />
                        : <ImageIcon size={22} className="text-slate-300" />}
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition cursor-pointer w-fit">
                        {uploadingLogo ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                        {uploadingLogo ? 'Enviando...' : 'Enviar logo'}
                        <input type="file" accept="image/*" onChange={handleLogoUpload} disabled={uploadingLogo} className="hidden" />
                      </label>
                      {org?.logo_url && (
                        <button type="button" onClick={() => setConfirmRemoveLogo(true)} className="text-xs text-slate-400 hover:text-red-500 transition w-fit">Remover logo</button>
                      )}
                      <p className="text-xs text-slate-400">PNG ou JPG, fundo transparente de preferência.</p>
                    </div>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>

      {/* Modal: Novo status */}
      {showStatusModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
              <h2 className="text-slate-900 text-base font-semibold">Novo status</h2>
              <button onClick={() => setShowStatusModal(false)} className="text-slate-400 hover:text-slate-600 transition"><X size={18} /></button>
            </div>
            <form onSubmit={addStatus} className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Nome do status *</label>
                <InputIcon icon={Tag}>
                <input
                  autoFocus
                  value={statusForm.label}
                  onChange={e => setStatusForm(f => ({ ...f, label: e.target.value }))}
                  placeholder="Ex: Negociação, Em proposta..."
                  required
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-lg border border-slate-200 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
                />
                </InputIcon>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Cor</label>
                <div className="flex flex-wrap gap-2">
                  {COLOR_PRESETS.map((preset, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setStatusForm(f => ({ ...f, preset: i }))}
                      title={preset.name}
                      className={`w-7 h-7 rounded-full transition ring-offset-2 ${statusForm.preset === i ? 'ring-2 ring-emerald-500 scale-110' : 'hover:scale-105'}`}
                      style={{ background: preset.color_dot }}
                    />
                  ))}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <span
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                    style={{ color: COLOR_PRESETS[statusForm.preset].color_text, background: COLOR_PRESETS[statusForm.preset].color_bg }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: COLOR_PRESETS[statusForm.preset].color_dot }} />
                    {statusForm.label || 'Prévia'}
                  </span>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-1">
                <button type="button" onClick={() => setShowStatusModal(false)} className="px-4 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition">Cancelar</button>
                <button type="submit" disabled={savingStatus || !statusForm.label.trim()} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300 text-white text-sm font-medium transition">
                  {savingStatus && <Loader2 size={14} className="animate-spin" />}
                  {savingStatus ? 'Salvando...' : 'Criar status'}
                </button>
              </div>
            </form>
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

      {/* Modal: Remover logo */}
      {confirmRemoveLogo && (
        <ConfirmModal
          title="Remover logo"
          description="Tem certeza que deseja remover o logo da empresa?"
          confirmLabel="Remover"
          confirmingLabel="Removendo..."
          loading={removingLogo}
          onCancel={() => setConfirmRemoveLogo(false)}
          onConfirm={removeLogo}
        />
      )}
    </Layout>
  )
}
