import { Loader2, Trash2, X } from 'lucide-react'
import type { ReactNode } from 'react'

interface ConfirmModalProps {
  title: string
  description: ReactNode
  error?: string | null
  confirmLabel?: string
  confirmingLabel?: string
  cancelLabel?: string
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmModal({
  title,
  description,
  error,
  confirmLabel = 'Excluir',
  confirmingLabel = 'Excluindo...',
  cancelLabel = 'Cancelar',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-sm overflow-hidden animate-scale-in">
        <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/60">
          <h2 className="text-slate-950 text-base font-bold">{title}</h2>
          <div className="text-slate-500 text-xs mt-1 leading-relaxed">{description}</div>
        </div>
        {error && (
          <div className="mx-6 mt-4 px-3.5 py-2.5 rounded-lg bg-red-50 border border-red-200">
            <p className="text-red-600 text-xs font-semibold">{error}</p>
          </div>
        )}
        <div className="flex justify-end gap-2.5 px-6 py-4 border-t border-slate-100 bg-slate-50/40">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 transition cursor-pointer shadow-2xs select-none disabled:opacity-50"
          >
            <X size={14} className="text-slate-400" />
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 active:bg-red-800 disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200 disabled:cursor-not-allowed border border-red-700/50 text-white text-xs font-bold transition shadow-2xs cursor-pointer select-none"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            {loading ? confirmingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
