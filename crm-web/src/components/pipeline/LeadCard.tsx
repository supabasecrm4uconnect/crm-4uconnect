import { useDraggable } from '@dnd-kit/core'

import { MessageSquare, Clock, AlertCircle, User, Tag, Globe } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { formatWhatsApp, whatsappLink, localDateStr, formatDateTime } from '../../lib/helpers'
import LeadAvatar from '../LeadAvatar'
import type { LeadWithRelations } from '../../types'

interface LeadCardProps {
  lead: LeadWithRelations
  disabled?: boolean
}

export default function LeadCard({ lead, disabled = false }: LeadCardProps) {
  const navigate = useNavigate()
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: lead.id,
    data: { lead },
    disabled,
  })

  const style = {
    opacity: isDragging ? 0.4 : 1,
  }

  const today = localDateStr()
  const followupDate = lead.proximo_followup
    ? new Date(lead.proximo_followup).toLocaleDateString('sv')
    : null
  const isOverdue = followupDate && followupDate < today

  const followupLabel = followupDate
    ? new Date(lead.proximo_followup!).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    : null

  function handleClick(e: React.MouseEvent) {
    // Só navega se não estava arrastando
    if ((e.target as HTMLElement).closest('[data-drag-handle]')) return
    navigate(`/leads?lead=${lead.id}`)
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        bg-white rounded-xl border border-slate-100 shadow-soft
        transition-shadow cursor-pointer select-none
        hover:shadow-md hover:border-slate-200
        ${isDragging ? 'shadow-xl ring-2 ring-emerald-400 ring-opacity-50' : ''}
      `}
      onClick={handleClick}
    >
      {/* Drag handle — área de arrastar */}
      <div
        data-drag-handle
        {...listeners}
        {...attributes}
        className="px-3 pt-3 pb-2 hover:bg-slate-50 rounded-t-xl transition-colors"
        title="Arrastar"
      >
        {/* Grip dots */}
        <div className="flex justify-center mb-1.5">
          <div className="flex gap-0.5">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="w-1 h-1 rounded-full bg-slate-200" />
            ))}
          </div>
        </div>

        {/* Avatar + nome + data */}
        <div className="flex items-center gap-2.5">
          <LeadAvatar nome={lead.nome} foto_url={lead.foto_url} />
          <div className="min-w-0">
            <p className="text-slate-900 text-sm font-semibold truncate leading-tight">
              {lead.nome}
            </p>
            <p className="text-[11px] text-slate-400 truncate mt-0.5" title="Data do primeiro contato">
              {formatDateTime(lead.created_at)}
            </p>
          </div>
        </div>
      </div>

      {/* Conteúdo (não arrasta) */}
      <div className="px-3 pb-3 pt-1 space-y-2">
        {/* Metadados: Segmento, Origem, Responsável */}
        <div className="flex flex-col gap-1.5 mt-1">
          {lead.lead_segments?.nome && (
            <div className="flex items-center gap-1.5 text-xs text-slate-500" title={`Segmento: ${lead.lead_segments.nome}`}>
              <Tag size={11} className="text-slate-400 shrink-0" />
              <span className="truncate"><span className="font-medium text-slate-400">Segmento:</span> {lead.lead_segments.nome}</span>
            </div>
          )}
          {lead.lead_sources?.nome && (
            <div className="flex items-center gap-1.5 text-xs text-slate-500" title={`Origem: ${lead.lead_sources.nome}`}>
              <Globe size={11} className="text-slate-400 shrink-0" />
              <span className="truncate"><span className="font-medium text-slate-400">Origem:</span> {lead.lead_sources.nome}</span>
            </div>
          )}
          {lead.profiles?.nome && (
            <div className="flex items-center gap-1.5 text-xs text-slate-500" title={`Responsável: ${lead.profiles.nome}`}>
              <User size={11} className="text-slate-400 shrink-0" />
              <span className="truncate"><span className="font-medium text-slate-400">Responsável:</span> {lead.profiles.nome}</span>
            </div>
          )}
        </div>

        {/* Observação */}
        {lead.observacao && (
          <p className="text-[11px] text-slate-500 line-clamp-2 mt-2 leading-snug italic" title={lead.observacao}>
            "{lead.observacao}"
          </p>
        )}

        <div className="flex items-center justify-between pt-2 mt-1 border-t border-slate-100/50">
          {/* WhatsApp */}
          <a
            href={whatsappLink(lead.whatsapp)}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-emerald-600 transition w-fit"
          >
            <MessageSquare size={11} />
            <span className="truncate">{formatWhatsApp(lead.whatsapp)}</span>
          </a>

          {/* Follow-up */}
          {followupLabel && (
            <div
              className={`flex items-center gap-1.5 text-xs font-medium shrink-0 ${
                isOverdue ? 'text-red-500' : 'text-amber-600'
              }`}
            >
              {isOverdue ? <AlertCircle size={11} /> : <Clock size={11} />}
              {followupLabel}
            </div>
          )}
        </div>

        {/* Tags */}
        {lead.tags && lead.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-0.5">
            {lead.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px] font-medium"
              >
                {tag}
              </span>
            ))}
            {lead.tags.length > 3 && (
              <span className="text-[10px] text-slate-400">+{lead.tags.length - 3}</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
