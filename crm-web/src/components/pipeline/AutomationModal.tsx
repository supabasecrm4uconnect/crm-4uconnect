import { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import {
  X, Loader2, Zap, CheckCircle2, AlertCircle, Clock,
  FileText, ListChecks, Phone, MessageSquare, Users, Mail, Check
} from 'lucide-react'
import CustomSelect from '../CustomSelect'
import { InputIcon, TextareaIcon, iconInputCls, iconTextareaCls } from '../FieldIcon'
import { allActivityTypes } from '../../lib/helpers'
import { useStatuses, type StatusConfig } from '../../contexts/StatusesContext'
import { supabase } from '../../lib/supabase'
import type { ActivityType } from '../../types'

interface AutomationModalProps {
  statusCfg: StatusConfig
  open: boolean
  onClose: () => void
}

const TYPE_ICONS: Record<string, typeof Phone> = {
  ligacao: Phone,
  whatsapp: MessageSquare,
  reuniao: Users,
  email: Mail,
  tarefa: FileText,
  visita: Users,
  enviar_mensagem: MessageSquare,
}

export default function AutomationModal({ statusCfg, open, onClose }: AutomationModalProps) {
  const { updateOne } = useStatuses()

  const [enabled, setEnabled] = useState(statusCfg.auto_task_enabled ?? false)
  const [tipo, setTipo] = useState<ActivityType>((statusCfg.auto_task_tipo as ActivityType) || 'ligacao')
  const [dias, setDias] = useState<number>(statusCfg.auto_task_dias ?? 1)
  const [descricao, setDescricao] = useState(statusCfg.auto_task_descricao ?? '')
  const [saving, setSaving] = useState(false)
  const [savedSuccess, setSavedSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isDirty = useMemo(() => {
    return (
      enabled !== (statusCfg.auto_task_enabled ?? false) ||
      tipo !== ((statusCfg.auto_task_tipo as ActivityType) || 'ligacao') ||
      dias !== (statusCfg.auto_task_dias ?? 1) ||
      descricao.trim() !== (statusCfg.auto_task_descricao ?? '').trim()
    )
  }, [enabled, tipo, dias, descricao, statusCfg])

  const activityTypeOptions = useMemo(() => {
    return allActivityTypes().map(at => ({
      value: at.value,
      label: at.label,
      icon: TYPE_ICONS[at.value] || ListChecks,
    }))
  }, [])

  if (!open) return null

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const payload = {
      auto_task_enabled: enabled,
      auto_task_tipo: enabled ? tipo : null,
      auto_task_dias: enabled ? Number(dias) || 1 : null,
      auto_task_descricao: enabled && descricao.trim() ? descricao.trim() : null,
    }

    try {
      const { error: updateErr } = await supabase
        .from('lead_statuses')
        .update(payload)
        .eq('id', statusCfg.id)

      if (updateErr) throw updateErr

      updateOne(statusCfg.id, payload)
      setSavedSuccess(true)
      setTimeout(() => {
        setSavedSuccess(false)
        onClose()
      }, 1000)
    } catch (err: any) {
      console.error('[AutomationModal] Erro ao salvar automação:', err)
      setError(err?.message || 'Erro ao salvar automação.')
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-scale-in">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-100 bg-slate-50/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200/60 shadow-2xs">
              <Zap size={16} />
            </div>
            <div>
              <h2 className="text-slate-950 text-sm font-bold flex items-center gap-2">
                Automação da Etapa
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-semibold"
                  style={{
                    backgroundColor: statusCfg.color_bg,
                    color: statusCfg.color_text,
                    border: `1px solid ${statusCfg.color_dot}40`,
                  }}
                >
                  {statusCfg.label}
                </span>
              </h2>
              <p className="text-slate-500 text-[11px]">Agende tarefas automáticas ao mover leads para esta coluna</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition cursor-pointer p-1 rounded-lg hover:bg-slate-100"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSave} className="p-6 space-y-4">
          {/* Toggle Principal */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
            <div>
              <label htmlFor="auto-task-toggle" className="text-xs font-bold text-slate-800 cursor-pointer select-none">
                Criar tarefa automaticamente
              </label>
              <p className="text-[11px] text-slate-500">Gera um follow-up assim que o lead entrar na etapa</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                id="auto-task-toggle"
                type="checkbox"
                checked={enabled}
                onChange={e => setEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>

          {enabled && (
            <div className="space-y-3.5 pt-1 animate-fade-in">
              {/* Tipo de Tarefa */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Tipo de Atividade *</label>
                <CustomSelect
                  value={tipo}
                  onChange={val => setTipo(val as ActivityType)}
                  options={activityTypeOptions}
                  placeholder="Selecione o tipo"
                  icon={ListChecks}
                  buttonClassName="w-full h-9 text-xs"
                />
              </div>

              {/* Prazo em Dias */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Prazo de Execução (em dias) *</label>
                <InputIcon icon={Clock}>
                  <input
                    type="number"
                    min={1}
                    max={90}
                    value={dias}
                    onChange={e => setDias(Math.max(1, parseInt(e.target.value) || 1))}
                    required
                    className={iconInputCls}
                    placeholder="Ex: 1 dia após entrada"
                  />
                </InputIcon>
                <p className="text-[10px] text-slate-400 mt-1">
                  A data agendada será calculada para {dias} {dias === 1 ? 'dia' : 'dias'} após a movimentação.
                </p>
              </div>

              {/* Descrição Padrão */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Descrição Padrão da Tarefa</label>
                <TextareaIcon icon={FileText}>
                  <textarea
                    rows={2}
                    value={descricao}
                    onChange={e => setDescricao(e.target.value)}
                    placeholder="Ex: Entrar em contato para confirmar recebimento da proposta..."
                    className={iconTextareaCls}
                  />
                </TextareaIcon>
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-xs flex items-center gap-2">
              <AlertCircle size={14} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 transition cursor-pointer shadow-2xs select-none"
            >
              Cancelar
            </button>

            <div className="flex items-center gap-2">
              {savedSuccess && (
                <span className="text-emerald-700 text-xs font-bold bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 flex items-center gap-1.5 animate-fade-in">
                  <CheckCircle2 size={13} /> Salvo!
                </span>
              )}
              <button
                type="submit"
                disabled={saving || !isDirty}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200 disabled:cursor-not-allowed border border-emerald-700/50 text-white text-xs font-bold transition shadow-2xs cursor-pointer select-none"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                {saving ? 'Salvando...' : 'Salvar Automação'}
              </button>
            </div>
          </div>
        </form>

      </div>
    </div>,
    document.body
  )
}
