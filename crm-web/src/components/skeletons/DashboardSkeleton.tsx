export default function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in" aria-busy="true" aria-label="Carregando painel">
      {/* 8 KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-card overflow-hidden relative"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl skeleton-shimmer" />
              <div className="w-14 h-5 rounded-md skeleton-shimmer" />
            </div>
            <div className="w-20 h-7 rounded-lg skeleton-shimmer mb-1.5" />
            <div className="w-32 h-3.5 rounded skeleton-shimmer" />
          </div>
        ))}
      </div>

      {/* Cards Financeiros / Destaque de Negociação */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-card overflow-hidden"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl skeleton-shimmer shrink-0" />
              <div className="space-y-1.5 flex-1">
                <div className="w-28 h-3.5 rounded skeleton-shimmer" />
                <div className="w-36 h-6 rounded-lg skeleton-shimmer" />
              </div>
            </div>
            <div className="w-full h-2 rounded-full skeleton-shimmer mt-2" />
          </div>
        ))}
      </div>

      {/* Gráficos de Funil e Origens */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Funil de Vendas */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-card space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="w-36 h-4 rounded skeleton-shimmer" />
            <div className="w-20 h-3 rounded skeleton-shimmer" />
          </div>
          <div className="space-y-3 pt-1">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <div className="flex justify-between">
                  <div className="w-24 h-3 rounded skeleton-shimmer" />
                  <div className="w-12 h-3 rounded skeleton-shimmer" />
                </div>
                <div className="w-full h-3 rounded-full skeleton-shimmer" />
              </div>
            ))}
          </div>
        </div>

        {/* Principais Origens / Canais */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-card space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="w-36 h-4 rounded skeleton-shimmer" />
            <div className="w-20 h-3 rounded skeleton-shimmer" />
          </div>
          <div className="space-y-3 pt-1">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between py-1 border-b border-slate-50">
                <div className="flex items-center gap-2.5">
                  <div className="w-2.5 h-2.5 rounded-full skeleton-shimmer" />
                  <div className="w-28 h-3.5 rounded skeleton-shimmer" />
                </div>
                <div className="w-16 h-5 rounded-md skeleton-shimmer" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabelas de Follow-ups do Dia e Leads Recentes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Follow-ups de Hoje */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-card overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div className="w-40 h-4 rounded skeleton-shimmer" />
            <div className="w-16 h-4 rounded skeleton-shimmer" />
          </div>
          <div className="divide-y divide-slate-100 p-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between p-3 gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-8 h-8 rounded-lg skeleton-shimmer shrink-0" />
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="w-32 h-3.5 rounded skeleton-shimmer" />
                    <div className="w-48 h-3 rounded skeleton-shimmer" />
                  </div>
                </div>
                <div className="w-16 h-6 rounded-lg skeleton-shimmer shrink-0" />
              </div>
            ))}
          </div>
        </div>

        {/* Leads Recentes */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-card overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div className="w-36 h-4 rounded skeleton-shimmer" />
            <div className="w-16 h-4 rounded skeleton-shimmer" />
          </div>
          <div className="divide-y divide-slate-100 p-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between p-3 gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-8 h-8 rounded-full skeleton-shimmer shrink-0" />
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="w-28 h-3.5 rounded skeleton-shimmer" />
                    <div className="w-20 h-3 rounded skeleton-shimmer" />
                  </div>
                </div>
                <div className="w-20 h-5 rounded-md skeleton-shimmer shrink-0" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
