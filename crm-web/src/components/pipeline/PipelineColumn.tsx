import { useRef, useEffect, useCallback } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import LeadCard from './LeadCard'
import type { LeadWithRelations } from '../../types'
import type { StatusConfig } from '../../contexts/StatusesContext'

interface PipelineColumnProps {
  statusCfg: StatusConfig
  leads: LeadWithRelations[]
  sortable?: boolean
}

export default function PipelineColumn({ statusCfg, leads, sortable = false }: PipelineColumnProps) {
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: statusCfg.value })

  const {
    setNodeRef: sortRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `col_${statusCfg.value}`, disabled: !sortable })

  // Ref for the scrollable column body — used for the wheel handler below
  const bodyRef = useRef<HTMLDivElement | null>(null)

  // Merge the DnD droppable ref with our bodyRef
  const setBodyRef = useCallback((node: HTMLDivElement | null) => {
    bodyRef.current = node
    if (!sortable) setDropRef(node)
  }, [sortable, setDropRef])

  useEffect(() => {
    const el = bodyRef.current
    if (!el) return
    const container = el
    function onWheel(e: WheelEvent) {
      // Horizontal trackpad swipe — always let it reach the pipeline
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return

      // Only take control when the column actually has overflow (scrollbar visible).
      // If there's no overflow, let the event bubble so the pipeline scrolls horizontally.
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
        className={`flex-1 rounded-b-xl p-2 space-y-2 overflow-y-auto transition-colors min-h-[120px] ${
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
          leads.map(lead => <LeadCard key={lead.id} lead={lead} disabled={sortable} />)
        )}
      </div>
    </div>
  )
}
