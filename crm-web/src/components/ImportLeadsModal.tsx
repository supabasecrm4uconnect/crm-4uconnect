import { useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { Upload, X, Loader2, FileSpreadsheet, CheckCircle2, AlertCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { normalizeWhatsApp, phoneVariants, parseCurrency } from '../lib/helpers'
import type { LeadSource, LeadSegment, LeadWithRelations } from '../types'
import type { StatusConfig } from '../contexts/StatusesContext'

interface ImportLeadsModalProps {
  open: boolean
  onClose: () => void
  onImported: () => void
  sources: LeadSource[]
  segments: LeadSegment[]
  statuses: StatusConfig[]
  existingLeads: LeadWithRelations[]
}

type TargetField = 'nome' | 'whatsapp' | 'origem' | 'segmento' | 'valor' | 'status' | 'observacao' | 'tags'

const TARGET_FIELDS: { key: TargetField; label: string; required?: boolean }[] = [
  { key: 'nome',       label: 'Nome',       required: true },
  { key: 'whatsapp',   label: 'WhatsApp',   required: true },
  { key: 'origem',     label: 'Origem' },
  { key: 'segmento',   label: 'Segmento' },
  { key: 'valor',      label: 'Valor (R$)' },
  { key: 'status',     label: 'Status' },
  { key: 'observacao', label: 'Observação' },
  { key: 'tags',       label: 'Tags' },
]

const GUESS: Record<TargetField, RegExp> = {
  nome:       /nome|name|contato|cliente|lead/i,
  whatsapp:   /whats|telefone|fone|celular|phone|n[uú]mero|contato/i,
  origem:     /origem|source|fonte|canal/i,
  segmento:   /segmento|segment|categoria|nicho/i,
  valor:      /valor|value|pre[çc]o|price|r\$|ticket/i,
  status:     /status|etapa|fase|funil/i,
  observacao: /observa|obs|nota|coment|descri/i,
  tags:       /tag|etiqueta|marcador/i,
}

const selectCls = 'w-full px-3 py-2 rounded-lg border border-slate-200 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition bg-white'

const NONE = '__none__'

export default function ImportLeadsModal({ open, onClose, onImported, sources, segments, statuses, existingLeads }: ImportLeadsModalProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState('')
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [mapping, setMapping] = useState<Record<TargetField, string>>({} as Record<TargetField, string>)
  const [parseError, setParseError] = useState('')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ imported: number; skipped: number; errors: number } | null>(null)

  function reset() {
    setFileName(''); setHeaders([]); setRows([]); setMapping({} as Record<TargetField, string>)
    setParseError(''); setImporting(false); setResult(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  function handleClose() { reset(); onClose() }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setParseError(''); setResult(null)
    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf)
      const ws = wb.Sheets[wb.SheetNames[0]]
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })
      if (json.length === 0) { setParseError('A planilha está vazia.'); return }
      const hdrs = Object.keys(json[0])
      setHeaders(hdrs)
      setRows(json)
      setFileName(file.name)

      // Auto-mapeia colunas por nome do cabeçalho
      const auto = {} as Record<TargetField, string>
      for (const { key } of TARGET_FIELDS) {
        const match = hdrs.find(h => GUESS[key].test(h))
        if (match) auto[key] = match
      }
      setMapping(auto)
    } catch {
      setParseError('Não foi possível ler o arquivo. Use .csv ou .xlsx válido.')
    }
  }

  const canImport = mapping.nome && mapping.whatsapp && rows.length > 0 && !importing

  const previewRows = useMemo(() => rows.slice(0, 6), [rows])

  function cell(row: Record<string, unknown>, field: TargetField): string {
    const col = mapping[field]
    if (!col || col === NONE) return ''
    const v = row[col]
    return v == null ? '' : String(v).trim()
  }

  async function handleImport() {
    setImporting(true)
    setParseError('')

    // Set de telefones já existentes (todas as variantes) para deduplicar
    const existingPhones = new Set<string>()
    existingLeads.forEach(l => phoneVariants(l.whatsapp).forEach(v => existingPhones.add(v)))

    // Mapas de origem/segmento por nome (lowercase)
    const sourceMap = new Map(sources.map(s => [s.nome.toLowerCase(), s.id]))
    const segmentMap = new Map(segments.map(s => [s.nome.toLowerCase(), s.id]))
    const statusByKey = new Map<string, string>()
    statuses.forEach(s => { statusByKey.set(s.value.toLowerCase(), s.value); statusByKey.set(s.label.toLowerCase(), s.value) })
    const defaultStatus = statuses[0]?.value ?? 'novo_lead'

    // 1ª passada: coleta origens/segmentos novos a criar
    const newSourceNames = new Set<string>()
    const newSegmentNames = new Set<string>()
    for (const row of rows) {
      const o = cell(row, 'origem')
      if (o && !sourceMap.has(o.toLowerCase())) newSourceNames.add(o)
      const s = cell(row, 'segmento')
      if (s && !segmentMap.has(s.toLowerCase())) newSegmentNames.add(s)
    }

    // Cria origens/segmentos faltantes (organization_id é preenchido pelo trigger)
    if (newSourceNames.size > 0) {
      const { data } = await supabase.from('lead_sources')
        .insert([...newSourceNames].map(nome => ({ nome }))).select('id, nome')
      ;(data ?? []).forEach((s: { id: string; nome: string }) => sourceMap.set(s.nome.toLowerCase(), s.id))
    }
    if (newSegmentNames.size > 0) {
      const { data } = await supabase.from('lead_segments')
        .insert([...newSegmentNames].map(nome => ({ nome }))).select('id, nome')
      ;(data ?? []).forEach((s: { id: string; nome: string }) => segmentMap.set(s.nome.toLowerCase(), s.id))
    }

    const { data: { user } } = await supabase.auth.getUser()

    // 2ª passada: monta os leads
    const seen = new Set<string>()
    let skipped = 0
    const toInsert: Record<string, unknown>[] = []
    for (const row of rows) {
      const nome = cell(row, 'nome')
      const waRaw = cell(row, 'whatsapp')
      if (!nome || !waRaw) { skipped++; continue }
      const waNorm = normalizeWhatsApp(waRaw)
      const variants = phoneVariants(waRaw)
      if (variants.some(v => existingPhones.has(v)) || variants.some(v => seen.has(v))) { skipped++; continue }
      variants.forEach(v => seen.add(v))

      const origem = cell(row, 'origem')
      const segmento = cell(row, 'segmento')
      const statusRaw = cell(row, 'status').toLowerCase()
      const tagsRaw = cell(row, 'tags')

      toInsert.push({
        nome,
        whatsapp: waNorm,
        status: statusByKey.get(statusRaw) ?? defaultStatus,
        origem_id: origem ? sourceMap.get(origem.toLowerCase()) ?? null : null,
        segmento_id: segmento ? segmentMap.get(segmento.toLowerCase()) ?? null : null,
        valor: parseCurrency(cell(row, 'valor')),
        observacao: cell(row, 'observacao') || null,
        tags: tagsRaw ? tagsRaw.split(/[,;]/).map(t => t.trim()).filter(Boolean) : [],
        responsavel_id: user?.id ?? null,
      })
    }

    let imported = 0
    let errors = 0
    // Insere em lotes de 200
    for (let i = 0; i < toInsert.length; i += 200) {
      const batch = toInsert.slice(i, i + 200)
      const { data, error } = await supabase.from('leads').insert(batch).select('id, status')
      if (error) { errors += batch.length; continue }
      imported += data?.length ?? 0
      // Histórico de status inicial
      if (data && data.length) {
        await supabase.from('lead_status_history').insert(
          data.map((l: { id: string; status: string }) => ({
            lead_id: l.id, status_anterior: null, status_novo: l.status, alterado_por: user?.id ?? null,
          }))
        )
      }
    }

    setImporting(false)
    setResult({ imported, skipped, errors })
    if (imported > 0) onImported()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 sticky top-0 bg-white">
          <h2 className="text-slate-900 text-base font-semibold">Importar base de leads</h2>
          <button onClick={handleClose} className="text-slate-400 hover:text-slate-600 transition"><X size={18} /></button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Resultado */}
          {result ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3.5">
                <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
                <div>
                  <p className="text-emerald-800 text-sm font-medium">Importação concluída</p>
                  <p className="text-emerald-700 text-xs mt-0.5">
                    {result.imported} lead{result.imported !== 1 ? 's' : ''} importado{result.imported !== 1 ? 's' : ''}
                    {result.skipped > 0 && ` · ${result.skipped} ignorado${result.skipped !== 1 ? 's' : ''} (duplicado/incompleto)`}
                    {result.errors > 0 && ` · ${result.errors} com erro`}
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button onClick={reset} className="px-4 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition">Importar outro</button>
                <button onClick={handleClose} className="px-4 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium transition">Concluir</button>
              </div>
            </div>
          ) : (
            <>
              {/* Upload */}
              <div>
                <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleFile} className="hidden" id="import-file" />
                <label
                  htmlFor="import-file"
                  className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-200 rounded-xl px-6 py-8 cursor-pointer hover:border-emerald-300 hover:bg-emerald-50/40 transition"
                >
                  {fileName ? (
                    <>
                      <FileSpreadsheet size={28} className="text-emerald-500" />
                      <p className="text-slate-700 text-sm font-medium">{fileName}</p>
                      <p className="text-slate-400 text-xs">{rows.length} linha{rows.length !== 1 ? 's' : ''} · clique para trocar</p>
                    </>
                  ) : (
                    <>
                      <Upload size={28} className="text-slate-300" />
                      <p className="text-slate-600 text-sm font-medium">Selecione um arquivo .csv ou .xlsx</p>
                      <p className="text-slate-400 text-xs">A primeira linha deve conter os títulos das colunas</p>
                    </>
                  )}
                </label>
                {parseError && (
                  <div className="flex items-center gap-2 mt-3 bg-red-50 border border-red-100 rounded-lg px-3.5 py-2.5">
                    <AlertCircle size={15} className="text-red-500 shrink-0" />
                    <p className="text-red-600 text-sm">{parseError}</p>
                  </div>
                )}
              </div>

              {/* Mapeamento de colunas */}
              {headers.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5">Relacionar colunas</p>
                  <div className="grid grid-cols-2 gap-3">
                    {TARGET_FIELDS.map(({ key, label, required }) => (
                      <div key={key}>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          {label}{required && <span className="text-red-500"> *</span>}
                        </label>
                        <select
                          value={mapping[key] ?? NONE}
                          onChange={e => setMapping(m => ({ ...m, [key]: e.target.value === NONE ? '' : e.target.value }))}
                          className={selectCls}
                        >
                          <option value={NONE}>— ignorar —</option>
                          {headers.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Prévia */}
              {previewRows.length > 0 && (mapping.nome || mapping.whatsapp) && (
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5">Prévia ({previewRows.length} de {rows.length})</p>
                  <div className="border border-slate-100 rounded-lg overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50">
                          {TARGET_FIELDS.filter(f => mapping[f.key]).map(f => (
                            <th key={f.key} className="text-left font-medium text-slate-500 px-3 py-2 whitespace-nowrap">{f.label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {previewRows.map((row, i) => (
                          <tr key={i}>
                            {TARGET_FIELDS.filter(f => mapping[f.key]).map(f => (
                              <td key={f.key} className="px-3 py-1.5 text-slate-700 whitespace-nowrap max-w-[160px] truncate">{cell(row, f.key) || '—'}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {headers.length > 0 && (
                <div className="flex items-center justify-between pt-1">
                  <p className="text-xs text-slate-400">Duplicados (mesmo WhatsApp) são ignorados automaticamente.</p>
                  <button
                    onClick={handleImport}
                    disabled={!canImport}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300 text-white text-sm font-medium transition"
                  >
                    {importing ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                    {importing ? 'Importando...' : `Importar ${rows.length} lead${rows.length !== 1 ? 's' : ''}`}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
