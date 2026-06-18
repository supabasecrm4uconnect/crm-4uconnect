import { useEffect, useState, useCallback } from 'react'
import { CheckCircle, XCircle, AlertCircle, RefreshCw, Wifi } from 'lucide-react'

type ServiceStatus = 'operational' | 'degraded' | 'down' | 'checking'

interface Check {
  ok: boolean
  latencyMs?: number
  error?: string
  status?: number
}

interface ApiResponse {
  ok: boolean
  checks: { database: Check; auth: Check }
  at: string
}

interface Service {
  key: string
  label: string
  description: string
  status: ServiceStatus
  latencyMs?: number
  error?: string
}

function latencyStatus(ms?: number): ServiceStatus {
  if (ms === undefined) return 'checking'
  if (ms < 800) return 'operational'
  if (ms < 2000) return 'degraded'
  return 'down'
}

const STATUS_CONFIG: Record<ServiceStatus, { label: string; color: string; dot: string; icon: typeof CheckCircle }> = {
  operational: { label: 'Operacional',  color: 'text-emerald-700', dot: 'bg-emerald-500', icon: CheckCircle },
  degraded:    { label: 'Lento',        color: 'text-amber-600',   dot: 'bg-amber-400',   icon: AlertCircle },
  down:        { label: 'Fora do ar',   color: 'text-red-600',     dot: 'bg-red-500',     icon: XCircle     },
  checking:    { label: 'Verificando…', color: 'text-slate-400',   dot: 'bg-slate-300',   icon: RefreshCw   },
}

