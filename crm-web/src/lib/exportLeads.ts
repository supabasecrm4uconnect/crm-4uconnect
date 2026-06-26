import * as XLSX from 'xlsx'
import { formatWhatsApp, formatDateTime } from './helpers'
import type { LeadWithRelations } from '../types'

/** Mapeia o `value` do status para o label legível, com fallback no próprio value. */
type StatusLabelFn = (value: string) => string

/**
 * Exporta uma lista de leads (já filtrada) para uma planilha .xlsx.
 * Reaproveita as relações já carregadas (origem, segmento, responsável).
 */
export function exportLeadsToXlsx(
  leads: LeadWithRelations[],
  statusLabel: StatusLabelFn,
  filenameBase = 'leads',
) {
  const rows = leads.map(l => ({
    Nome:            l.nome,
    WhatsApp:        formatWhatsApp(l.whatsapp),
    Status:          statusLabel(l.status),
    Origem:          l.lead_sources?.nome ?? '',
    Segmento:        l.lead_segments?.nome ?? '',
    Responsável:     l.profiles?.nome ?? '',
    'Valor (R$)':    l.valor ?? '',
    Tags:            (l.tags ?? []).join(', '),
    Observação:      l.observacao ?? '',
    Arquivado:       l.arquivado ? 'Sim' : 'Não',
    'Criado em':     formatDateTime(l.created_at),
  }))

  const ws = XLSX.utils.json_to_sheet(rows)
  // Larguras de coluna agradáveis
  ws['!cols'] = [
    { wch: 24 }, { wch: 18 }, { wch: 16 }, { wch: 16 }, { wch: 16 },
    { wch: 18 }, { wch: 12 }, { wch: 20 }, { wch: 30 }, { wch: 10 }, { wch: 18 },
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Leads')

  const stamp = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(wb, `${filenameBase}_${stamp}.xlsx`)
}
