import { useEffect, useState, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarClock, CheckCircle2, AlertCircle, Clock, CalendarCheck, Loader2, CalendarDays, ClipboardList, X } from 'lucide-react'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabase'
import { activityTypeLabel, allActivityTypes, activityStatusConfig, formatDate, isOverdue, localDateStr } from '../lib/helpers'
import { recalcProximoFollowup } from '../lib/leadFollowup'
import { InputIcon } from '../components/FieldIcon'
import TableRowSkeleton from '../components/TableRowSkeleton'
import type { LeadActivity, ActivityType } from '../types'

type Section = 'atrasados' | 'hoje' | 'proximos' | 'concluidos'

interface ActivityWithLead extends LeadActivity {
  leads: { id: string; nome: string; whatsapp: string } | null
}

export default function FollowUps() {
  const navigate = useNavigate()
  const [activities, setActivities] = useState<ActivityWithLead[]>([])
  const [loading, setLoading] = useState(true)
  const [activeSection, setActiveSection] = useState<Section>('hoje')
  const [markingDone, setMarkingDone] = useState<string | null>(null)
  const [filterDataDe, setFilterDataDe] = useState('')
  const [filterDataAte, setFilterDataAte] = useState('')
  const [filterTipo, setFilterTipo] = useState<ActivityType | ''>('')

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

  const today = localDateStr()

  const filteredActivities = useMemo(() => {
    return activities.filter(a => {
      if (filterDataDe && a.data_agendada < filterDataDe) return false
      if (filterDataAte && a.data_agendada > filterDataAte) return false
      if (filterTipo && a.tipo_atividade !== filterTipo) return false
      return true
    })
  }, [activities, filterDataDe, filterDataAte, filterTipo])

  const grouped = {
    atrasados:  filteredActivities.filter(a => a.status_atividade === 'pendente' && a.data_agendada < today),
    hoje:       filteredActivities.filter(a => a.status_atividade === 'pendente' && a.data_agendada === today),
    proximos:   filteredActivities.filter(a => a.status_atividade === 'pendente' && a.data_agendada > today),
    concluidos: filteredActivities.filter(a => a.status_atividade === 'concluida'),
  }

  // Se o filtro esvaziar a aba atual mas outra tiver resultado, pula automaticamente
  // pra primeira aba com dados — evita a impressão de que o filtro "não funcionou".
  const isFirstRender = useRef(true)
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return }
    if (grouped[activeSection].length > 0) return
    const order: Section[] = ['atrasados', 'hoje', 'proximos', 'concluidos']
    const firstWithData = order.find(key => grouped[key].length > 0)
    if (firstWithData) setActiveSection(firstWithData)
  }, [filterDataDe, filterDataAte, filterTipo]) // eslint-disable-line react-hooks/exhaustive-deps

  const sections: { key: Section; label: string; icon: typeof CalendarClock; iconColor: string; bg: string; count: number }[] = [
    { key: 'atrasados',  label: 'Atrasados',  icon: AlertCircle,   iconColor: 'text-slate-600', bg: 'bg-slate-100', count: grouped.atrasados.length  },
    { key: 'hoje',       label: 'Hoje',       icon: CalendarClock, iconColor: 'text-slate-600', bg: 'bg-slate-100', count: grouped.hoje.length       },
    { key: 'proximos',   label: 'Próximos',   icon: Clock,         iconColor: 'text-slate-600', bg: 'bg-slate-100', count: grouped.proximos.length   },
    { key: 'concluidos', label: 'Concluídos', icon: CalendarCheck, iconColor: 'text-slate-600', bg: 'bg-slate-100', count: grouped.concluidos.length },
  ]

  const current = grouped[activeSection]

  return (
    <Layout>
      <div className="px-8 py-8">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-slate-900 text-xl font-semibold">Follow-ups</h1>
          <p className="text-slate-500 text-sm mt-0.5">Acompanhe todas as atividades agendadas</p>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-2.5 mb-6">
          <InputIcon icon={ClipboardList}>
            <select
              value={filterTipo}
              onChange={e => setFilterTipo(e.target.value as ActivityType | '')}
              className="pl-10 pr-3.5 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
            >
              <option value="">Todos os tipos</option>
              {allActivityTypes().map(at => <option key={at.value} value={at.value}>{at.label}</option>)}
            </select>
          </InputIcon>
          <div className="flex items-center gap-1.5">
            <InputIcon icon={CalendarDays}>
              <input
                type="date"
                value={filterDataDe}
                onChange={e => setFilterDataDe(e.target.value)}
                title="Agendado de"
                className="pl-9 pr-2 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
              />
            </InputIcon>
            <span className="text-slate-400 text-sm">até</span>
            <InputIcon icon={CalendarDays}>
              <input
                type="date"
                value={filterDataAte}
                onChange={e => setFilterDataAte(e.target.value)}
                title="Agendado até"
                className="pl-9 pr-2 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
              />
            </InputIcon>
          </div>
          {(filterDataDe || filterDataAte || filterTipo) && (
            <button
              onClick={() => { setFilterDataDe(''); setFilterDataAte(''); setFilterTipo('') }}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-500 hover:bg-slate-50 transition"
            >
              <X size={13} />
              Limpar
            </button>
          )}
        </div>

        {/* Section tabs */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-slate-100 p-5 animate-pulse">
                <div className="w-8 h-8 rounded-lg bg-slate-100 mb-4" />
                <div className="h-7 w-8 bg-slate-100 rounded mb-1" />
                <div className="h-4 w-20 bg-slate-100 rounded" />
              </div>
            ))
          ) : (
            sections.map(({ key, label, icon: Icon, iconColor, bg, count }) => (
              <button
                key={key}
                onClick={() => setActiveSection(key)}
                className={`text-left bg-white rounded-xl border p-5 transition-shadow hover:shadow-md ${
                  activeSection === key ? 'border-emerald-200 shadow-sm' : 'border-slate-100'
                }`}
              >
                <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center mb-4`}>
                  <Icon size={16} className={iconColor} />
                </div>
                <p className={`text-2xl font-semibold truncate ${activeSection === key ? 'text-slate-900' : 'text-slate-700'}`}>{count}</p>
                <p className="text-slate-500 text-sm mt-0.5 truncate">{label}</p>
              </button>
            ))
          )}
        </div>

        {/* List */}
        <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
          {loading ? (
            <TableRowSkeleton
              rows={6}
              cols={[
                { width: 'w-16', height: 'h-5' },
                { width: 'w-32' },
                { width: 'w-28' },
                { width: 'w-24' },
                { width: 'w-20' },
              ]}
            />
          ) : current.length === 0 ? (
            <div className="py-16 text-center">
              <CalendarCheck size={24} className="text-slate-300 mx-auto mb-2" />
              <p className="text-slate-400 text-sm">Nenhuma atividade aqui.</p>
            </div>
          ) : (
            <table className="w-full animate-fade-in">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left text-xs font-medium text-slate-500 px-6 py-3.5">Status</th>
                  <th className="text-left text-xs font-medium text-slate-500 px-4 py-3.5">Lead</th>
                  <th className="text-left text-xs font-medium text-slate-500 px-4 py-3.5">Tipo de atividade</th>
                  <th className="text-left text-xs font-medium text-slate-500 px-4 py-3.5">Agendado</th>
                  <th className="text-left text-xs font-medium text-slate-500 px-4 py-3.5">Concluído em</th>
                  <th className="px-4 py-3.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {current.map(act => {
                  const overdue = act.status_atividade === 'pendente' && isOverdue(act.data_agendada)
                  const effectiveStatus = overdue ? 'atrasada' : act.status_atividade
                  const cfg = activityStatusConfig(effectiveStatus)
                  return (
                    <tr key={act.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color} ${cfg.bg}`}>
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-4 min-w-0">
                        <button
                          onClick={() => act.leads && navigate(`/leads?lead=${act.leads.id}`)}
                          className="text-slate-900 text-sm font-medium hover:text-emerald-600 transition truncate block"
                        >
                          {act.leads?.nome ?? '—'}
                        </button>
                        {act.descricao && <p className="text-slate-400 text-xs mt-0.5 truncate max-w-xs">{act.descricao}</p>}
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-600">{activityTypeLabel(act.tipo_atividade)}</td>
                      <td className="px-4 py-4">
                        <div className={`flex items-center gap-1.5 text-sm font-medium whitespace-nowrap ${overdue ? 'text-red-500' : 'text-slate-700'}`}>
                          <CalendarDays size={13} className={overdue ? 'text-red-400' : 'text-slate-400'} />
                          {formatDate(act.data_agendada)} · {act.hora_agendada.slice(0, 5)}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        {act.concluido_em ? (
                          <div className="flex items-center gap-1.5 text-sm text-slate-500 whitespace-nowrap">
                            <CheckCircle2 size={13} className="text-emerald-500" />
                            {new Date(act.concluido_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </div>
                        ) : (
                          <span className="text-sm text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        {act.status_atividade === 'pendente' && (
                          <button
                            onClick={() => markDone(act.id)}
                            disabled={markingDone === act.id}
                            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-emerald-600 transition px-3 py-2 rounded-lg hover:bg-emerald-50 disabled:opacity-50 whitespace-nowrap"
                          >
                            {markingDone === act.id
                              ? <Loader2 size={13} className="animate-spin" />
                              : <CheckCircle2 size={13} />}
                            Concluir
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Layout>
  )
}
