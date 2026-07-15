import { useState, useMemo, useRef, useEffect } from 'react'
import {
  DndContext, DragOverlay, PointerSensor,
  useSensor, useSensors,
  type DragStartEvent, type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, horizontalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { X, Loader2, AlertTriangle } from 'lucide-react'
import PipelineColumn from './PipelineColumn'
import LeadCard from './LeadCard'
import { supabase } from '../../lib/supabase'
import { useStatuses } from '../../contexts/StatusesContext'
import { addDaysLocal, allLossReasons, TERMINAL_STATUSES } from '../../lib/helpers'
import { recalcProximoFollowup } from '../../lib/leadFollowup'
import type { LeadWithRelations } from '../../types'

interface PipelineBoardProps {
  leads: LeadWithRelations[]
  onLeadsChange: (leads: LeadWithRelations[]) => void
  columnsLocked: boolean
}

export default function PipelineBoard({ leads, onLeadsChange, columnsLocked }: PipelineBoardProps) {
  const { activeStatuses, refresh } = useStatuses()
  const [activeLeadId, setActiveLeadId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lossReasonLead, setLossReasonLead] = useState<{ id: string; nome: string } | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const container = el
    function onWheel(e: WheelEvent) {
      e.preventDefault()
      container.scrollLeft += Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  const activeLead = leads.find(l => l.id === activeLeadId) ?? null

  const grouped = useMemo((): Record<string, LeadWithRelations[]> => {
    const map: Record<string, LeadWithRelations[]> = {}
    activeStatuses.forEach(s => { map[s.value] = [] })
    leads.forEach(l => {
      if (map[l.status] !== undefined) map[l.status].push(l)
    })
    return map
  }, [leads, activeStatuses])

  useEffect(() => {
    if (activeLeadId) {
      document.body.style.cursor = 'grabbing'
    } else {
      document.body.style.cursor = ''
    }
    return () => { document.body.style.cursor = '' }
  }, [activeLeadId])

  function handleDragStart(event: DragStartEvent) {
    if (columnsLocked) {
      setActiveLeadId(event.active.id as string)
      setError(null)
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveLeadId(null)
    if (!over || active.id === over.id) return

    if (!columnsLocked) {
      const activeValue = String(active.id).replace('col_', '')
      const overValue = String(over.id).replace('col_', '')
      const oldIndex = activeStatuses.findIndex(s => s.value === activeValue)
      const newIndex = activeStatuses.findIndex(s => s.value === overValue)
      if (oldIndex === -1 || newIndex === -1) return
      const reordered = arrayMove(activeStatuses, oldIndex, newIndex)
      await Promise.all(
        reordered.map((s, i) =>
          supabase.from('lead_statuses').update({ ordem: i + 1 }).eq('id', s.id)
        )
      )
      await refresh()
      return
    }

    const leadId = active.id as string
    const newStatus = over.id as string
    const lead = leads.find(l => l.id === leadId)
    if (!lead || lead.status === newStatus) return

    const prevStatus = lead.status
    const updated = leads.map(l => l.id === leadId ? { ...l, status: newStatus } : l)
    onLeadsChange(updated)

    const { data: { user } } = await supabase.auth.getUser()
    const { error: patchErr } = await supabase.from('leads').update({ status: newStatus }).eq('id', leadId)

    if (patchErr) {
      onLeadsChange(leads)
      setError('Erro ao mover lead. Tente novamente.')
      return
    }

    await supabase.from('lead_status_history').insert({
      lead_id: leadId,
      status_anterior: prevStatus,
      status_novo: newStatus,
      alterado_por: user?.id ?? null,
    })

    if (TERMINAL_STATUSES.includes(newStatus)) {
      // Estado final do funil (Fechado/Perdido): encerra qualquer tarefa pendente
      // do lead, manual ou automática — não faz sentido follow-up num negócio encerrado.
      await supabase.from('lead_activities')
        .update({ status_atividade: 'concluida', concluido_em: new Date().toISOString() })
        .eq('lead_id', leadId)
        .eq('status_atividade', 'pendente')

      const proximo = await recalcProximoFollowup(leadId)
      onLeadsChange(updated.map(l => l.id === leadId ? { ...l, proximo_followup: proximo } : l))

      if (newStatus === 'perdido') setLossReasonLead({ id: leadId, nome: lead.nome })
    } else {
      // Automação: coluna de destino pode ter uma tarefa automática configurada.
      // Só uma tarefa automática fica ativa por vez: ao entrar numa coluna com
      // automação, encerra (marca concluída) qualquer tarefa pendente criada pela
      // automação de uma coluna anterior antes de criar a nova.
      const targetStatus = activeStatuses.find(s => s.value === newStatus)
      if (targetStatus?.auto_task_enabled && targetStatus.auto_task_tipo) {
        await supabase.from('lead_activities')
          .update({ status_atividade: 'concluida', concluido_em: new Date().toISOString() })
          .eq('lead_id', leadId)
          .eq('status_atividade', 'pendente')
          .eq('criado_automaticamente', true)

        const dataAgendada = addDaysLocal(targetStatus.auto_task_dias ?? 0)
        const { error: taskErr } = await supabase.from('lead_activities').insert({
          lead_id: leadId,
          tipo_atividade: targetStatus.auto_task_tipo,
          descricao: targetStatus.auto_task_descricao || null,
          data_agendada: dataAgendada,
          hora_agendada: '09:00:00',
          status_atividade: 'pendente',
          criado_por: user?.id ?? null,
          criado_automaticamente: true,
        })

        if (!taskErr) {
          const proximo = await recalcProximoFollowup(leadId)
          onLeadsChange(updated.map(l => l.id === leadId ? { ...l, proximo_followup: proximo } : l))
        }
      }
    }
  }

  return (
    <div className="flex flex-col gap-3 w-full min-w-0">
      {error && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-red-50 border border-red-100 rounded-lg text-red-600 text-sm">
          <AlertTriangle size={15} className="shrink-0" /> {error}
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">
            <X size={15} />
          </button>
        </div>
      )}

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div ref={scrollRef} className="w-full overflow-x-auto pb-4 scrollbar-hide">
          {columnsLocked ? (
            <div className="flex gap-3 min-w-max">
              {activeStatuses.map(statusCfg => (
                <PipelineColumn
                  key={statusCfg.value}
                  statusCfg={statusCfg}
                  leads={grouped[statusCfg.value] ?? []}
                />
              ))}
            </div>
          ) : (
            <SortableContext
              items={activeStatuses.map(s => `col_${s.value}`)}
              strategy={horizontalListSortingStrategy}
            >
              <div className="flex gap-3 min-w-max">
                {activeStatuses.map(statusCfg => (
                  <PipelineColumn
                    key={statusCfg.value}
                    statusCfg={statusCfg}
                    leads={grouped[statusCfg.value] ?? []}
                    sortable
                  />
                ))}
              </div>
            </SortableContext>
          )}
        </div>

        <DragOverlay dropAnimation={null}>
          {columnsLocked && activeLead ? (
            <div className="rotate-2 scale-105 cursor-grabbing">
              <LeadCard lead={activeLead} disabled />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {lossReasonLead && (
        <LossReasonModal
          lead={lossReasonLead}
          onClose={() => setLossReasonLead(null)}
          onSaved={(motivo) => onLeadsChange(leads.map(l => l.id === lossReasonLead.id ? { ...l, motivo_perda: motivo } : l))}
        />
      )}
    </div>
  )
}

interface LossReasonModalProps {
  lead: { id: string; nome: string }
  onClose: () => void
  onSaved: (motivo: string) => void
}

function LossReasonModal({ lead, onClose, onSaved }: LossReasonModalProps) {
  const options = allLossReasons()
  const [motivo, setMotivo] = useState('')
  const [outro, setOutro] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    const valor = motivo === 'outro' ? outro.trim() : motivo
    if (!valor) return
    setSaving(true)
    await supabase.from('leads').update({ motivo_perda: valor }).eq('id', lead.id)
    setSaving(false)
    onSaved(valor)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <h2 className="text-slate-900 text-base font-semibold">Por que {lead.nome} foi perdido?</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition"><X size={18} /></button>
        </div>
        <div className="px-6 py-5 space-y-3">
          <select
            autoFocus
            value={motivo}
            onChange={e => setMotivo(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
          >
            <option value="">Selecionar motivo</option>
            {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {motivo === 'outro' && (
            <input
              value={outro}
              onChange={e => setOutro(e.target.value)}
              placeholder="Descreva o motivo..."
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
            />
          )}
          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition">
              Pular
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !motivo || (motivo === 'outro' && !outro.trim())}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300 text-white text-sm font-medium transition"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              Salvar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
