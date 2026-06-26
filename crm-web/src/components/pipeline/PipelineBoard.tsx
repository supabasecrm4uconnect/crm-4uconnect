import { useState, useMemo, useRef, useEffect } from 'react'
import {
  DndContext, DragOverlay, PointerSensor,
  useSensor, useSensors,
  type DragStartEvent, type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, horizontalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import PipelineColumn from './PipelineColumn'
import LeadCard from './LeadCard'
import { supabase } from '../../lib/supabase'
import { useStatuses } from '../../contexts/StatusesContext'
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
  }

  return (
    <div className="flex flex-col gap-3 w-full min-w-0">
      {error && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-red-50 border border-red-100 rounded-lg text-red-600 text-sm">
          <span>⚠️</span> {error}
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">✕</button>
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
    </div>
  )
}
