import { useEffect, useState, useCallback } from 'react'
import {
  Loader2, X, MessageSquare,
  Clock, CheckCircle2, Plus, Send, Trash2
} from 'lucide-react'
import StatusBadge from './StatusBadge'
import LeadAvatar from './LeadAvatar'
import { supabase } from '../lib/supabase'
import {
  allActivityTypes, activityTypeLabel, activityStatusConfig,
  formatWhatsApp, formatDateTime, formatDate,
  whatsappLink, isOverdue,
} from '../lib/helpers'
import { useStatuses } from '../contexts/StatusesContext'
import type {
  LeadWithRelations, LeadSource, LeadSegment, Profile,
  LeadStatus, LeadStatusHistory, LeadActivity, LeadNote, ActivityType,
} from '../types'

interface LeadDrawerProps {
  leadId: string | null
  onClose: () => void
}

const inputCls = 'w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition'
const selectCls = 'w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition bg-white'
const labelCls = 'block text-sm font-medium text-slate-700 mb-1.5'

type Tab = 'info' | 'activities' | 'history' | 'notes'

export default function LeadDrawer({ leadId, onClose }: LeadDrawerProps) {
  const [lead, setLead] = useState<LeadWithRelations | null>(null)
  const [history, setHistory] = useState<LeadStatusHistory[]>([])
  const [activities, setActivities] = useState<LeadActivity[]>([])
  const [notes, setNotes] = useState<LeadNote[]>([])
  
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [sources, setSources] = useState<LeadSource[]>([])
  const [segments, setSegments] = useState<LeadSegment[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(false)

  const [activeTab, setActiveTab] = useState<Tab>('info')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const { statuses: allStatuses, getConfig: getStatusConfig } = useStatuses()
  const [formStatus, setFormStatus] = useState<LeadStatus>('novo_lead')
  const [formOrigemId, setFormOrigemId] = useState('')
  const [formSegmentoId, setFormSegmentoId] = useState('')
  const [formTags, setFormTags] = useState<string[]>([])
  const [formObservacao, setFormObservacao] = useState('')
  const [formResponsavelId, setFormResponsavelId] = useState('')
  const [formProximoFollowup, setFormProximoFollowup] = useState('')
  const [tagInput, setTagInput] = useState('')

  const [showActivityModal, setShowActivityModal] = useState(false)
  const [activityForm, setActivityForm] = useState({ tipo: 'enviar_mensagem' as ActivityType, descricao: '', data: '', hora: '' })
  const [savingActivity, setSavingActivity] = useState(false)

  const [noteText, setNoteText] = useState('')
  const [savingNote, setSavingNote] = useState(false)

  const loadHistory = useCallback(async (id: string) => {
    const { data } = await supabase
      .from('lead_status_history').select('*, profiles(nome)')
      .eq('lead_id', id).order('created_at', { ascending: false })
    setHistory((data as LeadStatusHistory[]) ?? [])
  }, [])

  const loadActivities = useCallback(async (id: string) => {
    const { data } = await supabase
      .from('lead_activities').select('*, profiles(nome)')
      .eq('lead_id', id).order('data_agendada').order('hora_agendada')
    setActivities((data as LeadActivity[]) ?? [])
  }, [])

  const loadNotes = useCallback(async (id: string) => {
    const { data } = await supabase
      .from('lead_notes').select('*, profiles(nome)')
      .eq('lead_id', id).order('created_at', { ascending: false })
    setNotes((data as LeadNote[]) ?? [])
  }, [])

  const loadLead = useCallback(async (id: string) => {
    const { data } = await supabase
      .from('leads')
      .select('*, lead_sources(id, nome), lead_segments(id, nome), profiles(id, nome, email, tipo_usuario, status, created_at, updated_at)')
      .eq('id', id).single()
    if (data) {
      const l = data as LeadWithRelations
      setLead(l)
      setFormStatus(l.status)
      setFormOrigemId(l.origem_id ?? '')
      setFormSegmentoId(l.segmento_id ?? '')
      setFormTags(l.tags ?? [])
      setFormObservacao(l.observacao ?? '')
      setFormResponsavelId(l.responsavel_id ?? '')
      if (l.proximo_followup) {
        const d = new Date(l.proximo_followup)
        const pad = (n: number) => String(n).padStart(2, '0')
        setFormProximoFollowup(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`)
      } else {
        setFormProximoFollowup('')
      }
    }
  }, [])

  // Carrega tudo quando leadId muda
  useEffect(() => {
    if (!leadId) {
      setLead(null)
      setHistory([])
      setActivities([])
      setNotes([])
      setActiveTab('info')
      return
    }

    setLoading(true)
    setLead(null)

    Promise.all([
      loadLead(leadId),
      supabase.from('lead_sources').select('*').eq('ativo', true).order('nome'),
      supabase.from('lead_segments').select('*').eq('ativo', true).order('nome'),
      supabase.from('profiles').select('id, nome, email, tipo_usuario, status, created_at, updated_at').eq('status', 'ativo').order('nome'),
      loadHistory(leadId),
      loadActivities(leadId),
      loadNotes(leadId),
    ]).then(([, sourcesRes, segmentsRes, profilesRes]) => {
      setSources((sourcesRes as any).data ?? [])
      setSegments((segmentsRes as any).data ?? [])
      setProfiles((profilesRes as any).data ?? [])
      setLoading(false)
    })
  }, [leadId, loadLead, loadHistory, loadActivities, loadNotes])

  // Realtime
  useEffect(() => {
    if (!leadId) return
    const channel = supabase
      .channel(`lead-drawer-${leadId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'leads', filter: `id=eq.${leadId}` }, () => loadLead(leadId))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'lead_status_history', filter: `lead_id=eq.${leadId}` }, () => loadHistory(leadId))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lead_activities', filter: `lead_id=eq.${leadId}` }, () => loadActivities(leadId))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'lead_notes', filter: `lead_id=eq.${leadId}` }, () => loadNotes(leadId))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [leadId, loadLead, loadHistory, loadActivities, loadNotes])

  // Fechar com Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  async function handleSave() {
    if (!lead) return
    setError('')
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const statusChanged = formStatus !== lead.status

    const { error: updateError } = await supabase.from('leads').update({
      status: formStatus,
      origem_id: formOrigemId || null,
      segmento_id: formSegmentoId || null,
      tags: formTags,
      observacao: formObservacao.trim() || null,
      responsavel_id: formResponsavelId || user?.id || null,
      proximo_followup: formProximoFollowup ? `${formProximoFollowup}T12:00:00.000Z` : null,
    }).eq('id', lead.id)

    if (updateError) { setError('Erro ao salvar.'); setSaving(false); return }

    if (statusChanged) {
      await supabase.from('lead_status_history').insert({
        lead_id: lead.id,
        status_anterior: lead.status,
        status_novo: formStatus,
        alterado_por: user?.id ?? null,
      })
    }

    await loadLead(lead.id)
    await Promise.all([loadHistory(lead.id), loadActivities(lead.id)])
    setSaving(false)
  }

  async function handleDelete() {
    if (!lead) return
    setDeleting(true)
    // Deleta registros filhos antes do lead (FK constraints)
    await supabase.from('lead_notes').delete().eq('lead_id', lead.id)
    await supabase.from('lead_activities').delete().eq('lead_id', lead.id)
    await supabase.from('lead_status_history').delete().eq('lead_id', lead.id)
    const { error } = await supabase.from('leads').delete().eq('id', lead.id)
    if (!error) {
      setDeleting(false)
      setShowDeleteConfirm(false)
      onClose()
    } else {
      setDeleting(false)
      setError('Erro ao excluir lead.')
    }
  }

  async function handleMarkActivityDone(activityId: string) {
    if (!leadId) return
    await supabase.from('lead_activities').update({
      status_atividade: 'concluida',
      concluido_em: new Date().toISOString(),
    }).eq('id', activityId)
    await loadActivities(leadId)
  }

  async function handleCreateActivity(e: React.FormEvent) {
    e.preventDefault()
    if (!lead) return
    setSavingActivity(true)
    const { data: { user } } = await supabase.auth.getUser()

    await supabase.from('lead_activities').insert({
      lead_id: lead.id,
      tipo_atividade: activityForm.tipo,
      descricao: activityForm.descricao.trim() || null,
      data_agendada: activityForm.data,
      hora_agendada: activityForm.hora,
      criado_por: user?.id ?? null,
      status_atividade: 'pendente',
    })

    const proximo = `${activityForm.data}T12:00:00.000Z`
    if (!lead.proximo_followup || proximo < lead.proximo_followup) {
      await supabase.from('leads').update({ proximo_followup: proximo }).eq('id', lead.id)
      setFormProximoFollowup(activityForm.data)
    }

    setSavingActivity(false)
    setShowActivityModal(false)
    setActivityForm({ tipo: 'enviar_mensagem', descricao: '', data: '', hora: '' })
    await loadActivities(lead.id)
  }

  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault()
    if (!noteText.trim() || !lead) return
    setSavingNote(true)
    const { data: { user } } = await supabase.auth.getUser()

    await supabase.from('lead_notes').insert({
      lead_id: lead.id,
      nota: noteText.trim(),
      criado_por: user?.id ?? null,
    })

    setNoteText('')
    setSavingNote(false)
    await loadNotes(lead.id)
  }

  function addTag(val: string) {
    const t = val.trim()
    if (t && !formTags.includes(t)) setFormTags(prev => [...prev, t])
    setTagInput('')
  }

  const isOpen = leadId !== null

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'info', label: 'Informações' },
    { key: 'activities', label: 'Follow-ups', count: activities.filter(a => a.status_atividade === 'pendente').length },
    { key: 'history', label: 'Histórico', count: history.length },
    { key: 'notes', label: 'Notas', count: notes.length },
  ]

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/30 z-40 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div className={`fixed top-0 right-0 h-full w-full max-w-2xl bg-white shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>

        {/* Header fixo */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          {loading || !lead ? (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-100 animate-pulse" />
              <div className="space-y-1.5">
                <div className="w-32 h-4 bg-slate-100 rounded animate-pulse" />
                <div className="w-24 h-3 bg-slate-100 rounded animate-pulse" />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 min-w-0">
              <LeadAvatar nome={lead.nome} foto_url={lead.foto_url} size="md" />
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-slate-900 text-base font-semibold truncate">{lead.nome}</h2>
                  <StatusBadge status={formStatus} />
                  <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                    ao vivo
                  </span>
                </div>
                <p className="text-slate-500 text-sm">{formatWhatsApp(lead.whatsapp)}</p>
              </div>
            </div>
          )}
          <div className="flex items-center gap-2 shrink-0 ml-3">
            {lead && (
              <>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="p-2 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition"
                  title="Excluir Lead"
                >
                  <Trash2 size={18} />
                </button>
                <a
                  href={whatsappLink(lead.whatsapp)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-sm font-medium transition"
                >
                  <MessageSquare size={14} />
                  WhatsApp
                </a>
              </>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center flex-1">
            <Loader2 size={20} className="text-slate-300 animate-spin" />
          </div>
        ) : !lead ? null : (
          <>
            {/* Tabs */}
            <div className="flex gap-1 border-b border-slate-100 px-6 shrink-0">
              {tabs.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition ${
                    activeTab === tab.key
                      ? 'border-emerald-500 text-emerald-600'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {tab.label}
                  {tab.count !== undefined && tab.count > 0 && (
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${activeTab === tab.key ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Conteúdo scrollável */}
            <div className="flex-1 overflow-y-auto px-6 py-5">

              {/* Tab: Informações */}
              {activeTab === 'info' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Status</label>
                      <select value={formStatus} onChange={e => setFormStatus(e.target.value as LeadStatus)} className={selectCls}>
                        {allStatuses.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}

                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Responsável</label>
                      <select value={formResponsavelId} onChange={e => setFormResponsavelId(e.target.value)} className={selectCls}>
                        <option value="">Sem responsável</option>
                        {profiles.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Origem</label>
                      <select value={formOrigemId} onChange={e => setFormOrigemId(e.target.value)} className={selectCls}>
                        <option value="">Selecionar</option>
                        {sources.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Segmento</label>
                      <select value={formSegmentoId} onChange={e => setFormSegmentoId(e.target.value)} className={selectCls}>
                        <option value="">Selecionar</option>
                        {segments.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className={labelCls}>Próximo follow-up</label>
                      <input type="date" value={formProximoFollowup} onChange={e => setFormProximoFollowup(e.target.value)} className={inputCls} />
                    </div>
                    <div className="col-span-2">
                      <label className={labelCls}>Tags</label>
                      <div className="border border-slate-200 rounded-lg p-2 flex flex-wrap gap-1.5 focus-within:ring-2 focus-within:ring-emerald-500 min-h-[42px]">
                        {formTags.map(tag => (
                          <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-700 rounded-full text-xs">
                            {tag}
                            <button type="button" onClick={() => setFormTags(prev => prev.filter(t => t !== tag))} className="text-slate-400 hover:text-slate-600 leading-none">×</button>
                          </span>
                        ))}
                        <input
                          value={tagInput}
                          onChange={e => setTagInput(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(tagInput) }
                            if (e.key === 'Backspace' && !tagInput && formTags.length > 0) setFormTags(prev => prev.slice(0, -1))
                          }}
                          placeholder={formTags.length === 0 ? 'Adicionar tag...' : ''}
                          className="flex-1 min-w-24 outline-none text-sm text-slate-900 bg-transparent placeholder:text-slate-400"
                        />
                      </div>
                      <p className="text-xs text-slate-400 mt-1">Pressione Enter ou vírgula para adicionar</p>
                    </div>
                    <div className="col-span-2">
                      <label className={labelCls}>Observação</label>
                      <textarea value={formObservacao} onChange={e => setFormObservacao(e.target.value)} rows={4} placeholder="Informações sobre o atendimento..." className={inputCls + ' resize-none'} />
                    </div>
                  </div>

                  {error && (
                    <div className="bg-red-50 border border-red-100 rounded-lg px-3.5 py-2.5">
                      <p className="text-red-600 text-sm">{error}</p>
                    </div>
                  )}

                  <div className="flex justify-between items-center pt-1">
                    <p className="text-xs text-slate-400">Criado em {formatDateTime(lead.created_at)}</p>
                    <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300 text-white text-sm font-medium transition">
                      {saving && <Loader2 size={14} className="animate-spin" />}
                      {saving ? 'Salvando...' : 'Salvar alterações'}
                    </button>
                  </div>
                </div>
              )}

              {/* Tab: Follow-ups */}
              {activeTab === 'activities' && (
                <div>
                  <div className="flex justify-end mb-4">
                    <button
                      onClick={() => setShowActivityModal(true)}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium transition"
                    >
                      <Plus size={15} />
                      Nova atividade
                    </button>
                  </div>
                  {activities.length === 0 ? (
                    <div className="py-12 text-center">
                      <Clock size={24} className="text-slate-300 mx-auto mb-2" />
                      <p className="text-slate-400 text-sm">Nenhuma atividade registrada.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {activities.map(act => {
                        const overdue = act.status_atividade === 'pendente' && isOverdue(act.data_agendada)
                        const effectiveStatus = overdue ? 'atrasada' : act.status_atividade
                        const cfg = activityStatusConfig[effectiveStatus]
                        return (
                          <div key={act.id} className="bg-slate-50 border border-slate-100 rounded-xl px-5 py-4 flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-slate-900 text-sm font-medium">{activityTypeLabel[act.tipo_atividade]}</span>
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color} ${cfg.bg}`}>{cfg.label}</span>
                              </div>
                              {act.descricao && <p className="text-slate-500 text-xs mb-1">{act.descricao}</p>}
                              <p className="text-slate-400 text-xs">
                                {formatDate(act.data_agendada)} às {act.hora_agendada.slice(0, 5)}
                                {act.profiles && ` · ${act.profiles.nome}`}
                              </p>
                            </div>
                            {act.status_atividade === 'pendente' && (
                              <button
                                onClick={() => handleMarkActivityDone(act.id)}
                                className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-emerald-600 transition px-3 py-1.5 rounded-lg hover:bg-emerald-50"
                              >
                                <CheckCircle2 size={14} />
                                Concluir
                              </button>
                            )}
                            {act.status_atividade === 'concluida' && (
                              <span className="text-xs text-slate-400">
                                {act.concluido_em ? formatDateTime(act.concluido_em) : 'Concluída'}
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Tab: Histórico */}
              {activeTab === 'history' && (
                <div>
                  {history.length === 0 ? (
                    <div className="py-12 text-center">
                      <p className="text-slate-400 text-sm">Sem histórico de alterações.</p>
                    </div>
                  ) : (
                    <div className="relative pl-4">
                      <div className="absolute left-0 top-2 bottom-2 w-px bg-slate-100" />
                      <div className="space-y-4">
                        {history.map(h => {
                          const cfg = getStatusConfig(h.status_novo)
                          const cfgAnterior = h.status_anterior ? getStatusConfig(h.status_anterior) : null
                          return (
                            <div key={h.id} className="relative pl-5">
                              <div className="absolute left-0 -translate-x-1/2 w-2.5 h-2.5 rounded-full border-2 border-white top-1.5" style={{ background: cfg.color_dot }} />
                              <p className="text-slate-900 text-sm">
                                Status alterado para{' '}
                                <span className="font-medium" style={{ color: cfg.color_text }}>{cfg.label}</span>
                                {h.status_anterior && cfgAnterior && (
                                  <span className="text-slate-400"> (era: {cfgAnterior.label})</span>
                                )}
                              </p>
                              <p className="text-slate-400 text-xs mt-0.5">
                                {formatDateTime(h.created_at)}
                                {h.profiles?.nome && ` · por ${h.profiles.nome}`}
                              </p>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tab: Notas */}
              {activeTab === 'notes' && (
                <div>
                  <form onSubmit={handleAddNote} className="mb-5">
                    <textarea
                      value={noteText}
                      onChange={e => setNoteText(e.target.value)}
                      rows={3}
                      placeholder="Adicionar uma nota..."
                      className={inputCls + ' resize-none mb-2'}
                    />
                    <div className="flex justify-end">
                      <button type="submit" disabled={savingNote || !noteText.trim()} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300 text-white text-sm font-medium transition">
                        {savingNote ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                        {savingNote ? 'Salvando...' : 'Adicionar nota'}
                      </button>
                    </div>
                  </form>

                  {notes.length === 0 ? (
                    <p className="text-slate-400 text-sm text-center py-8">Nenhuma nota registrada.</p>
                  ) : (
                    <div className="space-y-3">
                      {notes.map(note => (
                        <div key={note.id} className="bg-slate-50 border border-slate-100 rounded-xl px-5 py-4">
                          <p className="text-slate-800 text-sm leading-relaxed">{note.nota}</p>
                          <p className="text-slate-400 text-xs mt-2">
                            {formatDateTime(note.created_at)}
                            {note.profiles?.nome && ` · ${note.profiles.nome}`}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Modal: Confirmar exclusão */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="px-6 py-5 border-b border-slate-100">
              <h2 className="text-slate-900 text-base font-semibold">Excluir lead</h2>
              <p className="text-slate-500 text-sm mt-1">
                Tem certeza que deseja excluir <span className="font-medium text-slate-700">{lead?.nome}</span>? Esta ação não pode ser desfeita.
              </p>
            </div>
            {error && (
              <div className="mx-6 mt-4 px-3.5 py-2.5 rounded-lg bg-red-50 border border-red-100">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}
            <div className="flex justify-end gap-3 px-6 py-4">
              <button
                type="button"
                onClick={() => { setShowDeleteConfirm(false); setError('') }}
                disabled={deleting}
                className="px-4 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white text-sm font-medium transition"
              >
                {deleting && <Loader2 size={14} className="animate-spin" />}
                {deleting ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Nova atividade */}
      {showActivityModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
              <h2 className="text-slate-900 text-base font-semibold">Nova atividade</h2>
              <button onClick={() => setShowActivityModal(false)} className="text-slate-400 hover:text-slate-600 transition">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateActivity} className="px-6 py-5 space-y-4">
              <div>
                <label className={labelCls}>Tipo de atividade</label>
                <select value={activityForm.tipo} onChange={e => setActivityForm(f => ({ ...f, tipo: e.target.value as ActivityType }))} className={selectCls}>
                  {allActivityTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Data *</label>
                  <input type="date" value={activityForm.data} onChange={e => setActivityForm(f => ({ ...f, data: e.target.value }))} required className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Hora *</label>
                  <input type="time" value={activityForm.hora} onChange={e => setActivityForm(f => ({ ...f, hora: e.target.value }))} required className={inputCls} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Descrição</label>
                <textarea value={activityForm.descricao} onChange={e => setActivityForm(f => ({ ...f, descricao: e.target.value }))} rows={2} placeholder="Detalhes da atividade..." className={inputCls + ' resize-none'} />
              </div>
              <div className="flex justify-end gap-3 pt-1">
                <button type="button" onClick={() => setShowActivityModal(false)} className="px-4 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition">Cancelar</button>
                <button type="submit" disabled={savingActivity} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300 text-white text-sm font-medium transition">
                  {savingActivity && <Loader2 size={14} className="animate-spin" />}
                  {savingActivity ? 'Salvando...' : 'Agendar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
