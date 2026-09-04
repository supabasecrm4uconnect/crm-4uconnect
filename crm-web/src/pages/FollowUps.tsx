import { useEffect, useState, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CalendarClock, CheckCircle2, AlertCircle, Clock, CalendarCheck, Loader2,
  CalendarDays, ClipboardList, X, Check, Phone, MessageSquare,
  Users, Mail, FileText, Pencil, Trash2, ListChecks
} from 'lucide-react'
import Layout from '../components/Layout'
import CustomSelect from '../components/CustomSelect'
import CustomDatePicker from '../components/CustomDatePicker'
import CustomTimePicker from '../components/CustomTimePicker'
import CustomDateRangePicker from '../components/CustomDateRangePicker'
import { TextareaIcon, iconTextareaCls } from '../components/FieldIcon'
import { supabase } from '../lib/supabase'
import { activityTypeLabel, allActivityTypes, activityStatusConfig, formatDate, isOverdue, localDateStr } from '../lib/helpers'
import { recalcProximoFollowup } from '../lib/leadFollowup'
import ConfirmModal from '../components/ConfirmModal'
import type { LeadActivity, ActivityType } from '../types'

type Section = 'atrasados' | 'hoje' | 'proximos' | 'concluidos'

interface ActivityWithLead extends LeadActivity {
  leads: { id: string; nome: string; whatsapp: string } | null
}

const TYPE_ICONS: Record<string, typeof Phone> = {
  ligacao: Phone,
  whatsapp: MessageSquare,
  reuniao: Users,
  email: Mail,
  tarefa: FileText,
  visita: Users,
}

const labelCls = 'block text-xs font-bold text-slate-700 mb-1.5'

