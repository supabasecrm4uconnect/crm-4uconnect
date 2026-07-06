import { useEffect, useState } from 'react'
import {
  Activity, Download, Trash2, Bug, ChevronDown, ChevronRight,
  Loader2, AlertCircle, AlertTriangle, Info, RefreshCw, Users, Clock,
} from 'lucide-react'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabase'
import { formatDateTime } from '../lib/helpers'
import type { ExtensionLog } from '../types'

type NivelFiltro = 'TODOS' | 'ERROR' | 'WARN' | 'INFO'

const NIVEL_CONFIG = {
  ERROR: { label: 'ERROR', color: '#dc2626', bg: '#fef2f2', dot: '#f87171', icon: AlertCircle },
  WARN:  { label: 'WARN',  color: '#b45309', bg: '#fffbeb', dot: '#f59e0b', icon: AlertTriangle },
  INFO:  { label: 'INFO',  color: '#1d4ed8', bg: '#eff6ff', dot: '#3b82f6', icon: Info },
} as const

type UsuarioItem = { id: string; nome: string; email: string }

type Stats = {
  errors24h: number
  warns24h: number
  infos24h: number
  lastAt: string | null
  versao: string | null
  navegador: string | null
}

type UserStat = { user_id: string; errors: number }

function NivelBadge({ nivel }: { nivel: ExtensionLog['nivel'] }) {
  const cfg = NIVEL_CONFIG[nivel]
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap"
      style={{ color: cfg.color, backgroundColor: cfg.bg }}
    >
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: cfg.dot }} />
      {cfg.label}
    </span>
  )
}

function StatCardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-slate-100 p-5 animate-pulse">
      <div className="w-8 h-8 rounded-lg bg-slate-100 mb-4" />
      <div className="h-7 w-12 bg-slate-100 rounded mb-2" />
      <div className="h-4 w-28 bg-slate-100 rounded" />
    </div>
  )
}

