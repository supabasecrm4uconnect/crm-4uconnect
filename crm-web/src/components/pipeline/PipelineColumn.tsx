import { memo, useRef, useEffect, useCallback, useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useVirtualizer } from '@tanstack/react-virtual'
import { GripVertical, Settings } from 'lucide-react'
import LeadCard from './LeadCard'
import AutomationModal from './AutomationModal'
import type { LeadWithRelations } from '../../types'
import type { StatusConfig } from '../../contexts/StatusesContext'
import { formatCurrency } from '../../lib/helpers'

interface PipelineColumnProps {
  statusCfg: StatusConfig
  leads: LeadWithRelations[]
  sortable?: boolean
}

function PipelineColumn({ statusCfg, leads, sortable = false }: PipelineColumnProps) {
  const [showAutomationModal, setShowAutomationModal] = useState(false)
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: statusCfg.value })

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
      style={{
        ...sortStyle,
        borderColor: statusCfg.color_dot ? `${statusCfg.color_dot}40` : undefined,
      }}
      className="flex flex-col w-72 shrink-0 h-[calc(100vh-220px)] rounded-xl border border-slate-200 shadow-card overflow-hidden transition-all"
    >
      {/* Header com cor sólida do status */}
      <div
        className="px-3.5 py-3 flex items-center justify-between shrink-0 shadow-2xs z-10 text-white"
        style={{ background: statusCfg.color_dot }}
      >
        {sortable && (
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing mr-2 text-white/70 hover:text-white touch-none shrink-0"
            tabIndex={-1}
          >
            <GripVertical size={15} />
          </button>
        )}
        <h3 className="text-sm font-bold text-white tracking-tight truncate flex-1">{statusCfg.label}</h3>
        <div className="flex items-center gap-1.5 shrink-0 ml-1.5">
          <button
            type="button"
            onClick={() => setShowAutomationModal(true)}
            className={`p-1 rounded-lg transition cursor-pointer ${
              statusCfg.auto_task_enabled
                ? 'bg-white/30 text-white hover:bg-white/40 ring-1 ring-white/50'
                : 'text-white/70 hover:text-white hover:bg-white/20'
            }`}
            title={statusCfg.auto_task_enabled ? 'Automação ativa (clique para editar)' : 'Configurar automação da etapa'}
          >
            <Settings size={13} />
          </button>
          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white/25 text-white border border-white/30 backdrop-blur-xs">
            {leads.length}
          </span>
        </div>
      </div>

      {/* Sub-barra de Resumo de Valores */}
      {leads.length > 0 && (
        <div className="px-3.5 py-1.5 bg-white/95 border-b border-slate-200/80 flex items-center justify-between text-[11px] text-slate-600 shrink-0 z-10">
          <span className="font-bold text-slate-800 truncate">{formatCurrency(totalValor)}</span>
          <span className="shrink-0 ml-2 text-slate-500 font-medium">
            {comValor} com valor · {semValor} sem valor
          </span>
        </div>
      )}

      {/* Corpo da coluna com a mesma cor em tom claro */}
      <div
        ref={setBodyRef}
        className={`flex-1 p-2 overflow-y-auto transition-colors min-h-[120px] ${
          !sortable && isOver ? 'ring-2 ring-inset' : ''
        }`}
        style={{
          background: statusCfg.color_bg || '#f8fafc',
          boxShadow: !sortable && isOver ? `inset 0 0 0 2px ${statusCfg.color_dot}` : undefined,
        }}
      >
        {leads.length === 0 ? (
          <div className="flex items-center justify-center h-20">
            <p
              className="text-xs font-semibold select-none"
              style={{ color: statusCfg.color_text ? `${statusCfg.color_text}99` : '#94a3b8' }}
            >
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

      {/* Modal de Automação de Tarefas da Etapa */}
      <AutomationModal
        statusCfg={statusCfg}
        open={showAutomationModal}
        onClose={() => setShowAutomationModal(false)}
      />
    </div>
  )
}

export default memo(PipelineColumn)
