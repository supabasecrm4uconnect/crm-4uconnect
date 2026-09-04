import { useEffect, useState, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Plus, Search, ChevronRight, Loader2, X, LayoutList, Kanban,
  CalendarDays, Download, Upload, MoreVertical, User,
  Phone, Flag, Globe, Tag, Tags, DollarSign, FileText
} from 'lucide-react'
import Layout from '../components/Layout'
import StatusBadge from '../components/StatusBadge'
import PipelineBoard from '../components/pipeline/PipelineBoard'
import LeadDrawer from '../components/LeadDrawer'
import ImportLeadsModal from '../components/ImportLeadsModal'
import PipelineSkeleton from '../components/skeletons/PipelineSkeleton'
import LeadTableSkeleton from '../components/skeletons/LeadTableSkeleton'
import CustomSelect from '../components/CustomSelect'
import CustomDateRangePicker from '../components/CustomDateRangePicker'
import { useLeadsRealtime } from '../hooks/useLeadsRealtime'
import { supabase } from '../lib/supabase'
import { exportLeadsToXlsx } from '../lib/exportLeads'
import {
  formatWhatsApp, normalizeWhatsApp, formatCurrency, parseCurrency, phoneVariants,
  whatsappLink, localDateStr, formatDateTime
} from '../lib/helpers'
import { useStatuses } from '../contexts/StatusesContext'
import LeadAvatar from '../components/LeadAvatar'
import WhatsAppIcon from '../components/WhatsAppIcon'
import { InputIcon, TextareaIcon, iconInputCls, iconTextareaCls } from '../components/FieldIcon'
import type { LeadWithRelations, LeadSource, LeadSegment, LeadStatus } from '../types'

type ViewMode = 'list' | 'pipeline'

const labelCls = 'block text-sm font-medium text-slate-700 mb-1.5'

