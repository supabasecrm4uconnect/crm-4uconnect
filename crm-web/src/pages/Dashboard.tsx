import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  UserPlus, MessageCircle, FileText,
  CalendarClock, AlertCircle, CheckCircle2, XCircle,
  ArrowRight, TrendingUp, Users, Globe, DollarSign, Wallet, Loader2,
} from 'lucide-react'
import Layout from '../components/Layout'
import StatusBadge from '../components/StatusBadge'
import { supabase } from '../lib/supabase'
import { localDateStr, whatsappLink, formatDateTime, formatCurrency } from '../lib/helpers'

interface Stats {
  total_leads: number
  novos_hoje: number
  em_atendimento: number
  proposta_enviada: number
  followups_hoje: number
  followups_atrasados: number
  fechados: number
  perdidos: number
  valor_negociacao: number
  valor_fechado: number
}

type Period = 'todos' | 'hoje' | '7d' | '30d' | 'mes' | 'custom'

const PERIODS: { key: Period; label: string }[] = [
  { key: 'todos', label: 'Todos' },
  { key: 'hoje',  label: 'Hoje' },
  { key: '7d',    label: '7 dias' },
  { key: '30d',   label: '30 dias' },
  { key: 'mes',   label: 'Este mês' },
  { key: 'custom', label: 'Personalizado' },
]