function StatusBadge({ status }: { status: ServiceStatus }) {
  const cfg = STATUS_CONFIG[status]
  const Icon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${cfg.color}`}>
      <span className={`w-2 h-2 rounded-full ${cfg.dot} ${status === 'checking' ? 'animate-pulse' : ''}`} />
      <Icon size={14} className={status === 'checking' ? 'animate-spin' : ''} />
      {cfg.label}
    </span>
  )
}

function overallStatus(services: Service[]): ServiceStatus {
  if (services.every(s => s.status === 'checking')) return 'checking'
  if (services.some(s => s.status === 'down'))        return 'down'
  if (services.some(s => s.status === 'degraded'))    return 'degraded'
  if (services.some(s => s.status === 'checking'))    return 'degraded'
  return 'operational'
}

const OVERALL_BANNER: Record<ServiceStatus, { bg: string; text: string; msg: string }> = {
  operational: { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-800', msg: 'Todos os sistemas operacionais' },
  degraded:    { bg: 'bg-amber-50 border-amber-200',     text: 'text-amber-800',   msg: 'Desempenho degradado em algum serviço' },
  down:        { bg: 'bg-red-50 border-red-200',         text: 'text-red-800',     msg: 'Falha detectada em algum serviço' },
  checking:    { bg: 'bg-slate-50 border-slate-200',     text: 'text-slate-600',   msg: 'Verificando status dos sistemas…' },
}

const REFRESH_INTERVAL = 30_000

export default function StatusPage() {
  const [services, setServices] = useState<Service[]>([
    { key: 'web',      label: 'CRM Web',            description: 'Interface principal do sistema', status: 'checking' },
    { key: 'database', label: 'Banco de dados',      description: 'Supabase PostgreSQL',           status: 'checking' },
    { key: 'auth',     label: 'Autenticação',        description: 'Login e controle de sessão',    status: 'checking' },
  ])
  const [lastChecked, setLastChecked] = useState<Date | null>(null)
  const [checking, setChecking] = useState(false)
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL / 1000)

  const check = useCallback(async () => {
    setChecking(true)
    setCountdown(REFRESH_INTERVAL / 1000)

    // Web app: always operational if this page is loading
    const webOk: Service = {
      key: 'web',
      label: 'CRM Web',
      description: 'Interface principal do sistema',
      status: 'operational',
      latencyMs: 0,
    }

    // API checks via /api/status
    let database: Service = {
      key: 'database', label: 'Banco de dados', description: 'Supabase PostgreSQL', status: 'down',
    }
    let auth: Service = {
      key: 'auth', label: 'Autenticação', description: 'Login e controle de sessão', status: 'down',
    }

    try {
      const t0 = Date.now()
      const r = await fetch('/api/status', { signal: AbortSignal.timeout(10_000) })
      const data: ApiResponse = await r.json()
      const totalMs = Date.now() - t0

      const dbCheck = data.checks.database
      database = {
        ...database,
        status: dbCheck.ok ? latencyStatus(dbCheck.latencyMs) : 'down',
        latencyMs: dbCheck.latencyMs,
        error: dbCheck.error,
      }

      const authCheck = data.checks.auth
      auth = {
        ...auth,
        status: authCheck.ok ? latencyStatus(authCheck.latencyMs) : 'down',
        latencyMs: authCheck.latencyMs,
        error: authCheck.error,
      }

      // If API itself was slow, at least note it
      if (totalMs > 3000) database.status = 'degraded'
    } catch {
      database.error = 'Não foi possível contatar a API'
      auth.error = 'Não foi possível contatar a API'
    }

    setServices([webOk, database, auth])
    setLastChecked(new Date())
    setChecking(false)
  }, [])

  useEffect(() => { check() }, [check])

  // Auto-refresh
  useEffect(() => {
    const interval = setInterval(check, REFRESH_INTERVAL)
    return () => clearInterval(interval)
  }, [check])

  // Countdown timer
  useEffect(() => {
    if (checking) return
    const t = setInterval(() => setCountdown(c => Math.max(0, c - 1)), 1000)
    return () => clearInterval(t)
  }, [checking])

  const overall = overallStatus(services)
  const banner  = OVERALL_BANNER[overall]

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-500 flex items-center justify-center">
              <Wifi size={15} className="text-white" />
            </div>
            <span className="font-semibold text-slate-800 text-sm">4U Connect — Status</span>
          </div>
          <a
            href="/login"
            className="text-xs text-emerald-600 hover:text-emerald-700 font-medium transition"
          >
            Acessar CRM →
          </a>
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-6 py-10 space-y-6">
        {/* Banner geral */}
        <div className={`rounded-xl border px-5 py-4 ${banner.bg}`}>
          <p className={`font-semibold text-base ${banner.text}`}>{banner.msg}</p>
          {lastChecked && (
            <p className="text-xs text-slate-400 mt-0.5">
              Última verificação: {lastChecked.toLocaleTimeString('pt-BR')}
              {!checking && (
                <span> · próxima em {countdown}s</span>
              )}
            </p>
          )}
        </div>

        {/* Lista de serviços */}
        <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
          {services.map(svc => (
            <div key={svc.key} className="flex items-center justify-between px-5 py-4">
              <div>
                <p className="text-sm font-medium text-slate-800">{svc.label}</p>
                <p className="text-xs text-slate-400 mt-0.5">{svc.description}</p>
                {svc.error && (
                  <p className="text-xs text-red-500 mt-0.5">{svc.error}</p>
                )}
              </div>
              <div className="flex flex-col items-end gap-0.5">
                <StatusBadge status={svc.status} />
                {svc.latencyMs !== undefined && svc.latencyMs > 0 && (
                  <span className="text-xs text-slate-400">{svc.latencyMs} ms</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Botão de refresh manual */}
        <div className="flex justify-center">
          <button
            onClick={check}
            disabled={checking}
            className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 disabled:opacity-40 transition"
          >
            <RefreshCw size={14} className={checking ? 'animate-spin' : ''} />
            {checking ? 'Verificando…' : 'Verificar agora'}
          </button>
        </div>
      </main>

      <footer className="text-center text-xs text-slate-400 pb-6">
        4U Connect CRM · Atualiza automaticamente a cada {REFRESH_INTERVAL / 1000}s
      </footer>
    </div>
  )
}
