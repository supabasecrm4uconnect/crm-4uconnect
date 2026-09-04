import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  UserPlus,
  CalendarClock, CheckCircle2,
  ArrowRight, TrendingUp, Users, Globe, DollarSign, Wallet, Loader2, Briefcase,
} from 'lucide-react'
import Layout from '../components/Layout'
import StatusBadge from '../components/StatusBadge'
import LeadAvatar from '../components/LeadAvatar'
import CustomDateRangePicker from '../components/CustomDateRangePicker'
import DashboardSkeleton from '../components/skeletons/DashboardSkeleton'
import { supabase } from '../lib/supabase'
import { localDateStr, formatDateTime, formatCurrency, formatDate } from '../lib/helpers'

interface Stats {
  total_leads: number
  novos_hoje: number
  em_negociacao: number
  followups_hoje: number
  followups_atrasados: number
  concluidos_hoje: number
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

interface LeadRecente {
  id: string
  nome: string
  status: string
  created_at: string
  foto_url: string | null
  lead_sources: { nome: string } | null
}

interface OrigemCount {
  nome: string
  count: number
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
    total_leads: 0, novos_hoje: 0, em_negociacao: 0,
    followups_hoje: 0, followups_atrasados: 0, concluidos_hoje: 0, fechados: 0, perdidos: 0,
    valor_negociacao: 0, valor_fechado: 0,
  })
  const [leadsRecentes, setLeadsRecentes] = useState<LeadRecente[]>([])
  const [origens, setOrigens] = useState<OrigemCount[]>([])
  const [loading, setLoading] = useState(true)
  const [firstName, setFirstName] = useState('')

  const [period, setPeriod] = useState<Period>('hoje')
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

    let cancelled = false
    async function load() {
      if (firstLoad.current) setLoading(true)
      else setRefreshing(true)

      // Query para desfechos no período (fechados / perdidos)
      let fechadosQuery = supabase.from('leads').select('*', { count: 'exact', head: true }).eq('status', 'fechado')
      let perdidosQuery = supabase.from('leads').select('*', { count: 'exact', head: true }).eq('status', 'perdido')
      if (start) {
        fechadosQuery = fechadosQuery.gte('updated_at', start)
        perdidosQuery = perdidosQuery.gte('updated_at', start)
      }
      if (end) {
        fechadosQuery = fechadosQuery.lte('updated_at', end)
        perdidosQuery = perdidosQuery.lte('updated_at', end)
      }

      // Query de total de leads no período
      let totalLeadsQuery = supabase.from('leads').select('*', { count: 'exact', head: true })
      if (period !== 'todos') {
        if (start) totalLeadsQuery = totalLeadsQuery.gte('created_at', start)
        if (end) totalLeadsQuery = totalLeadsQuery.lte('created_at', end)
      }

      const [
        { count: total_leads },
        { count: novos_hoje },
        { count: followups_hoje },
        { count: followups_atrasados },
        { count: concluidos_hoje },
        { count: fechados },
        { count: perdidos },
        { data: recentes },
        { data: allLeadsData },
      ] = await Promise.all([
        totalLeadsQuery,
        supabase.from('leads').select('*', { count: 'exact', head: true }).gte('created_at', dayStartISO(today)),
        // Follow-ups
        supabase.from('lead_activities').select('*', { count: 'exact', head: true }).eq('data_agendada', today).eq('status_atividade', 'pendente'),
        supabase.from('lead_activities').select('*', { count: 'exact', head: true }).lt('data_agendada', today).eq('status_atividade', 'pendente'),
        supabase.from('lead_activities').select('*', { count: 'exact', head: true }).eq('status_atividade', 'concluida').gte('concluido_em', dayStartISO(today)).lte('concluido_em', dayEndISO(today)),
        // Desfechos do período
        fechadosQuery,
        perdidosQuery,
        // Listas
        supabase.from('leads')
          .select('id, nome, status, created_at, foto_url, lead_sources(nome)')
          .order('created_at', { ascending: false })
          .limit(5),
        // Agregação financeira e de canais
        supabase.from('leads').select('valor, status, created_at, updated_at, lead_sources(nome)'),
      ])

      if (cancelled) return

      let valorNeg = 0
      let valorFec = 0
      let countNeg = 0
      const map: Record<string, number> = {}

      ;(allLeadsData as unknown as {
        valor: number | null
        status: string | null
        created_at: string
        updated_at: string
        lead_sources: unknown
      }[] ?? []).forEach(l => {
        const v = l.valor ?? 0
        const isClosed = l.status === 'fechado'
        const isLost = l.status === 'perdido'

        // 1. Pipeline ativo em negociação (tudo que não está finalizado)
        if (!isClosed && !isLost) {
          valorNeg += v
          countNeg += 1
        }

        // 2. Vendas fechadas no período selecionado
        if (isClosed) {
          if (period === 'todos') {
            valorFec += v
          } else {
            const up = l.updated_at || l.created_at
            const matchesStart = !start || up >= start
            const matchesEnd = !end || up <= end
            if (matchesStart && matchesEnd) {
              valorFec += v
            }
          }
        }

        // 3. Canais / Origens de leads criados no período
        const matchesCreatedStart = !start || l.created_at >= start
        const matchesCreatedEnd = !end || l.created_at <= end
        if (period === 'todos' || (matchesCreatedStart && matchesCreatedEnd)) {
          const src = l.lead_sources as { nome: string } | { nome: string }[] | null
          const nome = Array.isArray(src) ? (src[0]?.nome ?? 'Sem origem') : (src?.nome ?? 'Sem origem')
          map[nome] = (map[nome] ?? 0) + 1
        }
      })

      setStats({
        total_leads:          total_leads          ?? 0,
        novos_hoje:           novos_hoje           ?? 0,
        em_negociacao:        countNeg,
        followups_hoje:       followups_hoje       ?? 0,
        followups_atrasados:  followups_atrasados  ?? 0,
        concluidos_hoje:      concluidos_hoje      ?? 0,
        fechados:             fechados             ?? 0,
        perdidos:             perdidos             ?? 0,
        valor_negociacao:     valorNeg,
        valor_fechado:        valorFec,
      })
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

  const totalDesfechos = stats.fechados + stats.perdidos
  const taxaConversao = totalDesfechos > 0
    ? Math.round((stats.fechados / totalDesfechos) * 100)
    : 0

  const maxOrigemCount = origens[0]?.count ?? 1

  function handleSelectPreset(key: Period) {
    setPeriod(key)
    setCustomDe('')
    setCustomAte('')
  }

  const periodLabel = period === 'todos'
    ? 'Operacional'
    : period === 'custom'
      ? customDe && customAte
        ? `(${formatDate(customDe)} a ${formatDate(customAte)})`
        : '(personalizado)'
      : `(${PERIODS.find(p => p.key === period)?.label.toLowerCase()})`

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
                onClick={() => handleSelectPreset(p.key)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                  period === p.key ? 'bg-white text-slate-800 shadow-sm font-semibold' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <CustomDateRangePicker
            startDate={customDe}
            endDate={customAte}
            onChange={(start, end) => {
              if (start || end) {
                setPeriod('custom')
                setCustomDe(start)
                setCustomAte(end)
              } else {
                setPeriod('hoje')
                setCustomDe('')
                setCustomAte('')
              }
            }}
            label="Filtrar por data"
            buttonClassName={period === 'custom' ? 'bg-white text-slate-900 border-slate-300 shadow-sm font-semibold' : ''}
          />

          {refreshing && <Loader2 size={14} className="text-slate-400 animate-spin" />}
        </div>

        {loading ? (
          <DashboardSkeleton />
        ) : (
          <div>
            {/* Bloco 1 (Operacional) + Bloco 2 (Valores) em Grid Integrado e Sólido */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6 items-stretch">

              {/* Bloco 1: Atividade Diária & Funil de Leads (col-span-2) */}
              <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-card overflow-hidden flex flex-col justify-between animate-cascade-item">

                {/* Header do Bloco 1 (h-12 com tipografia limpa) */}
                <div className="h-12 px-5 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-white">
                    Atividade & Funil {periodLabel}
                  </h2>
                  <span className="text-[11px] font-semibold text-slate-300 bg-slate-800/80 px-2.5 py-0.5 rounded-md border border-slate-700">
                    Fluxo Comercial
                  </span>
                </div>

                {/* Grid Integrado de Métricas com Linhas Nítidas */}
                <div className="divide-y divide-slate-200 flex-1 flex flex-col justify-between">

                  {/* Linha 1: Leads e Follow-ups */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 flex-1">

                    {/* Célula 1: Total de Leads */}
                    <div
                      onClick={() => navigate('/leads')}
                      className="p-5 hover:bg-slate-50/70 transition cursor-pointer group flex flex-col justify-between"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center shadow-xs">
                          <Users size={15} />
                        </div>
                        <span className="text-[11px] font-semibold text-slate-400 group-hover:text-brand-600 transition flex items-center gap-0.5">
                          Ver lista <ArrowRight size={11} />
                        </span>
                      </div>
                      <div>
                        <p className="text-2xl font-black text-slate-900 tracking-tight">{stats.total_leads}</p>
                        <p className="text-xs font-bold text-slate-500 mt-0.5">{period === 'todos' ? 'Total de leads' : 'Leads no período'}</p>
                      </div>
                    </div>

                    {/* Célula 2: Novos Hoje */}
                    <div className="p-5 hover:bg-slate-50/70 transition flex flex-col justify-between">
                      <div className="flex items-center justify-between mb-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center shadow-xs">
                          <UserPlus size={15} />
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                          Hoje
                        </span>
                      </div>
                      <div>
                        <p className="text-2xl font-black text-slate-900 tracking-tight">{stats.novos_hoje}</p>
                        <p className="text-xs font-bold text-slate-500 mt-0.5">Novos contatos</p>
                      </div>
                    </div>

                    {/* Célula 3: Follow-ups (Ocupa 2 colunas) */}
                    <div
                      onClick={() => navigate('/followups')}
                      className={`sm:col-span-2 p-5 hover:bg-slate-50/70 transition cursor-pointer group flex flex-col justify-between ${
                        stats.followups_atrasados > 0 ? 'bg-red-50/20' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center shadow-xs">
                            <CalendarClock size={15} />
                          </div>
                          <span className="text-xs font-bold text-slate-800">Follow-ups</span>
                        </div>
                        <span className="text-[11px] font-semibold text-slate-400 group-hover:text-brand-600 transition flex items-center gap-0.5">
                          Abrir agenda <ArrowRight size={11} />
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 divide-x divide-slate-200 pt-1">
                        <div className="pr-2">
                          <p className="text-xl font-black text-slate-900 tracking-tight">{stats.followups_hoje}</p>
                          <p className="text-[11px] font-semibold text-slate-500 mt-0.5">Para Hoje</p>
                        </div>
                        <div className="px-2">
                          <p className={`text-xl font-black tracking-tight ${stats.followups_atrasados > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                            {stats.followups_atrasados}
                          </p>
                          <p className="text-[11px] font-semibold text-slate-500 mt-0.5">Atrasados</p>
                        </div>
                        <div className="pl-2">
                          <p className="text-xl font-black text-emerald-600 tracking-tight">{stats.concluidos_hoje}</p>
                          <p className="text-[11px] font-semibold text-slate-500 mt-0.5">Concluídos</p>
                        </div>
                      </div>
                    </div>

                  </div>

                  {/* Linha 2: Pipeline Ativo e Desfechos (2 colunas + 2 colunas) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 flex-1">

                    {/* Célula 4: Em Negociação / Funil Ativo */}
                    <div
                      onClick={() => navigate('/leads')}
                      className="p-5 hover:bg-slate-50/70 transition cursor-pointer group flex flex-col justify-between"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center shadow-xs">
                            <Briefcase size={15} />
                          </div>
                          <div>
                            <span className="text-xs font-bold text-slate-800">Em Negociação</span>
                            <p className="text-[11px] font-medium text-slate-400">Oportunidades ativas no funil</p>
                          </div>
                        </div>
                        <span className="text-[11px] font-semibold text-slate-400 group-hover:text-brand-600 transition flex items-center gap-0.5">
                          Abrir pipeline <ArrowRight size={11} />
                        </span>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <p className="text-2xl font-black text-slate-900 tracking-tight">{stats.em_negociacao}</p>
                        <span className="text-xs font-semibold text-slate-500">leads em aberto</span>
                      </div>
                    </div>

                    {/* Célula 5: Finalizados / Desfechos */}
                    <div className="p-5 flex flex-col justify-between">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center shadow-xs">
                            <CheckCircle2 size={15} />
                          </div>
                          <span className="text-xs font-bold text-slate-800">Finalizados</span>
                        </div>
                        <span className="text-[11px] font-semibold text-slate-400">
                          Desfechos
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 divide-x divide-slate-200 pt-1">
                        <div
                          onClick={() => navigate('/leads?status=fechado')}
                          className="pr-3 cursor-pointer group"
                        >
                          <p className="text-xl font-black text-emerald-600 tracking-tight group-hover:underline">
                            {stats.fechados}
                          </p>
                          <p className="text-[11px] font-semibold text-slate-500 mt-0.5 group-hover:text-slate-800 transition">
                            Fechados / Vendas
                          </p>
                        </div>
                        <div
                          onClick={() => navigate('/leads?status=perdido')}
                          className="pl-3 cursor-pointer group"
                        >
                          <p className="text-xl font-black text-slate-400 tracking-tight group-hover:underline">
                            {stats.perdidos}
                          </p>
                          <p className="text-[11px] font-semibold text-slate-500 mt-0.5 group-hover:text-slate-800 transition">
                            Perdidos
                          </p>
                        </div>
                      </div>
                    </div>

                  </div>

                </div>

              </div>

              {/* Bloco 2: Métricas Financeiras & Performance (col-span-1) */}
              <div
                className="bg-white rounded-xl border border-slate-200 shadow-card overflow-hidden flex flex-col justify-between animate-cascade-item"
                style={{ animationDelay: '100ms' }}
              >

                {/* Header do Bloco 2 (h-12 com tipografia limpa) */}
                <div className="h-12 px-5 bg-emerald-900 border-b border-emerald-800 flex items-center justify-between">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-white">
                    Valores & Resultados
                  </h2>
                  <span className="text-[11px] font-semibold text-emerald-200 bg-emerald-800/80 px-2.5 py-0.5 rounded-md border border-emerald-700/80">
                    BRL (R$)
                  </span>
                </div>

                {/* 3 Células Verticais Integradas com Linhas Nítidas */}
                <div className="divide-y divide-slate-200 flex-1 flex flex-col justify-between">

                  {/* Célula 1: Em Negociação */}
                  <div className="p-4 sm:p-4.5 hover:bg-slate-50/50 transition flex flex-col justify-center">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-slate-700">
                        Em Negociação
                      </span>
                      <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                        <Wallet size={13} />
                      </div>
                    </div>
                    <p className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight tabular-nums">
                      {formatCurrency(stats.valor_negociacao) || 'R$ 0,00'}
                    </p>
                    <p className="text-[11px] font-medium text-slate-400 mt-0.5">
                      Volume em aberto no funil
                    </p>
                  </div>

                  {/* Célula 2: Vendas Fechadas */}
                  <div className="p-4 sm:p-4.5 hover:bg-slate-50/50 transition flex flex-col justify-center bg-emerald-50/20">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-emerald-800">
                        Vendas Fechadas
                      </span>
                      <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                        <DollarSign size={13} />
                      </div>
                    </div>
                    <p className="text-xl sm:text-2xl font-black text-emerald-700 tracking-tight tabular-nums">
                      {formatCurrency(stats.valor_fechado) || 'R$ 0,00'}
                    </p>
                    <p className="text-[11px] font-medium text-emerald-600/80 mt-0.5">
                      Receita gerada no período
                    </p>
                  </div>

                  {/* Célula 3: Taxa de Conversão */}
                  <div className="p-4 sm:p-4.5 hover:bg-slate-50/50 transition flex flex-col justify-center">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-slate-700">
                        Taxa de Conversão
                      </span>
                      <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                        <TrendingUp size={13} />
                      </div>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <p className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight tabular-nums">
                        {taxaConversao}%
                      </p>
                      <span className="text-[11px] font-semibold text-slate-500">
                        {totalDesfechos > 0 ? `${stats.fechados} de ${totalDesfechos} ganhos` : 'Sem desfechos'}
                      </span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1.5">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          taxaConversao >= 50 ? 'bg-emerald-500' : taxaConversao > 0 ? 'bg-amber-500' : 'bg-slate-200'
                        }`}
                        style={{ width: `${Math.max(taxaConversao, totalDesfechos > 0 ? 4 : 0)}%` }}
                      />
                    </div>
                  </div>

                </div>

              </div>

            </div>

            {/* Grade Integrada: Leads Recentes (col-span-2) + Por Origem (col-span-1) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6 items-stretch">

              {/* Coluna 1 (2/3): Leads Recentes */}
              <div
                className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-card overflow-hidden flex flex-col justify-between animate-cascade-item"
                style={{ animationDelay: '180ms' }}
              >
                <div className="h-12 px-5 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-white">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-white">Leads Recentes</h2>
                  <button
                    onClick={() => navigate('/leads')}
                    className="flex items-center gap-1 text-slate-300 hover:text-white text-xs font-bold transition cursor-pointer"
                  >
                    Ver todos <ArrowRight size={11} />
                  </button>
                </div>

                {leadsRecentes.length === 0 ? (
                  <div className="p-8 text-center flex-1 flex flex-col items-center justify-center">
                    <Users size={24} className="text-slate-300 mb-2" />
                    <p className="text-xs font-semibold text-slate-600">Nenhum lead recente</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Os novos contatos aparecerão aqui.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-200 flex-1">
                    {leadsRecentes.map((lead, idx) => (
                      <div
                        key={lead.id}
                        onClick={() => navigate(`/leads?lead=${lead.id}`)}
                        className="px-5 py-3 flex items-center justify-between hover:bg-slate-50/70 transition cursor-pointer animate-cascade-item"
                        style={{ animationDelay: `${200 + idx * 40}ms` }}
                      >
                        <div className="min-w-0 flex-1 flex items-center gap-2.5 mr-2">
                          <LeadAvatar nome={lead.nome} foto_url={lead.foto_url} size="sm" />
                          <div className="min-w-0">
                            <p className="text-slate-900 text-xs font-bold truncate">{lead.nome}</p>
                            <p className="text-slate-400 text-[11px] mt-0.5 truncate">
                              {lead.lead_sources?.nome ?? 'Sem origem'} · {formatDateTime(lead.created_at)}
                            </p>
                          </div>
                        </div>
                        <div className="shrink-0">
                          <StatusBadge status={lead.status} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Coluna 2 (1/3): Por Origem */}
              <div
                className="lg:col-span-1 bg-white rounded-xl border border-slate-200 shadow-card overflow-hidden flex flex-col justify-between animate-cascade-item"
                style={{ animationDelay: '260ms' }}
              >
                <div className="h-12 px-5 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-white">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-white">Por Origem</h2>
                  <span className="text-[11px] font-semibold text-slate-300 bg-slate-800/80 px-2.5 py-0.5 rounded-md border border-slate-700">
                    {origens.length > 0 ? `${origens.length} canais` : 'No período'}
                  </span>
                </div>

                {origens.length === 0 ? (
                  <div className="p-8 text-center flex-1 flex flex-col items-center justify-center">
                    <Globe size={24} className="text-slate-300 mb-2" />
                    <p className="text-xs font-semibold text-slate-600">Sem origens no período</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Canais de captação ativos aparecerão aqui.</p>
                  </div>
                ) : (
                  <div className="px-5 py-3.5 space-y-3.5 flex-1 flex flex-col justify-center">
                    {origens.map(({ nome, count }, idx) => (
                      <div
                        key={nome}
                        className="animate-cascade-item"
                        style={{ animationDelay: `${280 + idx * 40}ms` }}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-slate-700 text-xs font-semibold truncate max-w-[130px]">{nome}</span>
                          <span className="text-slate-900 text-xs font-bold tabular-nums ml-2">{count} leads</span>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-slate-900 rounded-full transition-all duration-500"
                            style={{ width: `${Math.round((count / maxOrigemCount) * 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

      </div>
    </Layout>
  )
}
