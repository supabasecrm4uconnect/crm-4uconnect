import { memo, useRef, useEffect, useCallback, useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useVirtualizer } from '@tanstack/react-virtual'
import { GripVertical, Settings, X, Loader2 } from 'lucide-react'
import LeadCard from './LeadCard'
import { supabase } from '../../lib/supabase'
import { useStatuses } from '../../contexts/StatusesContext'
import type { LeadWithRelations } from '../../types'
import type { StatusConfig } from '../../contexts/StatusesContext'
import { formatCurrency, allActivityTypes } from '../../lib/helpers'

interface PipelineColumnProps {
  statusCfg: StatusConfig
  leads: LeadWithRelations[]
  sortable?: boolean
}

function PipelineColumn({ statusCfg, leads, sortable = false }: PipelineColumnProps) {
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: statusCfg.value })
  const { refresh: refreshStatuses } = useStatuses()
  const [showAutomation, setShowAutomation] = useState(false)

  const {
    setNodeRef: sortRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `col_${statusCfg.value}`, disabled: !sortable })

  // Ref do corpo rolável da coluna — é o scroll container do virtualizador e o droppable
  const bodyRef = useRef<HTMLDivElement | null>(null)

  const setBodyRef = useCallback((node: HTMLDivElement | null) => {
    bodyRef.current = node
    if (!sortable) setDropRef(node)
  }, [sortable, setDropRef])

  // Virtualização: só os cards visíveis são montados (escala para milhares de leads)
  const virtualizer = useVirtualizer({
    count: leads.length,
    getScrollElement: () => bodyRef.current,
    estimateSize: () => 152,
    overscan: 6,
    getItemKey: (index) => leads[index].id,
  })

  useEffect(() => {
    const el = bodyRef.current
    if (!el) return
    const container = el
    function onWheel(e: WheelEvent) {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return
      if (container.scrollHeight <= container.clientHeight) return
      e.preventDefault()
      e.stopPropagation()
      const goingDown = e.deltaY > 0
      const atBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 1
      const atTop = container.scrollTop <= 0
      if ((goingDown && !atBottom) || (!goingDown && !atTop)) {
        container.scrollTop += e.deltaY
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const sortStyle = sortable ? {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 20 : undefined,
  } : {}

  const virtualItems = virtualizer.getVirtualItems()

  const { totalValor, comValor, semValor } = leads.reduce(
    (acc, lead) => {
      if (lead.valor != null) {
        acc.totalValor += lead.valor
        acc.comValor += 1
      } else {
        acc.semValor += 1
      }
      return acc
    },
    { totalValor: 0, comValor: 0, semValor: 0 }
  )

  return (
    <div
      ref={sortable ? sortRef : undefined}
      style={sortStyle}
      className="flex flex-col w-72 shrink-0"
    >
      <div
        className="rounded-t-xl px-3.5 py-3 flex items-center justify-between"
        style={{ background: statusCfg.color_bg, borderTop: `3px solid ${statusCfg.color_dot}` }}
      >
        {sortable && (
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing mr-2 text-slate-400 hover:text-slate-600 touch-none shrink-0"
            tabIndex={-1}
          >
            <GripVertical size={15} />
          </button>
        )}
        <h3 className="text-sm font-semibold text-slate-700 truncate flex-1">{statusCfg.label}</h3>
        <button
          type="button"
          onClick={() => setShowAutomation(true)}
          title="Configurar tarefa automática desta coluna"
          className={`shrink-0 ml-2 p-1 rounded-md transition hover:bg-black/5 ${
            statusCfg.auto_task_enabled ? 'text-emerald-600' : 'text-slate-400'
          }`}
        >
          <Settings size={13} />
        </button>
        <span
          className="text-xs font-semibold px-2 py-0.5 rounded-full ml-1.5 shrink-0"
          style={{ background: statusCfg.color_dot + '33', color: statusCfg.color_text }}
        >
          {leads.length}
        </span>
      </div>

      {leads.length > 0 && (
        <div className="px-3.5 py-1.5 bg-white border-x border-b border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
          <span className="font-semibold text-slate-600 truncate">{formatCurrency(totalValor)}</span>
          <span className="shrink-0 ml-2">
            {comValor} com valor · {semValor} sem valor
          </span>
        </div>
      )}

      <div
        ref={setBodyRef}
        className={`flex-1 rounded-b-xl p-2 overflow-y-auto transition-colors min-h-[120px] ${
          !sortable && isOver ? 'bg-emerald-50 ring-2 ring-inset ring-emerald-300' : 'bg-slate-50'
        }`}
        style={{ maxHeight: 'calc(100vh - 220px)' }}
      >
        {leads.length === 0 ? (
          <div className="flex items-center justify-center h-20">
            <p className="text-xs text-slate-300 select-none">
              {sortable ? '' : 'Solte aqui'}
            </p>
          </div>
        ) : (
          <div style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
            {virtualItems.map(vi => (
              <div
                key={vi.key}
                data-index={vi.index}
                ref={virtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${vi.start}px)`,
                  paddingBottom: 8,
                }}
              >
                <LeadCard lead={leads[vi.index]} disabled={sortable} />
              </div>
            ))}
          </div>
        )}
      </div>

      {showAutomation && (
        <AutomationModal
          statusCfg={statusCfg}
          onClose={() => setShowAutomation(false)}
          onSaved={refreshStatuses}
        />
      )}
    </div>
  )
}

interface AutomationModalProps {
  statusCfg: StatusConfig
  onClose: () => void
  onSaved: () => Promise<void>
}

function AutomationModal({ statusCfg, onClose, onSaved }: AutomationModalProps) {
  const options = allActivityTypes()
  const [enabled, setEnabled] = useState(statusCfg.auto_task_enabled ?? false)
  const [tipo, setTipo] = useState(statusCfg.auto_task_tipo ?? options[0]?.value ?? '')
  const [dias, setDias] = useState(statusCfg.auto_task_dias ?? 2)
  const [descricao, setDescricao] = useState(statusCfg.auto_task_descricao ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    setSaving(true)
    setError('')
    const { error: err } = await supabase.from('lead_statuses').update({
      auto_task_enabled: enabled,
      auto_task_tipo: enabled ? tipo : null,
      auto_task_dias: enabled ? dias : null,
      auto_task_descricao: enabled ? (descricao.trim() || null) : null,
    }).eq('id', statusCfg.id)

    if (err) { setSaving(false); setError('Erro ao salvar automação.'); return }
    await onSaved()
    setSaving(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <h2 className="text-slate-900 text-base font-semibold">Automação — {statusCfg.label}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition"><X size={18} /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={enabled}
              onChange={e => setEnabled(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-emerald-500 focus:ring-emerald-500"
            />
            <span className="text-sm font-medium text-slate-700">
              Criar tarefa automática ao mover lead para esta coluna
            </span>
          </label>

          {enabled && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Tipo de tarefa</label>
                <select
                  value={tipo}
                  onChange={e => setTipo(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
                >
                  {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Prazo (dias a partir de hoje)</label>
                <input
                  type="number"
                  min={0}
                  value={dias}
                  onChange={e => setDias(Math.max(0, Number(e.target.value)))}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Descrição padrão (opcional)</label>
                <textarea
                  value={descricao}
                  onChange={e => setDescricao(e.target.value)}
                  rows={2}
                  placeholder="Ex: Entrar em contato para dar continuidade"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition resize-none"
                />
              </div>
            </>
          )}

          {error && <p className="text-red-500 text-xs">{error}</p>}

          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition">Cancelar</button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || (enabled && !tipo)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300 text-white text-sm font-medium transition"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default memo(PipelineColumn)
