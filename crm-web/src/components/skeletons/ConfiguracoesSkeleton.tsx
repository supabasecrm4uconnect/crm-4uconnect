export default function ConfiguracoesSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in" aria-busy="true" aria-label="Carregando configurações">
      {/* 3 Colunas de Regras Comerciais */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Coluna 1: Etapas do Funil */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-card overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded skeleton-shimmer" />
              <div className="w-28 h-4 rounded skeleton-shimmer" />
            </div>
            <div className="w-20 h-7 rounded-lg skeleton-shimmer" />
          </div>
          <div className="divide-y divide-slate-100 p-2 space-y-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between p-3 gap-2 rounded-lg">
                <div className="flex items-center gap-2.5">
                  <div className="w-3.5 h-3.5 rounded skeleton-shimmer shrink-0" />
                  <div className="w-2 h-2 rounded-full skeleton-shimmer shrink-0" />
                  <div className="w-24 h-3.5 rounded skeleton-shimmer" />
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-6 h-6 rounded-md skeleton-shimmer" />
                  <div className="w-6 h-6 rounded-md skeleton-shimmer" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Coluna 2: Origens de Leads */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-card overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded skeleton-shimmer" />
              <div className="w-28 h-4 rounded skeleton-shimmer" />
            </div>
            <div className="w-20 h-7 rounded-lg skeleton-shimmer" />
          </div>
          <div className="divide-y divide-slate-100 p-2 space-y-1">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between p-3 gap-2 rounded-lg">
                <div className="flex items-center gap-2.5">
                  <div className="w-4 h-4 rounded-full skeleton-shimmer shrink-0" />
                  <div className="w-28 h-3.5 rounded skeleton-shimmer" />
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-6 h-6 rounded-md skeleton-shimmer" />
                  <div className="w-6 h-6 rounded-md skeleton-shimmer" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Coluna 3: Segmentos de Leads */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-card overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded skeleton-shimmer" />
              <div className="w-28 h-4 rounded skeleton-shimmer" />
            </div>
            <div className="w-20 h-7 rounded-lg skeleton-shimmer" />
          </div>
          <div className="divide-y divide-slate-100 p-2 space-y-1">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between p-3 gap-2 rounded-lg">
                <div className="flex items-center gap-2.5">
                  <div className="w-4 h-4 rounded-full skeleton-shimmer shrink-0" />
                  <div className="w-24 h-3.5 rounded skeleton-shimmer" />
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-6 h-6 rounded-md skeleton-shimmer" />
                  <div className="w-6 h-6 rounded-md skeleton-shimmer" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
