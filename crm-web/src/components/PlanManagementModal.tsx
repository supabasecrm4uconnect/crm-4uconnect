import { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import {
  X, Loader2, Zap, AlertCircle,
  Users, Layers, DollarSign, Check, Clock, Sparkles
} from 'lucide-react'
import CustomDatePicker from './CustomDatePicker'
import CustomSelect from './CustomSelect'
import { InputIcon, iconInputCls } from './FieldIcon'
import { PLAN_PRESETS } from '../lib/plans'
import { supabase } from '../lib/supabase'
import type { Organization, PlanType, PlanStatus } from '../types'

interface PlanManagementModalProps {
  organization: Organization
  open: boolean
  onClose: () => void
  onSaved: (org: Organization) => void
}

const statusOptions = [
  { value: 'ativo', label: 'Ativo', dotColor: '#10b981' },
  { value: 'trial', label: 'Em Teste (Trial)', dotColor: '#f59e0b' },
  { value: 'vencido', label: 'Vencido', dotColor: '#ef4444' },
  { value: 'bloqueado', label: 'Bloqueado', dotColor: '#991b1b' },
]

export default function PlanManagementModal({
  organization,
  open,
  onClose,
  onSaved,
}: PlanManagementModalProps) {
  const initialPlanType = (organization.plano as PlanType) || 'mensal'
  const [selectedPlan, setSelectedPlan] = useState<PlanType>(initialPlanType)
  const [status, setStatus] = useState<PlanStatus>((organization.plano_status as PlanStatus) || 'ativo')
  const [maxUsuarios, setMaxUsuarios] = useState<number>(organization.max_usuarios ?? 1)
  const [maxLeads, setMaxLeads] = useState<number>(organization.max_leads ?? 500)

  // Format initial dates
  const initialInicio = organization.plano_inicio
    ? organization.plano_inicio.slice(0, 10)
    : new Date().toISOString().slice(0, 10)
  const initialExpira = organization.plano_expira_em
    ? organization.plano_expira_em.slice(0, 10)
    : (() => {
        const expiration = new Date()
        expiration.setDate(expiration.getDate() + 30)
        return expiration.toISOString().slice(0, 10)
      })()

  const [dataInicio, setDataInicio] = useState(initialInicio)
  const [dataExpira, setDataExpira] = useState(initialExpira)
  const [valorRecorrente, setValorRecorrente] = useState<string>(
    organization.plano_valor_recorrente != null ? String(organization.plano_valor_recorrente) : ''
  )

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // When changing standard plan card, auto-fill default users, leads and price
  function handleSelectPreset(type: PlanType) {
    setSelectedPlan(type)
    const preset = PLAN_PRESETS[type]
    if (preset && type !== 'custom') {
      setMaxUsuarios(preset.maxUsuarios)
      setMaxLeads(preset.maxLeads)

      // Auto-set expiration date based on plan standard duration from today
      const d = new Date()
      d.setDate(d.getDate() + preset.diasVigencia)
      setDataExpira(d.toISOString().slice(0, 10))

      if (preset.valorPadrao > 0) {
        setValorRecorrente(preset.valorPadrao.toFixed(2))
      }
    }
  }

  // Quick add days to expiration
  function handleAddDays(days: number) {
    let base = new Date()
    if (dataExpira) {
      const parsed = new Date(dataExpira + 'T12:00:00')
      if (!isNaN(parsed.getTime()) && parsed > base) {
        base = parsed
      }
    }
    base.setDate(base.getDate() + days)
    setDataExpira(base.toISOString().slice(0, 10))
  }

  const isDirty = useMemo(() => {
    return (
      selectedPlan !== initialPlanType ||
      status !== ((organization.plano_status as PlanStatus) || 'ativo') ||
      maxUsuarios !== (organization.max_usuarios ?? 1) ||
      maxLeads !== (organization.max_leads ?? 500) ||
      dataInicio !== initialInicio ||
      dataExpira !== initialExpira ||
      valorRecorrente !== (organization.plano_valor_recorrente != null ? String(organization.plano_valor_recorrente) : '')
    )
  }, [
    selectedPlan, status, maxUsuarios, maxLeads, dataInicio, dataExpira, valorRecorrente,
    initialPlanType, initialInicio, initialExpira, organization
  ])

  if (!open) return null

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const payload = {
      plano: selectedPlan,
      plano_status: status,
      max_usuarios: Number(maxUsuarios) || 1,
      max_leads: Number(maxLeads) || 500,
      plano_inicio: dataInicio ? `${dataInicio}T00:00:00Z` : new Date().toISOString(),
      plano_expira_em: dataExpira ? `${dataExpira}T23:59:59Z` : null,
      plano_valor_recorrente: valorRecorrente ? parseFloat(valorRecorrente) : null,
    }

    try {
      const { data, error: updateErr } = await supabase
        .from('organizations')
        .update(payload)
        .eq('id', organization.id)
        .select()
        .single()

      if (updateErr) throw updateErr
      if (data) onSaved(data as Organization)
      onClose()
    } catch (err: any) {
      console.error('[PlanManagementModal] Erro ao salvar plano:', err)
      setError(err?.message || 'Erro ao salvar plano.')
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-scale-in max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-100 bg-slate-50/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200/60 shadow-2xs">
              <Zap size={18} />
            </div>
            <div>
              <h2 className="text-slate-950 text-base font-bold flex items-center gap-2">
                Gerenciar Plano & Assinatura
              </h2>
              <p className="text-slate-500 text-xs">
                {organization.nome_exibicao || organization.nome} · Defina o pacote e a vigência de acesso
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition cursor-pointer p-1 rounded-lg hover:bg-slate-100"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body Scrollable */}
        <form onSubmit={handleSave} className="p-6 overflow-y-auto space-y-5 flex-1">

          {/* Seletor de Pacote */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">
              Selecione o Pacote Comercial
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {(['mensal', 'trimestral', 'semestral', 'anual'] as PlanType[]).map(type => {
                const preset = PLAN_PRESETS[type]
                const isSelected = selectedPlan === type
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => handleSelectPreset(type)}
                    className={`relative p-3 rounded-xl text-left border transition-all cursor-pointer select-none flex flex-col justify-between ${
                      isSelected
                        ? 'border-emerald-600 bg-emerald-50/50 shadow-xs ring-1 ring-emerald-600'
                        : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/50'
                    }`}
                  >
                    {preset.destaque && (
                      <span className="absolute -top-2 right-2 text-[10px] font-extrabold px-1.5 py-0.2 rounded-full bg-emerald-600 text-white shadow-2xs">
                        Melhor Custo
                      </span>
                    )}
                    <div>
                      <p className={`text-xs font-bold ${isSelected ? 'text-emerald-950' : 'text-slate-800'}`}>
                        {preset.nome}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-1">
                        <Users size={11} className="inline mr-1 text-slate-400" />
                        <strong className="text-slate-700">{preset.maxUsuarios}</strong> {preset.maxUsuarios === 1 ? 'usuário' : 'usuários'}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        <Layers size={11} className="inline mr-1 text-slate-400" />
                        <strong className="text-slate-700">{preset.maxLeads.toLocaleString('pt-BR')}</strong> leads
                      </p>
                    </div>
                    <div className="text-[10px] text-emerald-700 font-bold mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
                      <span>{preset.diasVigencia} dias</span>
                      <span>R$ {preset.valorPadrao.toFixed(2)}</span>
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Opção Personalizada */}
            <div className="mt-2.5">
              <button
                type="button"
                onClick={() => setSelectedPlan('custom')}
                className={`w-full p-2.5 rounded-xl text-xs font-bold flex items-center justify-between border transition-all cursor-pointer select-none ${
                  selectedPlan === 'custom'
                    ? 'border-slate-800 bg-slate-100 text-slate-900 ring-1 ring-slate-800 shadow-2xs'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Sparkles size={14} className={selectedPlan === 'custom' ? 'text-slate-900' : 'text-slate-400'} />
                  Plano Personalizado / Customizado
                </span>
                <span className="text-[11px] font-normal text-slate-500">Ajustar limites livremente</span>
              </button>
            </div>
          </div>

          {/* Limites Operacionais (Editáveis se Custom ou visualizáveis) */}
          <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200/80 space-y-3">
            <h3 className="text-xs font-bold text-slate-800 flex items-center gap-2">
              <Zap size={14} className="text-emerald-600" />
              Limites e Cotas Operacionais
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Máximo de Usuários Ativos
                </label>
                <InputIcon icon={Users}>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={maxUsuarios}
                    onChange={e => {
                      setMaxUsuarios(Math.max(1, parseInt(e.target.value) || 1))
                      if (selectedPlan !== 'custom') setSelectedPlan('custom')
                    }}
                    required
                    className={iconInputCls}
                  />
                </InputIcon>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Máximo de Leads Cadastrados
                </label>
                <InputIcon icon={Layers}>
                  <input
                    type="number"
                    min={100}
                    max={500000}
                    step={100}
                    value={maxLeads}
                    onChange={e => {
                      setMaxLeads(Math.max(100, parseInt(e.target.value) || 500))
                      if (selectedPlan !== 'custom') setSelectedPlan('custom')
                    }}
                    required
                    className={iconInputCls}
                  />
                </InputIcon>
              </div>
            </div>
          </div>

          {/* Status & Vigência */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Status da Assinatura</label>
              <CustomSelect
                value={status}
                onChange={val => setStatus(val as PlanStatus)}
                options={statusOptions}
                placeholder="Status"
                buttonClassName="w-full"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Data de Início</label>
              <CustomDatePicker
                value={dataInicio}
                onChange={val => setDataInicio(val)}
                placeholder="Início"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Data de Vencimento</label>
              <CustomDatePicker
                value={dataExpira}
                onChange={val => setDataExpira(val)}
                placeholder="Vencimento"
              />
            </div>
          </div>

          {/* Atalhos Rápidos de Extensão de Data */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1.5">
              <Clock size={12} className="inline mr-1 text-slate-400" />
              Atalhos de Extensão de Vigência:
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleAddDays(30)}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 transition cursor-pointer shadow-2xs active:scale-95"
              >
                + 30 dias (1 mês)
              </button>
              <button
                type="button"
                onClick={() => handleAddDays(90)}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 transition cursor-pointer shadow-2xs active:scale-95"
              >
                + 90 dias (3 meses)
              </button>
              <button
                type="button"
                onClick={() => handleAddDays(180)}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 transition cursor-pointer shadow-2xs active:scale-95"
              >
                + 180 dias (6 meses)
              </button>
              <button
                type="button"
                onClick={() => handleAddDays(365)}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 transition cursor-pointer shadow-2xs active:scale-95"
              >
                + 1 ano (365 dias)
              </button>
            </div>
          </div>

          {/* Valor Recorrente (Opcional) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Valor Cobrado / Mensalidade (R$) <span className="text-slate-400 font-normal text-[11px]">(Opcional)</span>
            </label>
            <InputIcon icon={DollarSign}>
              <input
                type="number"
                step="0.01"
                min="0"
                value={valorRecorrente}
                onChange={e => setValorRecorrente(e.target.value)}
                placeholder="Ex: 97.00"
                className={iconInputCls}
              />
            </InputIcon>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-xs flex items-center gap-2">
              <AlertCircle size={14} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 transition cursor-pointer shadow-2xs select-none"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={saving || !isDirty}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200 disabled:cursor-not-allowed border border-emerald-700/50 text-white text-xs font-bold transition shadow-2xs cursor-pointer select-none"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              {saving ? 'Salvando...' : 'Salvar Assinatura'}
            </button>
          </div>
        </form>

      </div>
    </div>,
    document.body
  )
}
