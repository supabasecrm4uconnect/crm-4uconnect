import { useEffect, useState, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, Search, ChevronRight, Loader2, X, LayoutList, Kanban, CalendarDays, SlidersHorizontal, GripVertical, Eye, Download, Upload, User, Phone, Flag, Globe, Tag, Tags, DollarSign, FileText } from 'lucide-react'
import {
  DndContext, PointerSensor, useSensor, useSensors, closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import Layout from '../components/Layout'
import StatusBadge from '../components/StatusBadge'
import PipelineBoard from '../components/pipeline/PipelineBoard'
import LeadDrawer from '../components/LeadDrawer'
import ImportLeadsModal from '../components/ImportLeadsModal'
import { useLeadsRealtime } from '../hooks/useLeadsRealtime'
import { supabase } from '../lib/supabase'
import { exportLeadsToXlsx } from '../lib/exportLeads'
import {
  formatWhatsApp, normalizeWhatsApp, formatCurrency, parseCurrency, phoneVariants,
  whatsappLink, localDateStr, formatDateTime
} from '../lib/helpers'
import { useStatuses, type StatusConfig } from '../contexts/StatusesContext'
import LeadAvatar from '../components/LeadAvatar'
import WhatsAppIcon from '../components/WhatsAppIcon'
import { InputIcon, TextareaIcon, iconInputCls, iconSelectCls, iconTextareaCls } from '../components/FieldIcon'
import type { LeadWithRelations, LeadSource, LeadSegment, LeadStatus } from '../types'

type ViewMode = 'list' | 'pipeline'

interface SortableStatusItemProps {
  status: StatusConfig
  onToggle: (id: string, ativo: boolean) => void
}

function SortableStatusItem({ status, onToggle }: SortableStatusItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: status.id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50"
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-400 touch-none shrink-0"
      >
        <GripVertical size={13} />
      </button>
      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: status.color_dot }} />
      <span className="flex-1 text-sm text-slate-700 truncate">{status.label}</span>
      <button
        onClick={() => onToggle(status.id, !status.ativo)}
        className={`shrink-0 transition ${status.ativo ? 'text-emerald-500 hover:text-emerald-600' : 'text-slate-300 hover:text-slate-400'}`}
        title={status.ativo ? 'Ocultar coluna' : 'Exibir coluna'}
      >
        <Eye size={13} />
      </button>
    </div>
  )
}

const labelCls = 'block text-sm font-medium text-slate-700 mb-1.5'

