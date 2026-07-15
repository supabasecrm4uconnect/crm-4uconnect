import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Loader2, CornerDownLeft } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatWhatsApp } from '../lib/helpers'
import StatusBadge from './StatusBadge'
import LeadAvatar from './LeadAvatar'

interface SearchResult {
  id: string
  nome: string
  whatsapp: string
  status: string
  foto_url: string | null
}

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // Atalho global — funciona em qualquer tela autenticada, já que este componente
  // vive dentro do Layout, montado em toda página protegida.
  useEffect(() => {
    function handleKeydown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        onOpenChange(!open)
      } else if (e.key === 'Escape') {
        onOpenChange(false)
      }
    }
    document.addEventListener('keydown', handleKeydown)
    return () => document.removeEventListener('keydown', handleKeydown)
  }, [open, onOpenChange])

  useEffect(() => {
    if (open) {
      setQuery('')
      setResults([])
      setActiveIndex(0)
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const q = query.trim()
    if (q.length < 2) { setResults([]); return }

    let cancelled = false
    setLoading(true)
    const timer = setTimeout(async () => {
      const digits = q.replace(/\D/g, '')
      let request = supabase.from('leads').select('id, nome, whatsapp, status, foto_url').limit(8)
      request = digits.length >= 3
        ? request.or(`nome.ilike.%${q}%,whatsapp.ilike.%${digits}%`)
        : request.ilike('nome', `%${q}%`)

      const { data } = await request
      if (cancelled) return
      setResults((data as SearchResult[]) ?? [])
      setActiveIndex(0)
      setLoading(false)
    }, 250)

    return () => { cancelled = true; clearTimeout(timer) }
  }, [query, open])

  function openLead(id: string) {
    navigate(`/leads?lead=${id}`)
    onOpenChange(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter' && results[activeIndex]) { openLead(results[activeIndex].id) }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/40 z-[100] flex items-start justify-center pt-[15vh] px-4" onClick={() => onOpenChange(false)}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100">
          <Search size={17} className="text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Buscar por nome ou WhatsApp..."
            className="flex-1 outline-none text-sm text-slate-900 placeholder:text-slate-400"
          />
          {loading && <Loader2 size={15} className="text-slate-300 animate-spin shrink-0" />}
          <kbd className="hidden sm:inline text-[10px] font-medium text-slate-400 bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 shrink-0">Esc</kbd>
        </div>

        {query.trim().length >= 2 && (
          <div className="max-h-80 overflow-y-auto">
            {!loading && results.length === 0 ? (
              <p className="text-center text-slate-400 text-sm py-8">Nenhum lead encontrado.</p>
            ) : (
              results.map((lead, i) => (
                <div
                  key={lead.id}
                  onClick={() => openLead(lead.id)}
                  onMouseEnter={() => setActiveIndex(i)}
                  className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${i === activeIndex ? 'bg-brand-50' : ''}`}
                >
                  <LeadAvatar nome={lead.nome} foto_url={lead.foto_url} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-slate-900 text-sm font-medium truncate">{lead.nome}</p>
                    <p className="text-slate-400 text-xs truncate">{formatWhatsApp(lead.whatsapp)}</p>
                  </div>
                  <StatusBadge status={lead.status} />
                  {i === activeIndex && <CornerDownLeft size={13} className="text-slate-300 shrink-0" />}
                </div>
              ))
            )}
          </div>
        )}

        {query.trim().length < 2 && (
          <p className="text-center text-slate-400 text-xs py-6">Digite pelo menos 2 caracteres para buscar.</p>
        )}
      </div>
    </div>
  )
}
