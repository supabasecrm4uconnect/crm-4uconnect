import { Loader2 } from 'lucide-react'
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
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="px-6 py-5 border-b border-slate-100">
          <h2 className="text-slate-900 text-base font-semibold">{title}</h2>
          <p className="text-slate-500 text-sm mt-1">{description}</p>
        </div>
        {error && (
          <div className="mx-6 mt-4 px-3.5 py-2.5 rounded-lg bg-red-50 border border-red-100">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}
        <div className="flex justify-end gap-3 px-6 py-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white text-sm font-medium transition"
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            {loading ? confirmingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
