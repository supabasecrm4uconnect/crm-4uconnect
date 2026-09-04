export default function PipelineSkeleton({ columns = 5 }: { columns?: number }) {
  return (
    <div className="flex gap-3 min-w-max pb-4 animate-fade-in" aria-busy="true" aria-label="Carregando funil">
      {Array.from({ length: columns }).map((_, colIdx) => (
        <div
          key={colIdx}
          className="flex flex-col w-[300px] shrink-0 rounded-2xl border border-slate-200/80 bg-slate-100/70 shadow-2xs overflow-hidden"
          style={{ height: 'calc(100vh - 200px)' }}
        >
          {/* Header da Coluna */}
          <div className="p-3.5 bg-slate-200/80 shrink-0 border-b border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full skeleton-shimmer" />
                <div className="w-24 h-4 rounded skeleton-shimmer" />
              </div>
              <div className="w-6 h-5 rounded-md skeleton-shimmer" />
            </div>
            {/* Sub-barra de Totais */}
            <div className="flex items-center justify-between pt-1 border-t border-slate-300/40 text-xs">
              <div className="w-14 h-3 rounded skeleton-shimmer" />
              <div className="w-20 h-3.5 rounded skeleton-shimmer" />
            </div>
          </div>

          {/* Corpo da Coluna com Cards */}
          <div className="flex-1 p-2 space-y-2.5 overflow-y-auto">
            {Array.from({ length: colIdx === 0 ? 3 : colIdx === 1 ? 2 : colIdx === 2 ? 3 : 2 }).map((_, cardIdx) => (
              <div
                key={cardIdx}
                className="bg-white rounded-xl border border-slate-200/90 p-3.5 shadow-card space-y-2.5"
              >
                {/* Topo: Avatar + Nome + Telefone */}
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full skeleton-shimmer shrink-0" />
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="w-28 h-3.5 rounded skeleton-shimmer" />
                    <div className="w-20 h-2.5 rounded skeleton-shimmer" />
                  </div>
                </div>

                {/* Tags / Badges */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <div className="w-14 h-4 rounded-md skeleton-shimmer" />
                  <div className="w-16 h-4 rounded-md skeleton-shimmer" />
                </div>

                {/* Rodapé: Valor + WhatsApp */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <div className="w-20 h-4 rounded skeleton-shimmer" />
                  <div className="w-7 h-7 rounded-lg skeleton-shimmer" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
