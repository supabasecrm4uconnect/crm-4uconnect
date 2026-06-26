import { useEffect, useState } from 'react'
import { Loader2, ArchiveRestore, Download, Archive } from 'lucide-react'
import Layout from '../components/Layout'
import StatusBadge from '../components/StatusBadge'
import LeadAvatar from '../components/LeadAvatar'
import LeadDrawer from '../components/LeadDrawer'
import WhatsAppIcon from '../components/WhatsAppIcon'
import { supabase } from '../lib/supabase'
import { exportLeadsToXlsx } from '../lib/exportLeads'
import { formatWhatsApp, whatsappLink, formatCurrency, formatDateTime } from '../lib/helpers'
import { useStatuses } from '../contexts/StatusesContext'
import type { LeadWithRelations } from '../types'

export default function Arquivados() {
  const { getConfig: getStatusConfig } = useStatuses()
  const [leads, setLeads] = useState<LeadWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)
  const [restoringId, setRestoringId] = useState<string | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('leads')
      .select('*, lead_sources(id, nome), lead_segments(id, nome), profiles(id, nome)')
      .eq('arquivado', true)
      .order('arquivado_em', { ascending: false })
    setLeads((data as LeadWithRelations[]) ?? [])
    setLoading(false)
  }

  async function handleRestore(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    setRestoringId(id)
    await supabase.from('leads').update({ arquivado: false, arquivado_em: null }).eq('id', id)
    setLeads(prev => prev.filter(l => l.id !== id))
    setRestoringId(null)
  }

  function handleExport() {
    exportLeadsToXlsx(leads, (v) => getStatusConfig(v).label, 'leads_arquivados')
  }

  return (
    <Layout>
      <div className="px-8 py-8 w-full min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-slate-900 text-xl font-semibold">Arquivados</h1>
            <p className="text-slate-500 text-sm mt-0.5">
              {leads.length} lead{leads.length !== 1 ? 's' : ''} arquivado{leads.length !== 1 ? 's' : ''} — fora da lista e do pipeline, mas ainda contados no dashboard
            </p>
          </div>
          {leads.length > 0 && (
            <button
              onClick={handleExport}
              className="flex items-center gap-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-sm font-medium px-3 py-1.5 rounded-lg transition"
            >
              <Download size={15} />
              Exportar
            </button>
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={20} className="text-slate-300 animate-spin" />
            </div>
          ) : leads.length === 0 ? (
            <div className="py-16 text-center">
              <Archive size={28} className="text-slate-200 mx-auto mb-3" />
              <p className="text-slate-600 text-sm font-medium">Nenhum lead arquivado</p>
              <p className="text-slate-400 text-xs mt-1">Leads arquivados (manualmente ou por inatividade) aparecem aqui.</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left text-xs font-medium text-slate-500 px-5 py-3.5">Contato</th>
                  <th className="text-left text-xs font-medium text-slate-500 px-4 py-3.5">Status</th>
                  <th className="text-left text-xs font-medium text-slate-500 px-4 py-3.5">Origem</th>
                  <th className="text-left text-xs font-medium text-slate-500 px-4 py-3.5">Valor</th>
                  <th className="text-left text-xs font-medium text-slate-500 px-4 py-3.5">Arquivado em</th>
                  <th className="px-4 py-3.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {leads.map(lead => (
                  <tr
                    key={lead.id}
                    onClick={() => setSelectedLeadId(lead.id)}
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <LeadAvatar nome={lead.nome} foto_url={lead.foto_url} />
                        <div>
                          <p className="text-slate-900 text-sm font-medium">{lead.nome}</p>
                          <a
                            href={whatsappLink(lead.whatsapp)}
                            target="_blank"
                            rel="noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="text-xs text-slate-400 hover:text-emerald-600 flex items-center gap-1 transition"
                          >
                            <WhatsAppIcon size={11} />
                            {formatWhatsApp(lead.whatsapp)}
                          </a>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5"><StatusBadge status={lead.status} /></td>
                    <td className="px-4 py-3.5 text-sm text-slate-600">{lead.lead_sources?.nome ?? '—'}</td>
                    <td className="px-4 py-3.5 text-sm text-slate-700 tabular-nums whitespace-nowrap">{lead.valor != null ? formatCurrency(lead.valor) : '—'}</td>
                    <td className="px-4 py-3.5 text-sm text-slate-500">{lead.arquivado_em ? formatDateTime(lead.arquivado_em) : '—'}</td>
                    <td className="px-4 py-3.5 text-right">
                      <button
                        onClick={(e) => handleRestore(lead.id, e)}
                        disabled={restoringId === lead.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 text-xs font-medium transition disabled:opacity-50"
                        title="Desarquivar lead"
                      >
                        {restoringId === lead.id ? <Loader2 size={13} className="animate-spin" /> : <ArchiveRestore size={13} />}
                        Desarquivar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <LeadDrawer
        leadId={selectedLeadId}
        onClose={() => { setSelectedLeadId(null); load() }}
        onSaved={(l) => setLeads(prev => prev.map(x => x.id === l.id ? l : x))}
      />
    </Layout>
  )
}