export default function Leads() {
  const { statuses: allStatuses, getConfig: getStatusConfig, loading: loadingStatuses } = useStatuses()
  const [searchParams, setSearchParams] = useSearchParams()
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(
    () => searchParams.get('lead')
  )

  useEffect(() => {
    setSelectedLeadId(searchParams.get('lead'))
  }, [searchParams])

  function closeDrawer() {
    setSelectedLeadId(null)
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      next.delete('lead')
      return next
    }, { replace: true })
  }

  const [leads, setLeads] = useState<LeadWithRelations[]>([])
  const [sources, setSources] = useState<LeadSource[]>([])
  const [segments, setSegments] = useState<LeadSegment[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (searchParams.get('status')) return 'list'
    return (localStorage.getItem('crm_leads_view') as ViewMode) ?? 'list'
  })

  function switchView(mode: ViewMode) {
    setViewMode(mode)
    localStorage.setItem('crm_leads_view', mode)
    setSelectedIds(new Set())
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id); else n.add(id)
      return n
    })
  }

  // Menu de Ações (3 pontos)
  const [showActionsMenu, setShowActionsMenu] = useState(false)
  const actionsMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!showActionsMenu) return
    function handleOutside(e: MouseEvent) {
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(e.target as Node)) {
        setShowActionsMenu(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [showActionsMenu])

  const [filterTags, setFilterTags] = useState<string[]>([])
  const [showTagsMenu, setShowTagsMenu] = useState(false)
  const tagsMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!showTagsMenu) return
    function handleOutside(e: MouseEvent) {
      if (tagsMenuRef.current && !tagsMenuRef.current.contains(e.target as Node)) {
        setShowTagsMenu(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [showTagsMenu])

  function toggleFilterTag(tag: string) {
    setFilterTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])
  }

  // Filtros
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>(() => searchParams.get('status') ?? '')
  const [filterOrigem, setFilterOrigem] = useState<string>('')
  const [filterSegmento, setFilterSegmento] = useState<string>('')
  const [filterDataDe, setFilterDataDe] = useState<string>('')
  const [filterDataAte, setFilterDataAte] = useState<string>('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Modal novo lead
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [form, setForm] = useState({
    nome: '',
    whatsapp: '',
    status: 'novo_lead' as LeadStatus,
    origem_id: '',
    segmento_id: '',
    observacao: '',
    valor: '',
    tags: [] as string[],
  })

  // Import modal
  const [showImport, setShowImport] = useState(false)

  // Realtime: adiciona/atualiza leads em tempo real
  useLeadsRealtime(setLeads)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [leadsRes, sourcesRes, segmentsRes] = await Promise.all([
      supabase.from('leads').select('*, lead_sources(id, nome), lead_segments(id, nome), profiles(id, nome)').order('created_at', { ascending: false }),
      supabase.from('lead_sources').select('*').eq('ativo', true).order('nome'),
      supabase.from('lead_segments').select('*').eq('ativo', true).order('nome'),
    ])
    setLeads((leadsRes.data as LeadWithRelations[]) ?? [])
    setSources(sourcesRes.data ?? [])
    setSegments(segmentsRes.data ?? [])
    setLoading(false)
  }

  const visibleLeads = useMemo(() => leads.filter(l => !l.arquivado), [leads])

  const allTags = useMemo(() => {
    const set = new Set<string>()
    leads.forEach(l => l.tags?.forEach(t => set.add(t)))
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [leads])

  const statusOptions = useMemo(() => [
    { value: '', label: 'Todos os status' },
    ...allStatuses.map(s => ({
      value: s.value,
      label: s.label,
      dotColor: s.color_dot || '#94a3b8',
    })),
  ], [allStatuses])

  const sourceOptions = useMemo(() => [
    { value: '', label: 'Todas as origens' },
    ...sources.map(s => ({
      value: s.id,
      label: s.nome,
      icon: Globe,
    })),
  ], [sources])

  const segmentOptions = useMemo(() => [
    { value: '', label: 'Todos os segmentos' },
    ...segments.map(s => ({
      value: s.id,
      label: s.nome,
      icon: Tag,
    })),
  ], [segments])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return leads.filter(l => {
      if (l.arquivado) return false
      if (q && !l.nome.toLowerCase().includes(q) && !l.whatsapp.includes(q) && !l.tags?.some(t => t.toLowerCase().includes(q))) return false
      if (filterStatus && l.status !== filterStatus) return false
      if (filterOrigem && l.origem_id !== filterOrigem) return false
      if (filterSegmento && l.segmento_id !== filterSegmento) return false
      if (filterDataDe && l.created_at.slice(0, 10) < filterDataDe) return false
      if (filterDataAte && l.created_at.slice(0, 10) > filterDataAte) return false
      if (filterTags.length && !filterTags.some(t => l.tags?.includes(t))) return false
      return true
    })
  }, [leads, search, filterStatus, filterOrigem, filterSegmento, filterDataDe, filterDataAte, filterTags])

  function addTag(val: string) {
    const t = val.trim()
    if (t && !form.tags.includes(t)) setForm(f => ({ ...f, tags: [...f.tags, t] }))
    setTagInput('')
  }

  function removeTag(tag: string) {
    setForm(f => ({ ...f, tags: f.tags.filter(t => t !== tag) }))
  }

  function resetForm() {
    setForm({ nome: '', whatsapp: '', status: 'novo_lead', origem_id: '', segmento_id: '', observacao: '', valor: '', tags: [] })
    setTagInput('')
    setFormError('')
  }

  const allSelected = filtered.length > 0 && filtered.every(l => selectedIds.has(l.id))

  function toggleSelectAll() {
    setSelectedIds(allSelected ? new Set() : new Set(filtered.map(l => l.id)))
  }

  function handleExport() {
    const rows = selectedIds.size ? filtered.filter(l => selectedIds.has(l.id)) : filtered
    exportLeadsToXlsx(rows, (v) => getStatusConfig(v).label, 'leads')
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setFormError('')
    setSaving(true)

    const waNorm = normalizeWhatsApp(form.whatsapp)
    const pendingTag = tagInput.trim()
    const finalTags = pendingTag && !form.tags.includes(pendingTag) ? [...form.tags, pendingTag] : form.tags

    const { data: dups } = await supabase.from('leads').select('id').in('whatsapp', phoneVariants(form.whatsapp)).limit(1)
    if (dups && dups.length) {
      setFormError('Já existe um lead com esse número de WhatsApp.')
      setSaving(false)
      return
    }

    // Validação de limite de leads do plano
    const [{ count: currentTotalLeads }, { data: orgData }] = await Promise.all([
      supabase.from('leads').select('*', { count: 'exact', head: true }),
      supabase.from('organizations').select('max_leads, plano').limit(1).maybeSingle(),
    ])

    const maxLeads = orgData?.max_leads ?? 500
    if ((currentTotalLeads ?? 0) >= maxLeads) {
      setFormError(`Limite de leads atingido (${maxLeads.toLocaleString('pt-BR')} leads). Para cadastrar mais leads, faça upgrade do plano da organização.`)
      setSaving(false)
      return
    }

    const { data: { user } } = await supabase.auth.getUser()

    const { error } = await supabase.from('leads').insert({
      nome: form.nome.trim(),
      whatsapp: waNorm,
      status: form.status,
      origem_id: form.origem_id || null,
      segmento_id: form.segmento_id || null,
      responsavel_id: user?.id ?? null,
      observacao: form.observacao.trim() || null,
      valor: parseCurrency(form.valor),
      tags: finalTags,
    }).select().single()

    if (error) {
      setFormError('Erro ao criar lead. Tente novamente.')
      setSaving(false)
      return
    }

    setSaving(false)
    setShowModal(false)
    resetForm()
    loadAll()
  }

  return (
    <Layout>
      <div className="px-8 py-8 w-full min-w-0 animate-fade-in">

        {/* Sticky Sub-Header no topo de /leads (fixo em top-[72px] abaixo do CRM Header) */}
        <div className="sticky top-[72px] z-20 bg-slate-100/95 backdrop-blur-md pt-2 pb-4 -mx-8 px-8 border-b border-slate-200/70 mb-5">
          {/* Header Superior: Título + Contador + Toggle Lista/Pipeline + Ações */}
          <div className="flex items-center justify-between mb-3.5">
            <div>
              <h1 className="text-slate-900 text-xl font-bold tracking-tight">Leads</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-slate-500 text-sm">{leads.length} {leads.length === 1 ? 'contato no total' : 'contatos no total'}</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              {/* Toggle Lista / Pipeline */}
              <div className="flex items-center bg-slate-200/70 p-1 rounded-xl gap-0.5 border border-slate-200/80 shadow-2xs">
                <button
                  onClick={() => switchView('list')}
                  title="Visualização em lista"
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    viewMode === 'list'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <LayoutList size={14} />
                  Lista
                </button>
                <button
                  onClick={() => switchView('pipeline')}
                  title="Visualização em pipeline"
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    viewMode === 'pipeline'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Kanban size={14} />
                  Pipeline
                </button>
              </div>

              {/* Menu de Ações (3 pontos) */}
              <div className="relative" ref={actionsMenuRef}>
                <button
                  type="button"
                  onClick={() => setShowActionsMenu(v => !v)}
                  className={`flex items-center justify-center w-9 h-9 rounded-xl border text-xs font-bold transition shadow-2xs cursor-pointer ${
                    showActionsMenu
                      ? 'border-brand-500 bg-brand-50 text-brand-800 ring-2 ring-brand-500/20'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                  title="Mais opções"
                >
                  <MoreVertical size={16} />
                </button>

                {showActionsMenu && (
                  <div className="absolute right-0 top-full mt-1.5 w-48 bg-white rounded-xl border border-slate-200 shadow-dropdown z-50 p-1.5 animate-fade-in space-y-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setShowActionsMenu(false)
                        resetForm()
                        setShowModal(true)
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-emerald-700 hover:bg-emerald-50 transition cursor-pointer"
                    >
                      <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                        <Plus size={14} />
                      </div>
                      <span>Novo Lead</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setShowActionsMenu(false)
                        setShowImport(true)
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition cursor-pointer"
                    >
                      <div className="w-6 h-6 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center shrink-0 border border-sky-100">
                        <Upload size={13} />
                      </div>
                      <span>Importar</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setShowActionsMenu(false)
                        handleExport()
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition cursor-pointer"
                      title={selectedIds.size ? `Exportar ${selectedIds.size} selecionados` : 'Exportar todos os filtrados'}
                    >
                      <div className="w-6 h-6 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100">
                        <Download size={13} />
                      </div>
                      <div className="flex items-center justify-between flex-1 min-w-0">
                        <span>Exportar</span>
                        {selectedIds.size > 0 && (
                          <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded-md shrink-0">
                            {selectedIds.size}
                          </span>
                        )}
                      </div>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Filtros Customizados — só na lista */}
          {viewMode === 'list' && (
            <div className="bg-white rounded-xl border border-slate-200/90 p-3 shadow-card flex flex-wrap gap-2.5 items-center">

              <div className="relative flex-1 min-w-[220px]">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar por nome, WhatsApp ou tag..."
                  className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 placeholder:text-slate-400 bg-slate-50/50 hover:bg-white focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition shadow-2xs"
                />
              </div>

              {/* Status */}
              <CustomSelect
                value={filterStatus}
                onChange={setFilterStatus}
                options={statusOptions}
                placeholder="Todos os status"
                icon={Flag}
              />

              {/* Origem */}
              <CustomSelect
                value={filterOrigem}
                onChange={setFilterOrigem}
                options={sourceOptions}
                placeholder="Todas as origens"
                icon={Globe}
              />

              {/* Segmento */}
              <CustomSelect
                value={filterSegmento}
                onChange={setFilterSegmento}
                options={segmentOptions}
                placeholder="Todos os segmentos"
                icon={Tag}
              />

              {/* Data de Criação */}
              <CustomDateRangePicker
                startDate={filterDataDe}
                endDate={filterDataAte}
                onChange={(start, end) => {
                  setFilterDataDe(start)
                  setFilterDataAte(end)
                }}
                label="Criado em"
              />

              {/* Filtro de Tags */}
              <div className="relative" ref={tagsMenuRef}>
                <button
                  onClick={() => setShowTagsMenu(v => !v)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition shadow-2xs cursor-pointer ${
                    filterTags.length
                      ? 'border-brand-300 bg-brand-50 text-brand-800'
                      : 'border-slate-200 bg-slate-50/70 hover:bg-white text-slate-700'
                  }`}
                >
                  <Tags size={14} className={filterTags.length ? 'text-brand-600' : 'text-slate-400'} />
                  {filterTags.length ? `Tags (${filterTags.length})` : 'Tags'}
                </button>
                {showTagsMenu && (
                  <div className="absolute right-0 top-full mt-1.5 w-56 max-h-72 overflow-y-auto bg-white rounded-xl border border-slate-200/90 shadow-dropdown z-50 p-2 animate-fade-in">
                    {allTags.length === 0 ? (
                      <p className="px-3 py-2 text-xs text-slate-400 font-medium">Nenhuma tag cadastrada</p>
                    ) : (
                      <div className="space-y-0.5">
                        {allTags.map(tag => (
                          <label key={tag} className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 rounded-xl cursor-pointer">
                            <input
                              type="checkbox"
                              checked={filterTags.includes(tag)}
                              onChange={() => toggleFilterTag(tag)}
                              className="accent-emerald-500 rounded"
                            />
                            {tag}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {(search || filterStatus || filterOrigem || filterSegmento || filterDataDe || filterDataAte || filterTags.length > 0) && (
                <button
                  onClick={() => { setSearch(''); setFilterStatus(''); setFilterOrigem(''); setFilterSegmento(''); setFilterDataDe(''); setFilterDataAte(''); setFilterTags([]); setSelectedIds(new Set()) }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition shadow-2xs cursor-pointer ml-auto"
                >
                  <X size={13} />
                  Limpar
                </button>
              )}
            </div>
          )}
        </div>

        {/* Pipeline view */}
        {viewMode === 'pipeline' && (
          (loading || loadingStatuses) ? (
            <PipelineSkeleton columns={5} />
          ) : (
            <div className="animate-fade-in">
              <PipelineBoard
                leads={visibleLeads}
                onLeadsChange={(next) => setLeads(prev => [...next, ...prev.filter(l => l.arquivado)])}
                columnsLocked={true}
              />
            </div>
          )
        )}

        {/* Lista view com Grid Estilo Excel / Spreadsheet */}
        {viewMode === 'list' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-card overflow-hidden">
            {loading ? (
              <LeadTableSkeleton rows={8} />
            ) : filtered.length === 0 ? (
              <div className="py-20 text-center">
                <p className="text-slate-400 text-sm font-medium">Nenhum lead encontrado com os filtros aplicados.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse border-b border-slate-200">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-slate-100 border-b border-slate-200 shadow-2xs">
                      <th className="px-3.5 py-3 w-10 text-center border-r border-slate-200/90 select-none bg-slate-100">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={toggleSelectAll}
                          title="Selecionar todos"
                          className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer accent-emerald-600"
                        />
                      </th>
                      <th className="text-[11px] font-bold uppercase tracking-wider text-slate-600 px-4 py-3 border-r border-slate-200/90 select-none bg-slate-100">Contato</th>
                      <th className="text-[11px] font-bold uppercase tracking-wider text-slate-600 px-4 py-3 border-r border-slate-200/90 select-none bg-slate-100">Status</th>
                      <th className="text-[11px] font-bold uppercase tracking-wider text-slate-600 px-4 py-3 border-r border-slate-200/90 select-none bg-slate-100">Origem</th>
                      <th className="text-[11px] font-bold uppercase tracking-wider text-slate-600 px-4 py-3 border-r border-slate-200/90 select-none bg-slate-100">Segmento</th>
                      <th className="text-[11px] font-bold uppercase tracking-wider text-slate-600 px-4 py-3 border-r border-slate-200/90 select-none bg-slate-100">Valor</th>
                      <th className="text-[11px] font-bold uppercase tracking-wider text-slate-600 px-4 py-3 border-r border-slate-200/90 select-none bg-slate-100">Responsável</th>
                      <th className="text-[11px] font-bold uppercase tracking-wider text-slate-600 px-4 py-3 border-r border-slate-200/90 select-none bg-slate-100">Criado em</th>
                      <th className="text-[11px] font-bold uppercase tracking-wider text-slate-600 px-4 py-3 border-r border-slate-200/90 select-none bg-slate-100">Próx. Follow-up</th>
                      <th className="px-3 py-3 w-10 text-center bg-slate-100" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-xs">
                    {filtered.map((lead, idx) => (
                      <tr
                        key={lead.id}
                        onClick={() => setSelectedLeadId(lead.id)}
                        className={`transition-colors cursor-pointer group animate-cascade-item ${
                          selectedIds.has(lead.id)
                            ? 'bg-brand-50/60 font-semibold'
                            : idx % 2 === 1
                            ? 'bg-slate-50/50 hover:bg-brand-50/30'
                            : 'bg-white hover:bg-brand-50/30'
                        }`}
                        style={{ animationDelay: `${Math.min(idx * 25, 350)}ms` }}
                      >
                        <td className="px-3.5 py-3 text-center border-r border-slate-200/80" onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(lead.id)}
                            onChange={() => toggleSelect(lead.id)}
                            className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer accent-emerald-600"
                          />
                        </td>
                        <td className="px-4 py-3 border-r border-slate-200/80">
                          <div className="flex items-center gap-3">
                            <LeadAvatar nome={lead.nome} foto_url={lead.foto_url} />
                            <div className="min-w-0">
                              <p className="text-slate-950 text-xs font-bold truncate group-hover:text-brand-600 transition">{lead.nome}</p>
                              <a
                                href={whatsappLink(lead.whatsapp)}
                                target="_blank"
                                rel="noreferrer"
                                onClick={e => e.stopPropagation()}
                                className="text-[11px] text-slate-500 hover:text-brand-600 flex items-center gap-1.5 transition font-medium mt-0.5"
                              >
                                <WhatsAppIcon size={12} />
                                {formatWhatsApp(lead.whatsapp)}
                              </a>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap border-r border-slate-200/80">
                          <StatusBadge status={lead.status} />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap border-r border-slate-200/80">
                          {lead.lead_sources ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-semibold">
                              <Globe size={11} className="text-slate-400" />
                              {lead.lead_sources.nome}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap border-r border-slate-200/80">
                          {lead.lead_segments ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-semibold">
                              <Tag size={11} className="text-slate-400" />
                              {lead.lead_segments.nome}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap border-r border-slate-200/80 font-mono font-bold text-slate-900 text-xs">
                          {lead.valor != null ? formatCurrency(lead.valor) : <span className="text-slate-400 font-sans font-normal">—</span>}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap border-r border-slate-200/80 text-xs font-semibold text-slate-700">
                          {lead.profiles?.nome ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200 text-slate-800 text-[11px]">
                              <User size={11} className="text-slate-400" />
                              {lead.profiles.nome}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap border-r border-slate-200/80 text-[11px] text-slate-500 font-mono">
                          {formatDateTime(lead.created_at)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap border-r border-slate-200/80">
                          {lead.proximo_followup ? (
                            (() => {
                              const isPast = new Date(lead.proximo_followup).toLocaleDateString('sv') < localDateStr()
                              const isToday = new Date(lead.proximo_followup).toLocaleDateString('sv') === localDateStr()
                              return (
                                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold border ${
                                  isPast
                                    ? 'bg-red-50 text-red-700 border-red-200'
                                    : isToday
                                    ? 'bg-brand-50 text-brand-800 border-brand-200'
                                    : 'bg-slate-50 text-slate-700 border-slate-200'
                                }`}>
                                  <CalendarDays size={12} className={isPast ? 'text-red-500' : isToday ? 'text-brand-600' : 'text-slate-400'} />
                                  {new Date(lead.proximo_followup).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                                </span>
                              )
                            })()
                          ) : (
                            <span className="text-slate-400 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <ChevronRight size={15} className="text-slate-300 group-hover:text-slate-600 transition inline-block" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      <LeadDrawer
        leadId={selectedLeadId}
        onClose={closeDrawer}
        onSaved={(l) => setLeads(prev => prev.map(x => x.id === l.id ? l : x))}
      />

      <ImportLeadsModal
        open={showImport}
        onClose={() => setShowImport(false)}
        onImported={loadAll}
        sources={sources}
        segments={segments}
        statuses={allStatuses}
        existingLeads={leads}
      />

      {/* Modal: Novo Lead */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg max-h-[90vh] overflow-y-auto animate-scale-in">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-slate-50/60">
              <h2 className="text-slate-950 text-base font-bold">Novo Lead</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className={labelCls}>Nome *</label>
                  <InputIcon icon={User}>
                    <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} required placeholder="Nome do contato" className={iconInputCls} />
                  </InputIcon>
                </div>
                <div className="col-span-2">
                  <label className={labelCls}>WhatsApp *</label>
                  <InputIcon icon={Phone}>
                    <input value={form.whatsapp} onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))} required placeholder="(11) 99999-9999" className={iconInputCls} />
                  </InputIcon>
                </div>
                <div>
                  <label className={labelCls}>Status</label>
                  <CustomSelect
                    value={form.status}
                    onChange={val => setForm(f => ({ ...f, status: val as LeadStatus }))}
                    options={statusOptions.filter(o => o.value !== '')}
                    placeholder="Selecione o status"
                    icon={Flag}
                    buttonClassName="w-full"
                  />
                </div>
                <div>
                  <label className={labelCls}>Valor estimado</label>
                  <InputIcon icon={DollarSign}>
                    <input value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} placeholder="R$ 0,00" className={iconInputCls} />
                  </InputIcon>
                </div>
                <div>
                  <label className={labelCls}>Origem</label>
                  <CustomSelect
                    value={form.origem_id}
                    onChange={val => setForm(f => ({ ...f, origem_id: val }))}
                    options={sourceOptions}
                    placeholder="Selecione a origem"
                    icon={Globe}
                    buttonClassName="w-full"
                  />
                </div>
                <div>
                  <label className={labelCls}>Segmento</label>
                  <CustomSelect
                    value={form.segmento_id}
                    onChange={val => setForm(f => ({ ...f, segmento_id: val }))}
                    options={segmentOptions}
                    placeholder="Selecione o segmento"
                    icon={Tag}
                    buttonClassName="w-full"
                  />
                </div>
                <div className="col-span-2">
                  <label className={labelCls}>Tags</label>
                  <InputIcon icon={Tags}>
                    <input value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(tagInput) } }} placeholder="Pressione Enter para adicionar" className={iconInputCls} />
                  </InputIcon>
                  {form.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {form.tags.map(tag => (
                        <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {tag}
                          <button type="button" onClick={() => removeTag(tag)} className="hover:text-emerald-900">
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="col-span-2">
                  <label className={labelCls}>Observações</label>
                  <TextareaIcon icon={FileText}>
                    <textarea value={form.observacao} onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))} rows={3} placeholder="Anotações sobre o lead..." className={iconTextareaCls} />
                  </TextareaIcon>
                </div>
              </div>

              {formError && <p className="text-xs text-red-600 font-semibold">{formError}</p>}

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 transition cursor-pointer shadow-2xs select-none"
                >
                  <X size={14} className="text-slate-400" />
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200 disabled:cursor-not-allowed border border-emerald-700/50 text-white text-xs font-bold transition shadow-2xs cursor-pointer select-none"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  {saving ? 'Criando...' : 'Criar Lead'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  )
}