export default function Leads() {
  const { statuses: allStatuses, refresh: refreshStatuses, getConfig: getStatusConfig, loading: loadingStatuses } = useStatuses()
  const [searchParams] = useSearchParams()
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(
    () => searchParams.get('lead')
  )

  const [leads, setLeads] = useState<LeadWithRelations[]>([])
  const [sources, setSources] = useState<LeadSource[]>([])
  const [segments, setSegments] = useState<LeadSegment[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    // Se veio com ?status= do dashboard, força modo lista para o filtro funcionar
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

  // Pipeline organizer
  const [showColumnsMenu, setShowColumnsMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const [filterTags, setFilterTags] = useState<string[]>([])
  const [showTagsMenu, setShowTagsMenu] = useState(false)
  const tagsMenuRef = useRef<HTMLDivElement>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  useEffect(() => {
    if (!showColumnsMenu) return
    function handleOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowColumnsMenu(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [showColumnsMenu])

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

  async function toggleColumn(id: string, ativo: boolean) {
    await supabase.from('lead_statuses').update({ ativo }).eq('id', id)
    await refreshStatuses()
  }

  async function handleDropdownDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = allStatuses.findIndex(s => s.id === String(active.id))
    const newIndex = allStatuses.findIndex(s => s.id === String(over.id))
    if (oldIndex === -1 || newIndex === -1) return
    const reordered = arrayMove(allStatuses, oldIndex, newIndex)
    await Promise.all(
      reordered.map((s, i) =>
        supabase.from('lead_statuses').update({ ordem: i + 1 }).eq('id', s.id)
      )
    )
    await refreshStatuses()
  }

  // Filters
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState(() => searchParams.get('status') ?? '')
  const [filterOrigem, setFilterOrigem] = useState('')
  const [filterSegmento, setFilterSegmento] = useState('')
  const [filterDataDe, setFilterDataDe] = useState('')
  const [filterDataAte, setFilterDataAte] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Create modal
  const [showModal, setShowModal] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [form, setForm] = useState({
    nome: '', whatsapp: '', status: 'novo_lead' as LeadStatus,
    origem_id: '', segmento_id: '', observacao: '', valor: '', tags: [] as string[],
  })
  const [tagInput, setTagInput] = useState('')

  useEffect(() => { loadAll() }, [])

  // Realtime — atualiza pipeline e lista automaticamente
  useLeadsRealtime(setLeads)

  async function loadAll() {
    setLoading(true)
    const [leadsRes, sourcesRes, segmentsRes] = await Promise.all([
      supabase.from('leads').select('*, lead_sources(id, nome), lead_segments(id, nome), profiles(id, nome)').order('updated_at', { ascending: false }),
      supabase.from('lead_sources').select('*').eq('ativo', true).order('nome'),
      supabase.from('lead_segments').select('*').eq('ativo', true).order('nome'),
    ])
    setLeads((leadsRes.data as LeadWithRelations[]) ?? [])
    setSources(sourcesRes.data ?? [])
    setSegments(segmentsRes.data ?? [])
    setLoading(false)
  }

  // Lista e pipeline só mostram leads não arquivados (arquivados têm menu próprio)
  const visibleLeads = useMemo(() => leads.filter(l => !l.arquivado), [leads])

  const allTags = useMemo(() => {
    const set = new Set<string>()
    leads.forEach(l => l.tags?.forEach(t => set.add(t)))
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [leads])

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

    // Consolida tag digitada mas ainda não confirmada (sem Enter/vírgula)
    const pendingTag = tagInput.trim()
    const finalTags = pendingTag && !form.tags.includes(pendingTag) ? [...form.tags, pendingTag] : form.tags

    // Check duplicate — considera as variantes do 9º dígito (igual ao import)
    const { data: dups } = await supabase.from('leads').select('id').in('whatsapp', phoneVariants(form.whatsapp)).limit(1)
    if (dups && dups.length) {
      setFormError('Já existe um lead com esse número de WhatsApp.')
      setSaving(false)
      return
    }

    const { data: { user } } = await supabase.auth.getUser()

    const { data: newLead, error } = await supabase.from('leads').insert({
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

    // First status history entry
    await supabase.from('lead_status_history').insert({
      lead_id: newLead.id,
      status_anterior: null,
      status_novo: form.status,
      alterado_por: user?.id ?? null,
    })

    setSaving(false)
    setShowModal(false)
    resetForm()
    loadAll()
  }

  return (
    <Layout>
      <div className="px-8 py-8 w-full min-w-0">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-slate-900 text-xl font-semibold">Leads</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-slate-500 text-sm">{leads.length} contato{leads.length !== 1 ? 's' : ''} no total</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Toggle Lista / Pipeline */}
            <div className="flex items-center bg-slate-100 rounded-lg p-1 gap-0.5">
              <button
                onClick={() => switchView('list')}
                title="Visualização em lista"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition ${
                  viewMode === 'list'
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <LayoutList size={15} />
                Lista
              </button>
              <button
                onClick={() => switchView('pipeline')}
                title="Visualização em pipeline"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition ${
                  viewMode === 'pipeline'
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Kanban size={15} />
                Pipeline
              </button>
            </div>

            {/* Organizar pipeline — only in pipeline view */}
            {viewMode === 'pipeline' && (
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setShowColumnsMenu(v => !v)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition ${
                    showColumnsMenu
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <SlidersHorizontal size={14} />
                  Organizar pipeline
                </button>

                {showColumnsMenu && (
                  <div className="absolute right-0 top-full mt-1.5 w-64 bg-white rounded-xl border border-slate-100 shadow-lg z-30">
                    <p className="px-4 pt-3 pb-1 text-xs font-medium text-slate-400 uppercase tracking-wide">Colunas do pipeline</p>
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDropdownDragEnd}>
                      <SortableContext items={allStatuses.map(s => s.id)} strategy={verticalListSortingStrategy}>
                        <div className="px-2 pb-2">
                          {allStatuses.map(s => (
                            <SortableStatusItem
                              key={s.id}
                              status={s}
                              onToggle={toggleColumn}
                            />
                          ))}
                        </div>
                      </SortableContext>
                    </DndContext>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={handleExport}
              title={selectedIds.size ? 'Exportar apenas os leads selecionados' : 'Exportar para Excel (respeita os filtros)'}
              className="flex items-center gap-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-sm font-medium px-3 py-1.5 rounded-lg transition"
            >
              <Download size={15} />
              {selectedIds.size ? `Exportar (${selectedIds.size})` : 'Exportar'}
            </button>
            <button
              onClick={() => setShowImport(true)}
              title="Importar base de leads (CSV ou Excel)"
              className="flex items-center gap-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-sm font-medium px-3 py-1.5 rounded-lg transition"
            >
              <Upload size={15} />
              Importar
            </button>
            <button
              onClick={() => { resetForm(); setShowModal(true) }}
              className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition"
            >
              <Plus size={16} />
              Novo lead
            </button>
          </div>
        </div>

        {/* Filtros — só na lista */}
        {viewMode === 'list' && (
          <div className="flex flex-wrap gap-2.5 mb-5 items-center">
            <div className="relative flex-1 min-w-52">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por nome, WhatsApp ou tag..."
                className="w-full pl-9 pr-3.5 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
              />
            </div>
            <InputIcon icon={Flag}>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="pl-10 pr-3.5 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition">
                <option value="">Todos os status</option>
                {allStatuses.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </InputIcon>
            <InputIcon icon={Globe}>
              <select value={filterOrigem} onChange={e => setFilterOrigem(e.target.value)} className="pl-10 pr-3.5 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition">
                <option value="">Todas as origens</option>
                {sources.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
              </select>
            </InputIcon>
            <InputIcon icon={Tag}>
              <select value={filterSegmento} onChange={e => setFilterSegmento(e.target.value)} className="pl-10 pr-3.5 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition">
                <option value="">Todos os segmentos</option>
                {segments.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
              </select>
            </InputIcon>
            <div className="flex items-center gap-1.5">
              <InputIcon icon={CalendarDays}>
                <input
                  type="date"
                  value={filterDataDe}
                  onChange={e => setFilterDataDe(e.target.value)}
                  title="Criado de"
                  className="pl-9 pr-2 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
                />
              </InputIcon>
              <span className="text-slate-400 text-sm">até</span>
              <InputIcon icon={CalendarDays}>
                <input
                  type="date"
                  value={filterDataAte}
                  onChange={e => setFilterDataAte(e.target.value)}
                  title="Criado até"
                  className="pl-9 pr-2 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
                />
              </InputIcon>
            </div>
            <div className="relative" ref={tagsMenuRef}>
              <button
                onClick={() => setShowTagsMenu(v => !v)}
                className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg border text-sm transition ${
                  filterTags.length
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Tags size={15} className={filterTags.length ? 'text-emerald-600' : 'text-slate-400'} />
                {filterTags.length ? `Tags (${filterTags.length})` : 'Tags'}
              </button>
              {showTagsMenu && (
                <div className="absolute left-0 top-full mt-1.5 w-56 max-h-72 overflow-y-auto bg-white rounded-xl border border-slate-100 shadow-lg z-30">
                  {allTags.length === 0 ? (
                    <p className="px-4 py-3 text-sm text-slate-400">Nenhuma tag cadastrada</p>
                  ) : (
                    <div className="py-1.5">
                      {allTags.map(tag => (
                        <label key={tag} className="flex items-center gap-2 px-3.5 py-1.5 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={filterTags.includes(tag)}
                            onChange={() => toggleFilterTag(tag)}
                            className="accent-emerald-500"
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
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-500 hover:bg-slate-50 transition"
              >
                <X size={13} />
                Limpar
              </button>
            )}
          </div>
        )}

        {/* Pipeline view */}
        {viewMode === 'pipeline' && (
          (loading || loadingStatuses) ? (
            <div className="flex items-center justify-center py-32">
              <Loader2 size={24} className="text-slate-300 animate-spin" />
            </div>
          ) : (
            <PipelineBoard
              leads={visibleLeads}
              onLeadsChange={(next) => setLeads(prev => [...next, ...prev.filter(l => l.arquivado)])}
              columnsLocked={true}
            />
          )
        )}

        {/* Lista view */}
        {viewMode === 'list' && (
          <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 size={20} className="text-slate-300 animate-spin" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-slate-400 text-sm">Nenhum lead encontrado.</p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="px-4 py-3.5 w-10">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleSelectAll}
                        title="Selecionar todos"
                        className="w-4 h-4 rounded border-slate-300 text-emerald-500 focus:ring-emerald-500 cursor-pointer accent-emerald-500"
                      />
                    </th>
                    <th className="text-left text-xs font-medium text-slate-500 px-5 py-3.5">Contato</th>
                    <th className="text-left text-xs font-medium text-slate-500 px-4 py-3.5">Status</th>
                    <th className="text-left text-xs font-medium text-slate-500 px-4 py-3.5">Origem</th>
                    <th className="text-left text-xs font-medium text-slate-500 px-4 py-3.5">Segmento</th>
                    <th className="text-left text-xs font-medium text-slate-500 px-4 py-3.5">Valor</th>
                    <th className="text-left text-xs font-medium text-slate-500 px-4 py-3.5">Responsável</th>
                    <th className="text-left text-xs font-medium text-slate-500 px-4 py-3.5">Criado em</th>
                    <th className="text-left text-xs font-medium text-slate-500 px-4 py-3.5">Próx. follow-up</th>
                    <th className="px-4 py-3.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filtered.map(lead => (
                    <tr
                      key={lead.id}
                      onClick={() => setSelectedLeadId(lead.id)}
                      className={`hover:bg-slate-50 cursor-pointer transition-colors ${selectedIds.has(lead.id) ? 'bg-emerald-50/40' : ''}`}
                    >
                      <td className="px-4 py-3.5" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(lead.id)}
                          onChange={() => toggleSelect(lead.id)}
                          className="w-4 h-4 rounded border-slate-300 text-emerald-500 focus:ring-emerald-500 cursor-pointer accent-emerald-500"
                        />
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <LeadAvatar nome={lead.nome} foto_url={lead.foto_url} />
                          <div>
                            <p className="text-slate-900 text-sm font-medium">{lead.nome}</p>
                            <a
                              href={whatsappLink(lead.whatsapp)}
                              target="_blank"
                              rel="noreferrer"
                              onClick={e => e.stopPropagation()}
                              className="text-xs text-slate-400 hover:text-emerald-600 flex items-center gap-1 transition"
                            >
                              <WhatsAppIcon size={11} />
                              {formatWhatsApp(lead.whatsapp)}
                            </a>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5"><StatusBadge status={lead.status} /></td>
                      <td className="px-4 py-3.5 text-sm text-slate-600">{lead.lead_sources?.nome ?? '—'}</td>
                      <td className="px-4 py-3.5 text-sm text-slate-600">{lead.lead_segments?.nome ?? '—'}</td>
                      <td className="px-4 py-3.5 text-sm text-slate-700 tabular-nums whitespace-nowrap">{lead.valor != null ? formatCurrency(lead.valor) : '—'}</td>
                      <td className="px-4 py-3.5 text-sm text-slate-600">{lead.profiles?.nome ?? '—'}</td>
                      <td className="px-4 py-3.5 text-sm text-slate-500">{formatDateTime(lead.created_at)}</td>
                      <td className="px-4 py-3.5 text-sm text-slate-500">
                        {lead.proximo_followup
                          ? <span className={new Date(lead.proximo_followup).toLocaleDateString('sv') < localDateStr() ? 'text-red-500 font-medium' : ''}>
                              {new Date(lead.proximo_followup).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                            </span>
                          : '—'}
                      </td>
                      <td className="px-4 py-3.5">
                        <ChevronRight size={15} className="text-slate-300" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      <LeadDrawer
        leadId={selectedLeadId}
        onClose={() => setSelectedLeadId(null)}
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
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
              <h2 className="text-slate-900 text-base font-semibold">Novo lead</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 transition">
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
                  <InputIcon icon={Flag}>
                    <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as LeadStatus }))} className={iconSelectCls}>
                      {allStatuses.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </InputIcon>
                </div>
                <div>
                  <label className={labelCls}>Origem</label>
                  <InputIcon icon={Globe}>
                    <select value={form.origem_id} onChange={e => setForm(f => ({ ...f, origem_id: e.target.value }))} className={iconSelectCls}>
                      <option value="">Selecionar</option>
                      {sources.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                    </select>
                  </InputIcon>
                </div>
                <div>
                  <label className={labelCls}>Segmento</label>
                  <InputIcon icon={Tag}>
                    <select value={form.segmento_id} onChange={e => setForm(f => ({ ...f, segmento_id: e.target.value }))} className={iconSelectCls}>
                      <option value="">Selecionar</option>
                      {segments.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                    </select>
                  </InputIcon>
                </div>
                <div className="col-span-2">
                  <label className={labelCls}>Valor (R$)</label>
                  <InputIcon icon={DollarSign}>
                    <input
                      value={form.valor}
                      onChange={e => setForm(f => ({ ...f, valor: e.target.value }))}
                      inputMode="decimal"
                      placeholder="Ex: 1.500,00"
                      className={iconInputCls}
                    />
                  </InputIcon>
                  <p className="text-xs text-slate-400 mt-1">Valor da proposta/negócio deste lead (opcional)</p>
                </div>
                <div className="col-span-2">
                  <label className={labelCls}>Tags</label>
                  <div className="relative border border-slate-200 rounded-lg p-2 pl-10 flex flex-wrap gap-1.5 focus-within:ring-2 focus-within:ring-emerald-500 min-h-[42px]">
                    <Tags size={15} className="absolute left-3 top-3 text-slate-400 pointer-events-none" />
                    {form.tags.map(tag => (
                      <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-700 rounded-full text-xs">
                        {tag}
                        <button type="button" onClick={() => removeTag(tag)} className="text-slate-400 hover:text-slate-600 leading-none">×</button>
                      </span>
                    ))}
                    <input
                      value={tagInput}
                      onChange={e => setTagInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(tagInput) }
                        if (e.key === 'Backspace' && !tagInput && form.tags.length > 0) removeTag(form.tags[form.tags.length - 1])
                      }}
                      placeholder={form.tags.length === 0 ? 'Adicionar tag...' : ''}
                      className="flex-1 min-w-24 outline-none text-sm text-slate-900 bg-transparent placeholder:text-slate-400"
                    />
                  </div>
                  <p className="text-xs text-slate-400 mt-1">Pressione Enter ou vírgula para adicionar</p>
                </div>
                <div className="col-span-2">
                  <label className={labelCls}>Observação</label>
                  <TextareaIcon icon={FileText}>
                    <textarea value={form.observacao} onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))} rows={3} placeholder="Informações sobre o atendimento..." className={iconTextareaCls} />
                  </TextareaIcon>
                </div>
              </div>

              {formError && (
                <div className="bg-red-50 border border-red-100 rounded-lg px-3.5 py-2.5">
                  <p className="text-red-600 text-sm">{formError}</p>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-1">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition">
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300 text-white text-sm font-medium transition">
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  {saving ? 'Salvando...' : 'Salvar lead'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  )
}
