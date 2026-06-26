import { memo, useRef, useEffect, useCallback } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useVirtualizer } from '@tanstack/react-virtual'
import { GripVertical } from 'lucide-react'
import LeadCard from './LeadCard'
import type { LeadWithRelations } from '../../types'
import type { StatusConfig } from '../../contexts/StatusesContext'

interface PipelineColumnProps {
  statusCfg: StatusConfig
  leads: LeadWithRelations[]
  sortable?: boolean
}

function PipelineColumn({ statusCfg, leads, sortable = false }: PipelineColumnProps) {
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
        <span
          className="text-xs font-semibold px-2 py-0.5 rounded-full ml-2 shrink-0"
          style={{ background: statusCfg.color_dot + '33', color: statusCfg.color_text }}
        >
          {leads.length}
        </span>
      </div>

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
    </div>
  )
}

export default memo(PipelineColumn)