function dayStartISO(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d, 0, 0, 0, 0).toISOString()
}
function dayEndISO(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d, 23, 59, 59, 999).toISOString()
}
function shiftDays(dateStr: string, delta: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + delta)
  const pad = (x: number) => String(x).padStart(2, '0')
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`
}

interface FollowUp {
  id: string
  tipo_atividade: string
  hora_agendada: string
  descricao: string | null
  leads: { id: string; nome: string; whatsapp: string } | null
}

interface LeadRecente {
  id: string
  nome: string
  status: string
  created_at: string
  lead_sources: { nome: string } | null
}

interface OrigemCount {
  nome: string
  count: number
}

const activityLabel: Record<string, string> = {
  ligar:              'Ligar',
  enviar_mensagem:    'Enviar mensagem',
  retornar_orcamento: 'Retornar orçamento',
  cobrar_resposta:    'Cobrar resposta',
  reuniao:            'Reunião',
  enviar_proposta:    'Enviar proposta',
  pos_venda:          'Pós-venda',
}

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState<Stats>({
    total_leads: 0, novos_hoje: 0, em_atendimento: 0, proposta_enviada: 0,
    followups_hoje: 0, followups_atrasados: 0, fechados: 0, perdidos: 0,
    valor_negociacao: 0, valor_fechado: 0,
  })
  const [followupsHoje, setFollowupsHoje] = useState<FollowUp[]>([])
  const [leadsRecentes, setLeadsRecentes] = useState<LeadRecente[]>([])
  const [origens, setOrigens] = useState<OrigemCount[]>([])
  const [loading, setLoading] = useState(true)
  const [firstName, setFirstName] = useState('')

  const [period, setPeriod] = useState<Period>('todos')
  const [customDe, setCustomDe] = useState('')
  const [customAte, setCustomAte] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const firstLoad = useRef(true)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('profiles').select('nome').eq('id', user.id).single()
        .then(({ data }) => { if (data) setFirstName((data as { nome: string }).nome.split(' ')[0]) })
    })
  }, [])

  useEffect(() => {
    // Calcula o intervalo de datas do período selecionado
    const today = localDateStr()
    let start: string | null = null
    let end: string | null = null
    if (period === 'hoje') { start = dayStartISO(today); end = dayEndISO(today) }
    else if (period === '7d') { start = dayStartISO(shiftDays(today, -6)); end = dayEndISO(today) }
    else if (period === '30d') { start = dayStartISO(shiftDays(today, -29)); end = dayEndISO(today) }
    else if (period === 'mes') { start = dayStartISO(today.slice(0, 8) + '01'); end = dayEndISO(today) }
    else if (period === 'custom') {
      if (customDe) start = dayStartISO(customDe)
      if (customAte) end = dayEndISO(customAte)
    }

    // Aplica o intervalo a uma query de leads (created_at)
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const inRange = (q: any): any => {
      let r = q
      if (start) r = r.gte('created_at', start)
      if (end) r = r.lte('created_at', end)
      return r
    }
    const countLeads = (build?: (q: any) => any): any => {
      let q: any = supabase.from('leads').select('*', { count: 'exact', head: true })
      if (build) q = build(q)
      return inRange(q)
    }
    /* eslint-enable @typescript-eslint/no-explicit-any */

    let cancelled = false
    async function load() {
      if (firstLoad.current) setLoading(true)
      else setRefreshing(true)
      const [
        { count: total_leads },
        { count: novos_hoje },
        { count: em_atendimento },
        { count: proposta_enviada },
        { count: followups_hoje },
        { count: followups_atrasados },
        { count: fechados },
        { count: perdidos },
        { data: atividadesHoje },
        { data: recentes },
        { data: leadsAgg },
      ] = await Promise.all([
        countLeads(),
        supabase.from('leads').select('*', { count: 'exact', head: true }).gte('created_at', dayStartISO(today)),
        countLeads(q => q.eq('status', 'em_atendimento')),
        countLeads(q => q.eq('status', 'proposta_enviada')),
        supabase.from('lead_activities').select('*', { count: 'exact', head: true }).eq('data_agendada', today).eq('status_atividade', 'pendente'),
        supabase.from('lead_activities').select('*', { count: 'exact', head: true }).lt('data_agendada', today).eq('status_atividade', 'pendente'),
        countLeads(q => q.eq('status', 'fechado')),
        countLeads(q => q.eq('status', 'perdido')),
        supabase.from('lead_activities')
          .select('id, tipo_atividade, hora_agendada, descricao, leads(id, nome, whatsapp)')
          .eq('data_agendada', today)
          .eq('status_atividade', 'pendente')
          .order('hora_agendada'),
        supabase.from('leads')
          .select('id, nome, status, created_at, lead_sources(nome)')
          .order('created_at', { ascending: false })
          .limit(5),
        inRange(supabase.from('leads').select('valor, status, lead_sources(nome)')),
      ])

      if (cancelled) return

      // Soma de valores a partir do conjunto do período
      let valorNeg = 0
      let valorFec = 0
      const map: Record<string, number> = {}
      ;(leadsAgg as unknown as { valor: number | null; status: string | null; lead_sources: unknown }[] ?? []).forEach(l => {
        const v = l.valor ?? 0
        if (l.status === 'fechado') valorFec += v
        else if (l.status !== 'perdido') valorNeg += v
        const src = l.lead_sources as { nome: string } | { nome: string }[] | null
        const nome = Array.isArray(src) ? (src[0]?.nome ?? 'Sem origem') : (src?.nome ?? 'Sem origem')
        map[nome] = (map[nome] ?? 0) + 1
      })

      setStats({
        total_leads:          total_leads          ?? 0,
        novos_hoje:           novos_hoje           ?? 0,
        em_atendimento:       em_atendimento       ?? 0,
        proposta_enviada:     proposta_enviada     ?? 0,
        followups_hoje:       followups_hoje       ?? 0,
        followups_atrasados:  followups_atrasados  ?? 0,
        fechados:             fechados             ?? 0,
        perdidos:             perdidos             ?? 0,
        valor_negociacao:     valorNeg,
        valor_fechado:        valorFec,
      })
      setFollowupsHoje((atividadesHoje as unknown as FollowUp[]) ?? [])
      setLeadsRecentes((recentes as unknown as LeadRecente[]) ?? [])
      setOrigens(
        Object.entries(map)
          .map(([nome, count]) => ({ nome, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 6)
      )
      setLoading(false)
      setRefreshing(false)
      firstLoad.current = false
    }

    load()
    return () => { cancelled = true }
  }, [period, customDe, customAte])

  const taxaConversao = (stats.fechados + stats.perdidos) > 0
    ? Math.round((stats.fechados / (stats.fechados + stats.perdidos)) * 100)
    : null

  const maxOrigemCount = origens[0]?.count ?? 1

  const cardsHoje = [
    {
      label: period === 'todos' ? 'Total de leads' : 'Leads no período',
      value: stats.total_leads,
      icon: Users,
      color: 'text-slate-600',
      bg: 'bg-slate-100',
      highlight: false,
      to: '/leads',
    },
    {
      label: 'Novos hoje',
      value: stats.novos_hoje,
      icon: UserPlus,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      highlight: false,
      to: null,
    },
    {
      label: 'Follow-ups hoje',
      value: stats.followups_hoje,
      icon: CalendarClock,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      highlight: false,
      to: '/followups',
    },
    {
      label: 'Atrasados',
      value: stats.followups_atrasados,
      icon: AlertCircle,
      color: stats.followups_atrasados > 0 ? 'text-red-600' : 'text-slate-400',
      bg:    stats.followups_atrasados > 0 ? 'bg-red-50'   : 'bg-slate-100',
      highlight: stats.followups_atrasados > 0,
      to: '/followups',
    },
  ]

  const cardsPipeline = [
    { label: 'Em atendimento',  value: stats.em_atendimento,  icon: MessageCircle, color: 'text-blue-600',    bg: 'bg-blue-50',    status: 'em_atendimento'  },
    { label: 'Proposta enviada',value: stats.proposta_enviada, icon: FileText,      color: 'text-violet-600',  bg: 'bg-violet-50',  status: 'proposta_enviada' },
    { label: 'Fechados',        value: stats.fechados,         icon: CheckCircle2,  color: 'text-emerald-600', bg: 'bg-emerald-50', status: 'fechado'          },
    { label: 'Perdidos',        value: stats.perdidos,         icon: XCircle,       color: 'text-slate-400',   bg: 'bg-slate-100',  status: 'perdido'          },
  ]

  const skeletonCard = (
    <div className="bg-white rounded-xl border border-slate-100 p-5 animate-pulse">
      <div className="w-8 h-8 rounded-lg bg-slate-100 mb-4" />
      <div className="h-7 w-12 bg-slate-100 rounded mb-1" />
      <div className="h-4 w-24 bg-slate-100 rounded" />
    </div>
  )

  return (
    <Layout>
      <div className="px-8 py-8">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-slate-900 text-xl font-semibold">
            {greeting()}{firstName ? `, ${firstName}` : ''}!
          </h1>
          <p className="text-slate-500 text-sm mt-0.5 capitalize">
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        {/* Filtro de período */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <div className="flex items-center bg-slate-100 rounded-lg p-1 gap-0.5">
            {PERIODS.map(p => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                  period === p.key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          {period === 'custom' && (
            <div className="flex items-center gap-1.5">
              <input type="date" value={customDe} onChange={e => setCustomDe(e.target.value)} title="De"
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition" />
              <span className="text-slate-400 text-sm">até</span>
              <input type="date" value={customAte} onChange={e => setCustomAte(e.target.value)} title="Até"
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition" />
            </div>
          )}
          {refreshing && <Loader2 size={14} className="text-slate-400 animate-spin" />}
        </div>

        {loading ? (
          <div className="space-y-6">
            <div className="grid grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <div key={i}>{skeletonCard}</div>)}</div>
            <div className="grid grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <div key={i}>{skeletonCard}</div>)}</div>
          </div>
        ) : (
          <>
            {/* Seção: Hoje */}
            <div className="mb-6">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Hoje</p>
              <div className="grid grid-cols-4 gap-4">
                {cardsHoje.map(({ label, value, icon: Icon, color, bg, highlight, to }) => (
                  <div
                    key={label}
                    onClick={() => to && navigate(to)}
                    className={`bg-white rounded-xl border p-5 transition-shadow hover:shadow-md ${
                      highlight ? 'border-red-200 shadow-sm' : 'border-slate-100'
                    } ${to ? 'cursor-pointer' : ''}`}
                  >
                    <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center mb-4`}>
                      <Icon size={16} className={color} />
                    </div>
                    <p className={`text-2xl font-semibold ${highlight ? 'text-red-600' : 'text-slate-900'}`}>{value}</p>
                    <p className="text-slate-500 text-sm mt-0.5">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Seção: Pipeline */}
            <div className="mb-6">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Pipeline</p>
              <div className="grid grid-cols-4 gap-4">
                {cardsPipeline.map(({ label, value, icon: Icon, color, bg, status }) => (
                  <div
                    key={label}
                    onClick={() => navigate(`/leads?status=${status}`)}
                    className="bg-white rounded-xl border border-slate-100 p-5 transition-shadow hover:shadow-md cursor-pointer group"
                  >
                    <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center mb-4`}>
                      <Icon size={16} className={color} />
                    </div>
                    <p className="text-slate-900 text-2xl font-semibold">{value}</p>
                    <div className="flex items-center justify-between mt-0.5">
                      <p className="text-slate-500 text-sm">{label}</p>
                      <ArrowRight size={12} className="text-slate-300 group-hover:text-slate-400 transition" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Valores */}
            <div className="mb-6">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Valores {period !== 'todos' && '(no período)'}</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded-xl border border-slate-100 p-5">
                  <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center mb-4">
                    <Wallet size={16} className="text-amber-600" />
                  </div>
                  <p className="text-slate-900 text-2xl font-semibold tabular-nums">{formatCurrency(stats.valor_negociacao) || 'R$ 0,00'}</p>
                  <p className="text-slate-500 text-sm mt-0.5">Em negociação</p>
                </div>
                <div className="bg-white rounded-xl border border-slate-100 p-5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center mb-4">
                    <DollarSign size={16} className="text-emerald-600" />
                  </div>
                  <p className="text-slate-900 text-2xl font-semibold tabular-nums">{formatCurrency(stats.valor_fechado) || 'R$ 0,00'}</p>
                  <p className="text-slate-500 text-sm mt-0.5">Fechado</p>
                </div>
              </div>
            </div>

            {/* Taxa de conversão */}
            {taxaConversao !== null && (
              <div className="bg-white rounded-xl border border-slate-100 px-6 py-4 mb-6 flex items-center gap-6">
                <div className="flex items-center gap-2 shrink-0">
                  <TrendingUp size={15} className={taxaConversao >= 50 ? 'text-emerald-500' : 'text-amber-500'} />
                  <span className="text-sm font-medium text-slate-700">Taxa de conversão</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${taxaConversao >= 50 ? 'bg-emerald-500' : 'bg-amber-400'}`}
                      style={{ width: `${taxaConversao}%` }}
                    />
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <span className={`text-sm font-semibold ${taxaConversao >= 50 ? 'text-emerald-600' : 'text-amber-600'}`}>{taxaConversao}%</span>
                  <p className="text-slate-400 text-xs">{stats.fechados} de {stats.fechados + stats.perdidos}</p>
                </div>
              </div>
            )}

            {/* Leads recentes + Por origem */}
            {(leadsRecentes.length > 0 || origens.length > 0) && (
              <div className="grid grid-cols-5 gap-4 mb-6">

                {/* Leads recentes */}
                {leadsRecentes.length > 0 && (
                  <div className="col-span-3 bg-white rounded-xl border border-slate-100">
                    <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                      <h2 className="text-slate-900 text-sm font-semibold">Leads recentes</h2>
                      <button
                        onClick={() => navigate('/leads')}
                        className="flex items-center gap-1 text-emerald-600 text-xs font-medium hover:text-emerald-700 transition"
                      >
                        Ver todos <ArrowRight size={12} />
                      </button>
                    </div>
                    <div className="divide-y divide-slate-50">
                      {leadsRecentes.map(lead => (
                        <div
                          key={lead.id}
                          onClick={() => navigate(`/leads?lead=${lead.id}`)}
                          className="px-6 py-3 flex items-center justify-between hover:bg-slate-50 transition cursor-pointer"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-slate-900 text-sm font-medium truncate">{lead.nome}</p>
                            <p className="text-slate-400 text-xs mt-0.5">
                              {lead.lead_sources?.nome ?? 'Sem origem'} · {formatDateTime(lead.created_at)}
                            </p>
                          </div>
                          <div className="ml-4 shrink-0">
                            <StatusBadge status={lead.status} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Por origem */}
                {origens.length > 0 && (
                  <div className="col-span-2 bg-white rounded-xl border border-slate-100">
                    <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
                      <Globe size={14} className="text-slate-400" />
                      <h2 className="text-slate-900 text-sm font-semibold">Por origem</h2>
                    </div>
                    <div className="px-6 py-4 space-y-3.5">
                      {origens.map(({ nome, count }) => (
                        <div key={nome}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-slate-700 text-xs font-medium truncate max-w-[140px]">{nome}</span>
                            <span className="text-slate-500 text-xs tabular-nums ml-2">{count}</span>
                          </div>
                          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-400 rounded-full transition-all duration-500"
                              style={{ width: `${Math.round((count / maxOrigemCount) * 100)}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            )}
          </>
        )}

        {/* Follow-ups de hoje */}
        <div className="bg-white rounded-xl border border-slate-100">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <h2 className="text-slate-900 text-sm font-semibold">Follow-ups de hoje</h2>
              {followupsHoje.length > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                  {followupsHoje.length}
                </span>
              )}
            </div>
            <button
              onClick={() => navigate('/followups')}
              className="flex items-center gap-1 text-emerald-600 text-xs font-medium hover:text-emerald-700 transition"
            >
              Ver todos <ArrowRight size={12} />
            </button>
          </div>

          {followupsHoje.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <CalendarClock size={28} className="text-slate-200 mx-auto mb-3" />
              <p className="text-slate-600 text-sm font-medium">Agenda limpa para hoje!</p>
              <p className="text-slate-400 text-xs mt-1">Nenhum follow-up pendente agendado.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {followupsHoje.map(item => (
                <div
                  key={item.id}
                  onClick={() => item.leads?.id && navigate(`/leads?lead=${item.leads.id}`)}
                  className="px-6 py-3.5 flex items-center justify-between hover:bg-slate-50 transition cursor-pointer"
                >
                  <div className="min-w-0">
                    <p className="text-slate-900 text-sm font-medium truncate">{item.leads?.nome ?? '—'}</p>
                    <p className="text-slate-500 text-xs mt-0.5">
                      {activityLabel[item.tipo_atividade] ?? item.tipo_atividade}
                      {item.descricao ? ` · ${item.descricao}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-4">
                    <span className="text-slate-400 text-xs tabular-nums">{item.hora_agendada?.slice(0, 5) ?? '--:--'}</span>
                    {item.leads?.whatsapp && (
                      <a
                        href={whatsappLink(item.leads.whatsapp)}
                        target="_blank"
                        rel="noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="text-emerald-400 hover:text-emerald-600 transition"
                        title="Abrir no WhatsApp"
                      >
                        <MessageCircle size={14} />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </Layout>
  )
}