export default function Diagnostico() {
  const [logs, setLogs] = useState<ExtensionLog[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<NivelFiltro>('TODOS')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [debugMode, setDebugMode] = useState(false)
  const [togglingDebug, setTogglingDebug] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [copied, setCopied] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [nivelLimpar, setNivelLimpar] = useState<'INFO' | 'WARN' | 'ERROR' | 'TODOS'>('INFO')

  // Admin state
  const [isAdmin, setIsAdmin] = useState(false)
  const [usuarios, setUsuarios] = useState<UsuarioItem[]>([])
  const [selectedUserId, setSelectedUserId] = useState<string>('todos')

  // Stats state
  const [stats, setStats] = useState<Stats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [userStats, setUserStats] = useState<UserStat[]>([])

  async function loadProfile() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('profiles')
      .select('is_admin, debug_mode')
      .eq('id', user.id)
      .single()
    setDebugMode((data as { debug_mode: boolean; is_admin: boolean } | null)?.debug_mode ?? false)
    const admin = (data as { is_admin: boolean } | null)?.is_admin === true
    setIsAdmin(admin)
    if (admin) {
      const { data: users } = await supabase
        .from('profiles')
        .select('id, nome, email')
        .order('nome')
      setUsuarios((users as UsuarioItem[]) ?? [])
    }
  }

  async function loadStats(uid: string, admin: boolean) {
    setStatsLoading(true)
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    function countQuery(nivel: string) {
      let q = supabase
        .from('extension_logs')
        .select('*', { count: 'exact', head: true })
        .eq('nivel', nivel)
        .gte('created_at', since24h)
      if (uid !== 'todos') q = q.eq('user_id', uid)
      return q
    }

    function lastQuery() {
      let q = supabase
        .from('extension_logs')
        .select('created_at, versao_extensao, navegador')
        .order('created_at', { ascending: false })
        .limit(1)
      if (uid !== 'todos') q = q.eq('user_id', uid)
      return q
    }

    const [errRes, warnRes, infoRes, lastRes] = await Promise.all([
      countQuery('ERROR'),
      countQuery('WARN'),
      countQuery('INFO'),
      lastQuery(),
    ])

    const lastLog = (lastRes.data as { created_at: string; versao_extensao: string | null; navegador: string | null }[] | null)?.[0]

    setStats({
      errors24h: errRes.count ?? 0,
      warns24h: warnRes.count ?? 0,
      infos24h: infoRes.count ?? 0,
      lastAt: lastLog?.created_at ?? null,
      versao: lastLog?.versao_extensao ?? null,
      navegador: lastLog?.navegador ?? null,
    })

    // Admin "todos": breakdown de ERRORs por usuário
    if (admin && uid === 'todos') {
      const { data: erroLogs } = await supabase
        .from('extension_logs')
        .select('user_id')
        .eq('nivel', 'ERROR')
        .gte('created_at', since24h)

      const counts: Record<string, number> = {}
      for (const l of (erroLogs ?? []) as { user_id: string }[]) {
        counts[l.user_id] = (counts[l.user_id] ?? 0) + 1
      }
      setUserStats(Object.entries(counts).map(([user_id, errors]) => ({ user_id, errors })))
    } else {
      setUserStats([])
    }

    setStatsLoading(false)
  }

  async function loadLogs() {
    setLoading(true)
    let query = supabase
      .from('extension_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)

    if (filtro !== 'TODOS') query = query.eq('nivel', filtro)
    if (selectedUserId !== 'todos') query = query.eq('user_id', selectedUserId)

    const { data } = await query
    setLogs((data as ExtensionLog[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    loadProfile()
  }, [])

  useEffect(() => {
    loadLogs()
    loadStats(selectedUserId, isAdmin)
  }, [filtro, selectedUserId, isAdmin])

  async function toggleDebug() {
    setTogglingDebug(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setTogglingDebug(false); return }
    const next = !debugMode
    await supabase.from('profiles').update({ debug_mode: next }).eq('id', user.id)
    setDebugMode(next)
    setTogglingDebug(false)
  }

  async function clearLogs() {
    setClearing(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      let query = supabase.from('extension_logs').delete()
      if (nivelLimpar !== 'TODOS') query = query.eq('nivel', nivelLimpar)
      if (isAdmin && selectedUserId !== 'todos') {
        query = query.eq('user_id', selectedUserId)
      } else if (!isAdmin) {
        query = query.eq('user_id', user.id)
      }
      await query
    }
    setConfirmClear(false)
    setClearing(false)
    loadLogs()
    loadStats(selectedUserId, isAdmin)
  }

  async function handleRefresh() {
    await Promise.all([loadLogs(), loadStats(selectedUserId, isAdmin)])
  }

  async function exportDiagnostico() {
    let query = supabase
      .from('extension_logs')
      .select('*')
      .in('nivel', ['ERROR', 'WARN'])
      .order('created_at', { ascending: false })
      .limit(10)

    if (isAdmin && selectedUserId !== 'todos') query = query.eq('user_id', selectedUserId)

    const { data: erros } = await query
    const primeiroLog = (erros as ExtensionLog[] | null)?.[0]
    const versao = primeiroLog?.versao_extensao ?? 'desconhecida'
    const navegador = primeiroLog?.navegador ?? 'desconhecido'
    const usuarioLabel = isAdmin && selectedUserId !== 'todos' ? getUserLabel(selectedUserId) : 'todos'

    const texto = [
      'Estou com erro no For You Connect (extensão WhatsApp Web + CRM).',
      'Segue o diagnóstico técnico capturado automaticamente:',
      '',
      `Versão da extensão: ${versao}`,
      `Navegador: ${navegador}`,
      `Usuário filtrado: ${usuarioLabel}`,
      `Data/hora do diagnóstico: ${new Date().toLocaleString('pt-BR')}`,
      '',
      'Últimos erros (ERROR e WARN):',
      JSON.stringify(erros ?? [], null, 2),
      '',
      'Descreva aqui o que você estava tentando fazer quando o erro aconteceu:',
      '',
    ].join('\n')

    await navigator.clipboard.writeText(texto)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  function getUserLabel(userId: string) {
    const u = usuarios.find(u => u.id === userId)
    return u ? (u.nome || u.email) : userId.slice(0, 8) + '...'
  }

  function formatNavegador(nav: string | null) {
    if (!nav) return null
    if (nav.toLowerCase().includes('chrome')) return 'Chrome'
    if (nav.toLowerCase().includes('firefox')) return 'Firefox'
    if (nav.toLowerCase().includes('edge')) return 'Edge'
    return nav.split('/')[0]
  }

  const filtros: NivelFiltro[] = ['TODOS', 'ERROR', 'WARN', 'INFO']
  const showUsuarioCol = isAdmin && selectedUserId === 'todos'

  return (
    <Layout>
      <div className="px-8 py-8">

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <Activity size={20} className="text-slate-400" />
            <h1 className="text-slate-900 text-xl font-semibold">Diagnóstico</h1>
            {isAdmin && (
              <span className="ml-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[11px] font-semibold border border-amber-200">
                Admin
              </span>
            )}
          </div>
          <p className="text-slate-500 text-sm">Logs da extensão Chrome — últimas 50 ocorrências</p>
        </div>

        {/* Cards de resumo */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {statsLoading ? (
            <>
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
            </>
          ) : (
            <>
              {/* ERRORs 24h */}
              <div className={`bg-white rounded-xl border p-5 ${stats && stats.errors24h > 0 ? 'border-red-200' : 'border-slate-100'}`}>
                <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center mb-4">
                  <AlertCircle size={16} className="text-red-500" />
                </div>
                <p className={`text-2xl font-semibold ${stats && stats.errors24h > 0 ? 'text-red-600' : 'text-slate-900'}`}>
                  {stats?.errors24h ?? 0}
                </p>
                <p className="text-slate-500 text-sm mt-0.5">ERRORs nas 24h</p>
              </div>

              {/* WARNs 24h */}
              <div className={`bg-white rounded-xl border p-5 ${stats && stats.warns24h > 0 ? 'border-amber-200' : 'border-slate-100'}`}>
                <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center mb-4">
                  <AlertTriangle size={16} className="text-amber-500" />
                </div>
                <p className={`text-2xl font-semibold ${stats && stats.warns24h > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
                  {stats?.warns24h ?? 0}
                </p>
                <p className="text-slate-500 text-sm mt-0.5">WARNs nas 24h</p>
              </div>

              {/* INFOs 24h */}
              <div className="bg-white rounded-xl border border-slate-100 p-5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center mb-4">
                  <Info size={16} className="text-blue-500" />
                </div>
                <p className="text-slate-900 text-2xl font-semibold">{stats?.infos24h ?? 0}</p>
                <p className="text-slate-500 text-sm mt-0.5">INFOs nas 24h</p>
              </div>

              {/* Última atividade */}
              <div className="bg-white rounded-xl border border-slate-100 p-5">
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center mb-4">
                  <Clock size={16} className="text-slate-500" />
                </div>
                {stats?.lastAt ? (
                  <>
                    <p className="text-slate-900 text-sm font-semibold leading-tight">
                      {formatDateTime(stats.lastAt)}
                    </p>
                    <p className="text-slate-400 text-xs mt-1">
                      {[stats.versao ? `v${stats.versao}` : null, formatNavegador(stats.navegador)]
                        .filter(Boolean).join(' · ') || 'Última atividade'}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-slate-400 text-sm font-medium">Sem atividade</p>
                    <p className="text-slate-300 text-xs mt-1">Nenhum log registrado</p>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        {/* Breakdown por usuário (admin + todos) */}
        {isAdmin && selectedUserId === 'todos' && usuarios.length > 0 && (
          <div className="mb-6">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">ERRORs por usuário — últimas 24h</p>
            <div className="flex flex-wrap gap-3">
              {usuarios.map(u => {
                const stat = userStats.find(s => s.user_id === u.id)
                const count = stat?.errors ?? 0
                return (
                  <div
                    key={u.id}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm ${
                      count > 0
                        ? 'bg-red-50 border-red-200'
                        : 'bg-white border-slate-100'
                    }`}
                  >
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0 ${
                      count > 0 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {(u.nome || u.email)[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-slate-800 leading-tight">{u.nome || u.email}</p>
                      <p className={`text-xs ${count > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                        {count > 0 ? `${count} erro${count > 1 ? 's' : ''} hoje` : 'Sem erros hoje'}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Seletor de usuário (admin) */}
        {isAdmin && (
          <div className="flex items-center gap-2 mb-4 p-3 bg-amber-50 border border-amber-100 rounded-xl">
            <Users size={15} className="text-amber-600 shrink-0" />
            <span className="text-xs font-medium text-amber-700">Usuário:</span>
            <select
              value={selectedUserId}
              onChange={e => setSelectedUserId(e.target.value)}
              className="flex-1 text-xs bg-white border border-amber-200 rounded-lg px-3 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-300"
            >
              <option value="todos">Todos os usuários</option>
              {usuarios.map(u => (
                <option key={u.id} value={u.id}>
                  {u.nome ? `${u.nome} (${u.email})` : u.email}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Barra de ações */}
        <div className="flex items-center gap-3 mb-5 flex-wrap">
          <div className="flex items-center gap-1 bg-slate-50 rounded-lg p-1 border border-slate-100">
            {filtros.map(f => (
              <button
                key={f}
                onClick={() => setFiltro(f)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                  filtro === f
                    ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="flex-1" />

          {/* Modo debug */}
          <button
            onClick={toggleDebug}
            disabled={togglingDebug}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition ${
              debugMode
                ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {togglingDebug ? <Loader2 size={14} className="animate-spin" /> : <Bug size={14} />}
            Modo debug {debugMode ? 'ativo' : 'inativo'}
          </button>

          {/* Limpar logs */}
          {confirmClear ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">
                Limpar {nivelLimpar === 'TODOS' ? 'todos os logs' : `logs ${nivelLimpar}`}?
              </span>
              <button
                onClick={clearLogs}
                disabled={clearing}
                className="px-3 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition"
              >
                {clearing ? <Loader2 size={14} className="animate-spin" /> : 'Sim, limpar'}
              </button>
              <button
                onClick={() => setConfirmClear(false)}
                className="px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-0 border border-slate-200 rounded-lg overflow-hidden">
              <select
                value={nivelLimpar}
                onChange={e => setNivelLimpar(e.target.value as typeof nivelLimpar)}
                className="text-xs text-slate-600 bg-white px-2 py-2 border-r border-slate-200 focus:outline-none cursor-pointer"
              >
                <option value="INFO">INFO</option>
                <option value="WARN">WARN</option>
                <option value="ERROR">ERROR</option>
                <option value="TODOS">TODOS</option>
              </select>
              <button
                onClick={() => setConfirmClear(true)}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-white text-slate-600 hover:bg-slate-50 transition"
              >
                <Trash2 size={14} />
                Limpar
              </button>
            </div>
          )}

          {/* Exportar */}
          <button
            onClick={exportDiagnostico}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition ${
              copied
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-emerald-500 text-white hover:bg-emerald-600'
            }`}
          >
            <Download size={14} />
            {copied ? 'Copiado!' : 'Exportar diagnóstico'}
          </button>

          {/* Atualizar */}
          <button
            onClick={handleRefresh}
            disabled={loading || statsLoading}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 border border-slate-200 transition"
            title="Atualizar"
          >
            <RefreshCw size={14} className={loading || statsLoading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Tabela */}
        <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={20} className="text-slate-300 animate-spin" />
            </div>
          ) : logs.length === 0 ? (
            <div className="py-20 text-center">
              <Activity size={32} className="text-slate-200 mx-auto mb-3" />
              <p className="text-slate-400 text-sm">Nenhum log encontrado.</p>
              <p className="text-slate-300 text-xs mt-1">Os logs aparecem aqui quando a extensão registra eventos.</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left text-xs font-medium text-slate-500 px-5 py-3.5 w-[160px]">Data/hora</th>
                  <th className="text-left text-xs font-medium text-slate-500 px-4 py-3.5 w-[80px]">Nível</th>
                  <th className="text-left text-xs font-medium text-slate-500 px-4 py-3.5 w-[120px]">Módulo</th>
                  <th className="text-left text-xs font-medium text-slate-500 px-4 py-3.5 w-[140px]">Ação</th>
                  <th className="text-left text-xs font-medium text-slate-500 px-4 py-3.5">Mensagem</th>
                  {showUsuarioCol && (
                    <th className="text-left text-xs font-medium text-slate-500 px-4 py-3.5 w-[130px]">Usuário</th>
                  )}
                  <th className="w-8 px-4 py-3.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {logs.map(log => {
                  const isOpen = expanded === log.id
                  const hasDetail = log.erro_tecnico || log.contexto
                  const colSpan = showUsuarioCol ? 7 : 6
                  return (
                    <>
                      <tr
                        key={log.id}
                        onClick={() => hasDetail && setExpanded(isOpen ? null : log.id)}
                        className={`transition-colors ${hasDetail ? 'cursor-pointer hover:bg-slate-50' : ''}`}
                      >
                        <td className="px-5 py-3 text-xs text-slate-400 whitespace-nowrap">
                          {formatDateTime(log.created_at)}
                        </td>
                        <td className="px-4 py-3">
                          <NivelBadge nivel={log.nivel} />
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500 font-mono">{log.modulo}</td>
                        <td className="px-4 py-3 text-xs text-slate-600">{log.acao}</td>
                        <td className="px-4 py-3 text-sm text-slate-700 max-w-xs truncate">{log.mensagem}</td>
                        {showUsuarioCol && (
                          <td className="px-4 py-3 text-xs text-slate-500 truncate max-w-[130px]">
                            {getUserLabel(log.user_id)}
                          </td>
                        )}
                        <td className="px-4 py-3 text-slate-300">
                          {hasDetail && (isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />)}
                        </td>
                      </tr>
                      {isOpen && hasDetail && (
                        <tr key={log.id + '-detail'} className="bg-slate-50">
                          <td colSpan={colSpan} className="px-5 py-3">
                            <div className="space-y-2">
                              {log.erro_tecnico && (
                                <div>
                                  <p className="text-xs font-medium text-slate-500 mb-1">Detalhe técnico</p>
                                  <pre className="text-xs text-red-700 bg-red-50 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all">
                                    {log.erro_tecnico}
                                  </pre>
                                </div>
                              )}
                              {log.contexto && (
                                <div>
                                  <p className="text-xs font-medium text-slate-500 mb-1">Contexto</p>
                                  <pre className="text-xs text-slate-600 bg-slate-100 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all">
                                    {JSON.stringify(log.contexto, null, 2)}
                                  </pre>
                                </div>
                              )}
                              {log.versao_extensao && (
                                <p className="text-[11px] text-slate-400">
                                  Extensão v{log.versao_extensao} · {log.url}
                                </p>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
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
