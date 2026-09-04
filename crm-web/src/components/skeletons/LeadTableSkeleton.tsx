export default function LeadTableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="w-full divide-y divide-slate-100 animate-fade-in" aria-busy="true" aria-label="Carregando tabela">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center px-4 py-3.5 gap-4 hover:bg-slate-50/50 transition-colors"
        >
          {/* Checkbox */}
          <div className="w-4 h-4 rounded skeleton-shimmer shrink-0" />

          {/* Avatar + Contato (Nome + WhatsApp) */}
          <div className="flex items-center gap-3 min-w-[200px] flex-1">
            <div className="w-8 h-8 rounded-full skeleton-shimmer shrink-0" />
            <div className="space-y-1.5 flex-1 min-w-0">
              <div className="w-32 h-3.5 rounded skeleton-shimmer" />
              <div className="w-24 h-2.5 rounded skeleton-shimmer" />
            </div>
          </div>

          {/* Status Badge */}
          <div className="w-24 h-6 rounded-md skeleton-shimmer shrink-0" />

          {/* Origem */}
          <div className="w-20 h-5 rounded-md skeleton-shimmer shrink-0 hidden md:block" />

          {/* Segmento */}
          <div className="w-20 h-5 rounded-md skeleton-shimmer shrink-0 hidden lg:block" />

          {/* Valor */}
          <div className="w-20 h-4 rounded skeleton-shimmer shrink-0 text-right" />

          {/* Data */}
          <div className="w-24 h-3.5 rounded skeleton-shimmer shrink-0 hidden sm:block" />

          {/* Ações */}
          <div className="w-8 h-8 rounded-lg skeleton-shimmer shrink-0" />
        </div>
      ))}
    </div>
  )
}
