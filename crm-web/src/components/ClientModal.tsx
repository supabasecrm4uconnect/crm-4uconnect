import { useState, useMemo, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  X, Loader2, Zap, AlertCircle, Building2,
  Users, Layers, DollarSign, Clock, Sparkles, Plus, Save
} from 'lucide-react'
import CustomDatePicker from './CustomDatePicker'
import CustomSelect from './CustomSelect'
import { InputIcon, iconInputCls } from './FieldIcon'
import { PLAN_PRESETS } from '../lib/plans'
import { supabase } from '../lib/supabase'
import type { Organization, PlanType, PlanStatus } from '../types'

interface ClientModalProps {
  client: Organization | null
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

export default function ClientModal({
  client,
  open,
  onClose,
  onSaved,
}: ClientModalProps) {
  const isEditing = !!client

  const [nome, setNome] = useState('')
  const [nomeExibicao, setNomeExibicao] = useState('')
  const [responsavelNome, setResponsavelNome] = useState('')
  const [responsavelEmail, setResponsavelEmail] = useState('')
  const [responsavelTelefone, setResponsavelTelefone] = useState('')
  const [selectedPlan, setSelectedPlan] = useState<PlanType>('mensal')
  const [status, setStatus] = useState<PlanStatus>('ativo')
  const [maxUsuarios, setMaxUsuarios] = useState<number>(1)
  const [maxLeads, setMaxLeads] = useState<number>(500)
  const [dataInicio, setDataInicio] = useState('')
  const [dataExpira, setDataExpira] = useState('')
  const [valorRecorrente, setValorRecorrente] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setError(null)
      if (client) {
        setNome(client.nome || '')
        setNomeExibicao(client.nome_exibicao || '')
        setResponsavelNome(client.responsavel_nome || '')
        setResponsavelEmail(client.responsavel_email || '')
        setResponsavelTelefone(client.responsavel_telefone || '')
        setSelectedPlan((client.plano as PlanType) || 'mensal')
        setStatus((client.plano_status as PlanStatus) || 'ativo')
        setMaxUsuarios(client.max_usuarios ?? 1)
        setMaxLeads(client.max_leads ?? 500)
        setDataInicio(client.plano_inicio ? client.plano_inicio.slice(0, 10) : new Date().toISOString().slice(0, 10))
        setDataExpira(client.plano_expira_em ? client.plano_expira_em.slice(0, 10) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))
        setValorRecorrente(client.plano_valor_recorrente != null ? String(client.plano_valor_recorrente) : '')
      } else {
        setNome('')
        setNomeExibicao('')
        setResponsavelNome('')
        setResponsavelEmail('')
        setResponsavelTelefone('')
        setSelectedPlan('mensal')
        setStatus('ativo')
        setMaxUsuarios(1)
        setMaxLeads(500)
        const today = new Date().toISOString().slice(0, 10)
        const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
        setDataInicio(today)
        setDataExpira(in30Days)
        setValorRecorrente(PLAN_PRESETS.mensal.valorPadrao > 0 ? PLAN_PRESETS.mensal.valorPadrao.toFixed(2) : '')
      }
    }
  }, [open, client])

  function handleSelectPreset(type: PlanType) {
    setSelectedPlan(type)
    const preset = PLAN_PRESETS[type]
    if (preset && type !== 'custom') {
      setMaxLeads(preset.maxLeads)

      const d = new Date()
      d.setDate(d.getDate() + preset.diasVigencia)
      setDataExpira(d.toISOString().slice(0, 10))

      if (preset.valorPadrao > 0) {
        setValorRecorrente(preset.valorPadrao.toFixed(2))
      }
    }
  }

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
    if (!client) {
      return nome.trim().length > 0
    }
    const origNome = client.nome || ''
    const origExib = client.nome_exibicao || ''
    const origPlan = (client.plano as PlanType) || 'mensal'
    const origStatus = (client.plano_status as PlanStatus) || 'ativo'
    const origUsers = client.max_usuarios ?? 1
    const origLeads = client.max_leads ?? 500
    const origInicio = client.plano_inicio ? client.plano_inicio.slice(0, 10) : ''
    const origExpira = client.plano_expira_em ? client.plano_expira_em.slice(0, 10) : ''
    const origRespNome = client.responsavel_nome || ''
    const origRespEmail = client.responsavel_email || ''
    const origRespTel = client.responsavel_telefone || ''
    const origValor = client.plano_valor_recorrente != null ? String(client.plano_valor_recorrente) : ''

    return (
      nome.trim() !== origNome.trim() ||
      nomeExibicao.trim() !== origExib.trim() ||
      responsavelNome.trim() !== origRespNome.trim() ||
      responsavelEmail.trim() !== origRespEmail.trim() ||
      responsavelTelefone.trim() !== origRespTel.trim() ||
      selectedPlan !== origPlan ||
      status !== origStatus ||
      maxUsuarios !== origUsers ||
      maxLeads !== origLeads ||
      dataInicio !== origInicio ||
      dataExpira !== origExpira ||
      valorRecorrente !== origValor
    )
  }, [
    client, nome, nomeExibicao, responsavelNome, responsavelEmail, responsavelTelefone,
    selectedPlan, status, maxUsuarios, maxLeads, dataInicio, dataExpira, valorRecorrente
  ])

  if (!open) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nome.trim()) {
      setError('O nome da empresa é obrigatório.')
      return
    }

    setSaving(true)
    setError(null)

    const payload = {
      nome: nome.trim(),
      nome_exibicao: nomeExibicao.trim() || nome.trim(),
      responsavel_nome: responsavelNome.trim() || null,
      responsavel_email: responsavelEmail.trim() || null,
      responsavel_telefone: responsavelTelefone.trim() || null,
      plano: selectedPlan,
      plano_status: status,
      max_usuarios: Number(maxUsuarios) || 1,
      max_leads: Number(maxLeads) || 500,
      plano_inicio: dataInicio ? `${dataInicio}T00:00:00Z` : new Date().toISOString(),
      plano_expira_em: dataExpira ? `${dataExpira}T23:59:59Z` : null,
      plano_valor_recorrente: valorRecorrente ? parseFloat(valorRecorrente) : null,
    }

    try {
      if (isEditing && client) {
        const { data, error: updateErr } = await supabase
          .from('organizations')
          .update(payload)
          .eq('id', client.id)
          .select()
          .single()

        if (updateErr) throw updateErr
        if (data) onSaved(data as Organization)
      } else {
        const { data, error: insertErr } = await supabase
          .from('organizations')
          .insert(payload)
          .select()
          .single()

        if (insertErr) throw insertErr
        if (data) onSaved(data as Organization)
      }
      onClose()
    } catch (err: any) {
      console.error('[ClientModal] Erro ao salvar cliente:', err)
      setError(err?.message || 'Erro ao salvar cliente.')
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
              <Building2 size={18} />
            </div>
            <div>
              <h2 className="text-slate-950 text-base font-bold flex items-center gap-2">
                {isEditing ? 'Editar Cliente & Plano' : 'Novo Cliente / Empresa'}
              </h2>
              <p className="text-slate-500 text-xs">
                {isEditing ? `Gerencie dados e plano de ${client?.nome_exibicao || client?.nome}` : 'Cadastre uma nova empresa cliente e configure o plano de acesso'}
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
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 flex-1">

          {/* Identificação da Empresa */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Nome da Empresa / Razão Social *
              </label>
              <InputIcon icon={Building2}>
                <input
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                  placeholder="Ex: Immovi Contabilidade Ltda"
                  required
                  className={iconInputCls}
                />
              </InputIcon>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Nome Fantasia / Exibição
              </label>
              <InputIcon icon={Building2}>
                <input
                  value={nomeExibicao}
                  onChange={e => setNomeExibicao(e.target.value)}
                  placeholder="Ex: Immovi Contabilidade"
                  className={iconInputCls}
                />
              </InputIcon>
            </div>
          </div>

          {/* Dados do Responsável / Contato do Cliente */}
          <div className="p-4 rounded-xl bg-slate-50/60 border border-slate-200/80 space-y-3">
            <h3 className="text-xs font-bold text-slate-800 flex items-center gap-2">
              <Users size={14} className="text-slate-600" />
              Contato Principal / Responsável da Empresa
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Nome do Contato</label>
                <InputIcon icon={Users}>
                  <input
                    value={responsavelNome}
                    onChange={e => setResponsavelNome(e.target.value)}
                    placeholder="Ex: João da Silva"
                    className={iconInputCls}
                  />
                </InputIcon>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Email de Contato</label>
                <InputIcon icon={Building2}>
                  <input
                    type="email"
                    value={responsavelEmail}
                    onChange={e => setResponsavelEmail(e.target.value)}
                    placeholder="contato@empresa.com"
                    className={iconInputCls}
                  />
                </InputIcon>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">WhatsApp / Telefone</label>
                <InputIcon icon={Building2}>
                  <input
                    value={responsavelTelefone}
                    onChange={e => setResponsavelTelefone(e.target.value)}
                    placeholder="(11) 99999-9999"
                    className={iconInputCls}
                  />
                </InputIcon>
              </div>
            </div>
          </div>

          {/* Seletor de Pacote Comercial */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">
              Plano & Pacote Comercial
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
                        Mais Popular
                      </span>
                    )}
                    <div>
                      <p className={`text-xs font-bold ${isSelected ? 'text-emerald-950' : 'text-slate-800'}`}>
                        {preset.nome}
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
                <span className="text-[11px] font-normal text-slate-500">Ajustar limite de leads</span>
              </button>
            </div>
          </div>

          {/* Limites Operacionais */}
          <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200/80 space-y-3">
            <h3 className="text-xs font-bold text-slate-800 flex items-center gap-2">
              <Zap size={14} className="text-emerald-600" />
              Limites e Cotas Operacionais
            </h3>

              <div className="grid grid-cols-1 gap-3">
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

          {/* Status, Vigência & Valor */}
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
              Atalhos de Vigência:
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

          {/* Valor Cobrado / Mensalidade (R$) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Valor da Mensalidade / Cobrança (R$) <span className="text-slate-400 font-normal text-[11px]">(Opcional)</span>
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
              disabled={saving || !isDirty || !nome.trim()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200 disabled:cursor-not-allowed border border-emerald-700/50 text-white text-xs font-bold transition shadow-2xs cursor-pointer select-none"
            >
              {saving ? (
                <Loader2 size={14} className="animate-spin" />
              ) : isEditing ? (
                <Save size={14} />
              ) : (
                <Plus size={14} />
              )}
              {saving ? 'Salvando...' : isEditing ? 'Salvar Alterações' : 'Cadastrar Cliente'}
            </button>
          </div>
        </form>

      </div>
    </div>,
    document.body
  )
}
