import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarClock, CheckCircle2, AlertCircle, Clock, CalendarCheck, Loader2 } from 'lucide-react'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabase'
import { activityTypeLabel, activityStatusConfig, formatDate, isOverdue, localDateStr } from '../lib/helpers'
import type { LeadActivity } from '../types'

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
    await supabase.from('lead_activities').update({
      status_atividade: 'concluida',
      concluido_em: new Date().toISOString(),
    }).eq('id', id)
    await loadActivities()
    setMarkingDone(null)
  }

  const today = localDateStr()

  const grouped = {
    atrasados:  activities.filter(a => a.status_atividade === 'pendente' && a.data_agendada < today),
    hoje:       activities.filter(a => a.status_atividade === 'pendente' && a.data_agendada === today),
    proximos:   activities.filter(a => a.status_atividade === 'pendente' && a.data_agendada > today),
    concluidos: activities.filter(a => a.status_atividade === 'concluida'),
  }

  const sections: { key: Section; label: string; icon: typeof CalendarClock; iconColor: string; count: number }[] = [
    { key: 'atrasados',  label: 'Atrasados',  icon: AlertCircle,   iconColor: 'text-red-500',    count: grouped.atrasados.length  },
    { key: 'hoje',       label: 'Hoje',        icon: CalendarClock, iconColor: 'text-amber-500',  count: grouped.hoje.length       },
    { key: 'proximos',   label: 'Próximos',    icon: Clock,         iconColor: 'text-blue-500',   count: grouped.proximos.length   },
    { key: 'concluidos', label: 'Concluídos',  icon: CalendarCheck, iconColor: 'text-emerald-500',count: grouped.concluidos.length },
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

        {/* Section tabs */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {sections.map(({ key, label, icon: Icon, iconColor, count }) => (
            <button
              key={key}
              onClick={() => setActiveSection(key)}
              className={`flex items-center gap-3 px-4 py-4 rounded-xl border text-left transition ${
                activeSection === key
                  ? 'bg-white border-emerald-200 shadow-sm'
                  : 'bg-white border-slate-100 hover:border-slate-200'
              }`}
            >
              <Icon size={18} className={iconColor} />
              <div>
                <p className={`text-lg font-semibold ${activeSection === key ? 'text-slate-900' : 'text-slate-700'}`}>{count}</p>
                <p className="text-xs text-slate-500">{label}</p>
              </div>
            </button>
          ))}
        </div>

        {/* List */}
        <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={20} className="text-slate-300 animate-spin" />
            </div>
          ) : current.length === 0 ? (
            <div className="py-16 text-center">
              <CalendarCheck size={24} className="text-slate-300 mx-auto mb-2" />
              <p className="text-slate-400 text-sm">Nenhuma atividade aqui.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {current.map(act => {
                const overdue = act.status_atividade === 'pendente' && isOverdue(act.data_agendada)
                const effectiveStatus = overdue ? 'atrasada' : act.status_atividade
                const cfg = activityStatusConfig[effectiveStatus]
                return (
                  <div key={act.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition">
                    <div className="flex items-start gap-4 min-w-0">
                      <div className="shrink-0 mt-0.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color} ${cfg.bg}`}>
                          {cfg.label}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <button
                          onClick={() => act.leads && navigate(`/leads?lead=${act.leads.id}`)}
                          className="text-slate-900 text-sm font-medium hover:text-emerald-600 transition truncate block"
                        >
                          {act.leads?.nome ?? '—'}
                        </button>
                        <p className="text-slate-600 text-sm">{activityTypeLabel[act.tipo_atividade]}</p>
                        {act.descricao && <p className="text-slate-400 text-xs mt-0.5 truncate">{act.descricao}</p>}
                      </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0 ml-4">
                      <div className="text-right">
                        <p className={`text-sm font-medium ${overdue ? 'text-red-500' : 'text-slate-700'}`}>
                          {formatDate(act.data_agendada)}
                        </p>
                        <p className="text-xs text-slate-400">{act.hora_agendada.slice(0, 5)}</p>
                      </div>

                      {act.status_atividade === 'pendente' && (
                        <button
                          onClick={() => markDone(act.id)}
                          disabled={markingDone === act.id}
                          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-emerald-600 transition px-3 py-2 rounded-lg hover:bg-emerald-50 disabled:opacity-50"
                        >
                          {markingDone === act.id
                            ? <Loader2 size={13} className="animate-spin" />
                            : <CheckCircle2 size={13} />}
                          Concluir
                        </button>
                      )}

                      {act.status_atividade === 'concluida' && act.concluido_em && (
                        <p className="text-xs text-slate-400">
                          {new Date(act.concluido_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