export default function FollowUps() {
  const navigate = useNavigate()
  const [activities, setActivities] = useState<ActivityWithLead[]>([])
  const [loading, setLoading] = useState(true)
  const [activeSection, setActiveSection] = useState<Section>('hoje')
  const [markingDone, setMarkingDone] = useState<string | null>(null)
  const [filterDataDe, setFilterDataDe] = useState('')
  const [filterDataAte, setFilterDataAte] = useState('')
  const [filterTipo, setFilterTipo] = useState<ActivityType | ''>('')

  // Estado para Edição de Follow-up
  const [editingActivity, setEditingActivity] = useState<ActivityWithLead | null>(null)
  const [editForm, setEditForm] = useState<{
    id: string
    lead_id: string
    tipo: ActivityType
    descricao: string
    data: string
    hora: string
    status: 'pendente' | 'concluida' | 'cancelada'
  } | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const [confirmDeleteActivity, setConfirmDeleteActivity] = useState<ActivityWithLead | null>(null)
  const [deletingActivity, setDeletingActivity] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => { loadActivities() }, [])

  async function loadActivities() {
    setLoading(true)
    const { data } = await supabase
      .from('lead_activities')
      .select('*, leads(id, nome, whatsapp), profiles(nome)')
      .order('data_agendada')
      .order('hora_agendada')
    setActivities((data as ActivityWithLead[]) ?? [])
    setLoading(false)
  }

  async function markDone(id: string) {
    setMarkingDone(id)
    const activity = activities.find(a => a.id === id)
    await supabase.from('lead_activities').update({
      status_atividade: 'concluida',
      concluido_em: new Date().toISOString(),
    }).eq('id', id)
    if (activity) await recalcProximoFollowup(activity.lead_id)
    await loadActivities()
    setMarkingDone(null)
  }

  function handleOpenEdit(act: ActivityWithLead) {
    setEditingActivity(act)
    setEditForm({
      id: act.id,
      lead_id: act.lead_id,
      tipo: act.tipo_atividade,
      descricao: act.descricao || '',
      data: act.data_agendada,
      hora: act.hora_agendada.slice(0, 5),
      status: act.status_atividade === 'atrasada' ? 'pendente' : act.status_atividade,
    })
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editForm) return
    setSavingEdit(true)

    const { error } = await supabase.from('lead_activities').update({
      tipo_atividade: editForm.tipo,
      descricao: editForm.descricao.trim() || null,
      data_agendada: editForm.data,
      hora_agendada: editForm.hora,
      status_atividade: editForm.status,
      concluido_em: editForm.status === 'concluida' ? new Date().toISOString() : null,
    }).eq('id', editForm.id)

    if (!error) {
      await recalcProximoFollowup(editForm.lead_id)
      await loadActivities()
      setEditingActivity(null)
      setEditForm(null)
    }
    setSavingEdit(false)
  }

  async function handleConfirmDelete() {
    if (!confirmDeleteActivity) return
    setDeletingActivity(true)
    setDeleteError(null)
    try {
      const { error } = await supabase.from('lead_activities').delete().eq('id', confirmDeleteActivity.id)
      if (error) throw error
      await recalcProximoFollowup(confirmDeleteActivity.lead_id)
      await loadActivities()
      if (editingActivity?.id === confirmDeleteActivity.id) {
        setEditingActivity(null)
        setEditForm(null)
      }
      setConfirmDeleteActivity(null)
    } catch (err: any) {
      setDeleteError(err?.message || 'Erro ao excluir atividade.')
    } finally {
      setDeletingActivity(false)
    }
  }

  const today = localDateStr()

  const tipoOptions = useMemo(() => [
    { value: '', label: 'Todos os tipos' },
    ...allActivityTypes().map(at => ({
      value: at.value,
      label: at.label,
      icon: TYPE_ICONS[at.value] || ClipboardList,
    })),
  ], [])

  const activityTypeOptions = useMemo(() => [
    ...allActivityTypes().map(at => ({
      value: at.value,
      label: at.label,
      icon: TYPE_ICONS[at.value] || ListChecks,
    })),
  ], [])

  const activityStatusOptions = useMemo(() => [
    { value: 'pendente', label: 'Pendente', dotColor: '#f59e0b' },
    { value: 'concluida', label: 'Concluída', dotColor: '#10b981' },
    { value: 'cancelada', label: 'Cancelada', dotColor: '#ef4444' },
  ], [])

  const isEditFormDirty = useMemo(() => {
    if (!editForm) return false
    const orig = activities.find(a => a.id === editForm.id)
    if (!orig) return true
    return (
      editForm.tipo !== orig.tipo_atividade ||
      editForm.status !== orig.status_atividade ||
      editForm.data !== (orig.data_agendada || '') ||
      editForm.hora !== (orig.hora_agendada || '') ||
      editForm.descricao.trim() !== (orig.descricao || '').trim()
    )
  }, [editForm, activities])

  const filteredActivities = useMemo(() => {
    return activities.filter(a => {
      if (filterDataDe && a.data_agendada < filterDataDe) return false
      if (filterDataAte && a.data_agendada > filterDataAte) return false
      if (filterTipo && a.tipo_atividade !== filterTipo) return false
      return true
    })
  }, [activities, filterDataDe, filterDataAte, filterTipo])

  const grouped = {
    atrasados:  filteredActivities.filter(a => a.status_atividade === 'pendente' && isOverdue(a.data_agendada, a.hora_agendada)),
    hoje:       filteredActivities.filter(a => a.status_atividade === 'pendente' && a.data_agendada === today && !isOverdue(a.data_agendada, a.hora_agendada)),
    proximos:   filteredActivities.filter(a => a.status_atividade === 'pendente' && a.data_agendada > today),
    concluidos: filteredActivities.filter(a => a.status_atividade === 'concluida'),
  }

  const isFirstRender = useRef(true)
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return }
    if (grouped[activeSection].length > 0) return
    const order: Section[] = ['atrasados', 'hoje', 'proximos', 'concluidos']
    const firstWithData = order.find(key => grouped[key].length > 0)
    if (firstWithData) setActiveSection(firstWithData)
  }, [filterDataDe, filterDataAte, filterTipo]) // eslint-disable-line react-hooks/exhaustive-deps

  const sections: {
    key: Section
    label: string
    icon: typeof CalendarClock
    accent: {
      activeBorder: string
      activeBg: string
      iconBg: string
      iconColor: string
      countColor: string
      dotColor: string
    }
    count: number
  }[] = [
    {
      key: 'atrasados',
      label: 'Atrasados',
      icon: AlertCircle,
      count: grouped.atrasados.length,
      accent: {
        activeBorder: 'border-red-400 ring-2 ring-red-400/20 shadow-md',
        activeBg: 'bg-red-50/40',
        iconBg: 'bg-red-100 text-red-600',
        iconColor: 'text-red-600',
        countColor: grouped.atrasados.length > 0 ? 'text-red-600' : 'text-slate-700',
        dotColor: 'bg-red-500',
      },
    },
    {
      key: 'hoje',
      label: 'Hoje',
      icon: CalendarClock,
      count: grouped.hoje.length,
      accent: {
        activeBorder: 'border-brand-500 ring-2 ring-brand-500/20 shadow-md',
        activeBg: 'bg-brand-50/40',
        iconBg: 'bg-brand-100 text-brand-700',
        iconColor: 'text-brand-700',
        countColor: 'text-slate-900',
        dotColor: 'bg-brand-500',
      },
    },
    {
      key: 'proximos',
      label: 'Próximos',
      icon: Clock,
      count: grouped.proximos.length,
      accent: {
        activeBorder: 'border-blue-400 ring-2 ring-blue-400/20 shadow-md',
        activeBg: 'bg-blue-50/30',
        iconBg: 'bg-blue-100 text-blue-600',
        iconColor: 'text-blue-600',
        countColor: 'text-slate-900',
        dotColor: 'bg-blue-500',
      },
    },
    {
      key: 'concluidos',
      label: 'Concluídos',
      icon: CalendarCheck,
      count: grouped.concluidos.length,
      accent: {
        activeBorder: 'border-slate-400 ring-2 ring-slate-400/20 shadow-md',
        activeBg: 'bg-slate-50',
        iconBg: 'bg-slate-100 text-slate-700',
        iconColor: 'text-slate-700',
        countColor: 'text-slate-700',
        dotColor: 'bg-slate-400',
      },
    },
  ]

  const current = grouped[activeSection]

  return (
    <Layout>
      <div className="px-8 py-8 w-full min-w-0 animate-fade-in">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-slate-950 text-xl font-bold tracking-tight">Follow-ups & Agendamentos</h1>
          <p className="text-slate-600 text-sm mt-0.5">Gerencie ligações, reuniões, mensagens e compromissos com seus leads</p>
        </div>

        {/* Barra de Filtros Customizados */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-3.5 mb-6 shadow-card flex flex-wrap items-center justify-between gap-3">

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Dropdown Customizado: Tipo de atividade */}
            <CustomSelect
              value={filterTipo}
              onChange={val => setFilterTipo(val as ActivityType | '')}
              options={tipoOptions}
              placeholder="Todos os tipos"
              icon={ClipboardList}
            />

            {/* Seletor Customizado de Data com Presets Integrados */}
            <CustomDateRangePicker
              startDate={filterDataDe}
              endDate={filterDataAte}
              onChange={(start, end) => {
                setFilterDataDe(start)
                setFilterDataAte(end)
              }}
              label="Filtrar por data"
            />
          </div>

          {(filterDataDe || filterDataAte || filterTipo) && (
            <button
              onClick={() => { setFilterDataDe(''); setFilterDataAte(''); setFilterTipo('') }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition shadow-2xs cursor-pointer ml-auto"
            >
              <X size={13} />
              Limpar
            </button>
          )}

        </div>

        {/* Cards de Métricas & Seções */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-card overflow-hidden">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl skeleton-shimmer" />
                  <div className="w-16 h-4 rounded-md skeleton-shimmer" />
                </div>
                <div className="w-12 h-8 rounded-lg skeleton-shimmer mb-1" />
                <div className="w-24 h-3.5 rounded skeleton-shimmer" />
              </div>
            ))
          ) : (
            sections.map(({ key, label, icon: Icon, accent, count }, idx) => {
              const isSelected = activeSection === key
              return (
                <button
                  key={key}
                  onClick={() => setActiveSection(key)}
                  className={`text-left bg-white rounded-xl border p-5 transition-all cursor-pointer relative overflow-hidden group shadow-card hover:shadow-card-hover animate-cascade-item ${
                    isSelected
                      ? `${accent.activeBorder} ${accent.activeBg}`
                      : 'border-slate-200/90 hover:border-slate-300'
                  }`}
                  style={{ animationDelay: `${idx * 40}ms` }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className={`w-10 h-10 rounded-xl ${accent.iconBg} flex items-center justify-center shadow-2xs`}>
                      <Icon size={19} className={accent.iconColor} />
                    </div>
                    <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      <span className={`w-2 h-2 rounded-full ${accent.dotColor}`} />
                      {label}
                    </span>
                  </div>
                  <p className={`text-3xl font-extrabold tracking-tight ${accent.countColor}`}>
                    {count}
                  </p>
                  <p className="text-slate-500 text-xs font-medium mt-1">
                    {count === 1 ? 'atividade' : 'atividades'} {
                      key === 'atrasados' ? (count === 1 ? 'pendente' : 'pendentes') :
                      key === 'concluidos' ? (count === 1 ? 'concluída' : 'concluídas') :
                      'na fila'
                    }
                  </p>
                </button>
              )
            })
          )}
        </div>

        {/* Data Table de Follow-ups com Grid Estilo Excel */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-card overflow-hidden">
          {loading ? (
            <div className="divide-y divide-slate-100 p-2 animate-fade-in">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center px-4 py-3.5 gap-4">
                  <div className="w-24 h-6 rounded-full skeleton-shimmer shrink-0" />
                  <div className="space-y-1.5 flex-1 min-w-[200px]">
                    <div className="w-36 h-3.5 rounded skeleton-shimmer" />
                    <div className="w-48 h-3 rounded skeleton-shimmer" />
                  </div>
                  <div className="w-28 h-5 rounded-md skeleton-shimmer shrink-0" />
                  <div className="w-32 h-5 rounded-md skeleton-shimmer shrink-0" />
                  <div className="w-20 h-5 rounded-md skeleton-shimmer shrink-0" />
                  <div className="w-16 h-8 rounded-lg skeleton-shimmer shrink-0" />
                </div>
              ))}
            </div>
          ) : current.length === 0 ? (
            <div className="py-20 text-center">
              <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
                <CalendarCheck size={24} />
              </div>
              <h3 className="text-slate-900 font-bold text-base">Nenhuma atividade nesta seção</h3>
              <p className="text-slate-500 text-xs mt-1">Tudo em dia por aqui! Aproveite para cadastrar novos follow-ups.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse border-b border-slate-200">
                <thead>
                  <tr className="bg-slate-100/90 border-b border-slate-200">
                    <th className="text-[11px] font-bold uppercase tracking-wider text-slate-600 px-5 py-3 border-r border-slate-200/90 select-none">Status</th>
                    <th className="text-[11px] font-bold uppercase tracking-wider text-slate-600 px-4 py-3 border-r border-slate-200/90 select-none">Lead / Contato</th>
                    <th className="text-[11px] font-bold uppercase tracking-wider text-slate-600 px-4 py-3 border-r border-slate-200/90 select-none">Tipo</th>
                    <th className="text-[11px] font-bold uppercase tracking-wider text-slate-600 px-4 py-3 border-r border-slate-200/90 select-none">Agendamento</th>
                    <th className="text-[11px] font-bold uppercase tracking-wider text-slate-600 px-4 py-3 border-r border-slate-200/90 select-none">Conclusão</th>
                    <th className="px-4 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-slate-600 select-none">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {current.map((act, idx) => {
                    const overdue = act.status_atividade === 'pendente' && isOverdue(act.data_agendada, act.hora_agendada)
                    const isToday = act.status_atividade === 'pendente' && act.data_agendada === today && !overdue
                    const effectiveStatus = overdue ? 'atrasada' : act.status_atividade
                    const cfg = activityStatusConfig(effectiveStatus)
                    const TypeIcon = TYPE_ICONS[act.tipo_atividade] || CalendarDays

                    return (
                      <tr
                        key={act.id}
                        className={`transition-colors group animate-cascade-item ${
                          idx % 2 === 1 ? 'bg-slate-50/50 hover:bg-brand-50/30' : 'bg-white hover:bg-brand-50/30'
                        }`}
                        style={{ animationDelay: `${Math.min(idx * 25, 300)}ms` }}
                      >

                        {/* Status Badge */}
                        <td className="px-5 py-3 whitespace-nowrap border-r border-slate-200/80">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border shadow-2xs ${cfg.color} ${cfg.bg} border-current/20`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-current" />
                            {cfg.label}
                          </span>
                        </td>

                        {/* Lead / Contato */}
                        <td className="px-4 py-3 min-w-[220px] border-r border-slate-200/80">
                          <button
                            onClick={() => act.leads && navigate(`/leads?lead=${act.leads.id}`)}
                            className="text-slate-950 font-bold hover:text-brand-600 transition truncate block text-left text-xs"
                          >
                            {act.leads?.nome ?? 'Lead sem nome'}
                          </button>
                          {act.descricao ? (
                            <p className="text-slate-500 text-[11px] mt-0.5 truncate max-w-sm font-medium">{act.descricao}</p>
                          ) : (
                            <span className="text-slate-400 text-[11px] italic">Sem observações adicionais</span>
                          )}
                        </td>

                        {/* Tipo de atividade */}
                        <td className="px-4 py-3 whitespace-nowrap border-r border-slate-200/80">
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-semibold">
                            <TypeIcon size={12} className="text-slate-500" />
                            {activityTypeLabel(act.tipo_atividade)}
                          </span>
                        </td>

                        {/* Agendamento com Chip Visual */}
                        <td className="px-4 py-3 whitespace-nowrap border-r border-slate-200/80">
                          <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md border text-[11px] font-bold font-mono ${
                            overdue
                              ? 'bg-red-50 text-red-700 border-red-200'
                              : isToday
                              ? 'bg-brand-50 text-brand-800 border-brand-200'
                              : 'bg-slate-50 text-slate-700 border-slate-200'
                          }`}>
                            {overdue ? (
                              <AlertCircle size={12} className="text-red-600" />
                            ) : (
                              <Clock size={12} className={isToday ? 'text-brand-600' : 'text-slate-500'} />
                            )}
                            <span>{formatDate(act.data_agendada)}</span>
                            <span className="opacity-40 font-sans">·</span>
                            <span>{act.hora_agendada.slice(0, 5)}</span>
                          </div>
                        </td>

                        {/* Concluído em */}
                        <td className="px-4 py-3 whitespace-nowrap border-r border-slate-200/80">
                          {act.concluido_em ? (
                            <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                              <CheckCircle2 size={12} className="text-emerald-600" />
                              {new Date(act.concluido_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                            </div>
                          ) : (
                            <span className="text-xs font-medium text-slate-400">—</span>
                          )}
                        </td>

                        {/* Botões de Ação */}
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleOpenEdit(act)}
                              className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-slate-100 rounded-lg transition border border-transparent hover:border-slate-200 shadow-2xs cursor-pointer"
                              title="Editar atividade"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              onClick={() => setConfirmDeleteActivity(act)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition border border-transparent hover:border-red-100 shadow-2xs cursor-pointer"
                              title="Excluir atividade"
                            >
                              <Trash2 size={13} />
                            </button>
                            {act.status_atividade === 'pendente' && (
                              <button
                                onClick={() => markDone(act.id)}
                                disabled={markingDone === act.id}
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-600 hover:text-white border border-emerald-200 hover:border-emerald-600 transition-all px-2.5 py-1 rounded-lg shadow-2xs cursor-pointer active:scale-95 disabled:opacity-50 ml-0.5"
                              >
                                {markingDone === act.id ? (
                                  <Loader2 size={12} className="animate-spin" />
                                ) : (
                                  <Check size={12} />
                                )}
                                Concluir
                              </button>
                            )}
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

        {/* Modal: Editar atividade */}
      {editForm && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-scale-in">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-slate-50/60">
              <h2 className="text-slate-950 text-base font-bold">Editar Atividade</h2>
              <button
                onClick={() => setEditForm(null)}
                className="text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
              <div>
                <label className={labelCls}>Tipo de atividade</label>
                <CustomSelect
                  value={editForm.tipo}
                  onChange={val => setEditForm(f => f ? ({ ...f, tipo: val as ActivityType }) : null)}
                  options={activityTypeOptions}
                  placeholder="Selecione a atividade"
                  icon={ListChecks}
                  buttonClassName="w-full"
                />
              </div>
              <div>
                <label className={labelCls}>Status</label>
                <CustomSelect
                  value={editForm.status}
                  onChange={val => setEditForm(f => f ? ({ ...f, status: val as any }) : null)}
                  options={activityStatusOptions}
                  placeholder="Status da atividade"
                  icon={CheckCircle2}
                  buttonClassName="w-full"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Data *</label>
                  <CustomDatePicker
                    value={editForm.data}
                    onChange={val => setEditForm(f => f ? ({ ...f, data: val }) : null)}
                    placeholder="Selecione a data"
                  />
                </div>
                <div>
                  <label className={labelCls}>Hora *</label>
                  <CustomTimePicker
                    value={editForm.hora}
                    onChange={val => setEditForm(f => f ? ({ ...f, hora: val }) : null)}
                    placeholder="Selecione o horário"
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>Descrição</label>
                <TextareaIcon icon={FileText}>
                  <textarea
                    value={editForm.descricao}
                    onChange={e => setEditForm(f => f ? ({ ...f, descricao: e.target.value }) : null)}
                    rows={2}
                    placeholder="Detalhes da atividade..."
                    className={iconTextareaCls}
                  />
                </TextareaIcon>
              </div>
              <div className="flex justify-between items-center gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    const act = activities.find(a => a.id === editForm.id) || editingActivity
                    if (act) setConfirmDeleteActivity(act)
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-red-600 hover:bg-red-50 text-xs font-bold transition cursor-pointer select-none"
                >
                  <Trash2 size={14} />
                  Excluir
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditForm(null)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 transition cursor-pointer shadow-2xs select-none"
                  >
                    <X size={14} className="text-slate-400" />
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={savingEdit || !isEditFormDirty || !editForm.data || !editForm.hora}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200 disabled:cursor-not-allowed border border-emerald-700/50 text-white text-xs font-bold transition shadow-2xs cursor-pointer select-none"
                  >
                    {savingEdit ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    {savingEdit ? 'Salvando...' : 'Salvar Alterações'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmação: Excluir atividade */}
      {confirmDeleteActivity && (
        <ConfirmModal
          title="Excluir Atividade"
          description={
            <>
              Tem certeza que deseja excluir esta atividade de{' '}
              <span className="font-semibold text-slate-800">
                {activityTypeLabel(confirmDeleteActivity.tipo_atividade)}
              </span>
              {confirmDeleteActivity.leads?.nome && (
                <> para o lead <span className="font-semibold text-slate-800">{confirmDeleteActivity.leads.nome}</span></>
              )}? Esta ação não pode ser desfeita.
            </>
          }
          error={deleteError}
          loading={deletingActivity}
          onCancel={() => {
            setConfirmDeleteActivity(null)
            setDeleteError(null)
          }}
          onConfirm={handleConfirmDelete}
        />
      )}

      </div>
    </Layout>
  )
}
