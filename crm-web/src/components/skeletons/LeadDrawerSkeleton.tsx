export default function LeadDrawerSkeleton() {
  return (
    <div className="flex flex-col h-full animate-fade-in" aria-busy="true" aria-label="Carregando detalhes do lead">
      {/* Header do Drawer */}
      <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/40">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-12 h-12 rounded-full skeleton-shimmer shrink-0" />
          <div className="space-y-1.5 min-w-0">
            <div className="w-36 h-4.5 rounded skeleton-shimmer" />
            <div className="w-28 h-3 rounded skeleton-shimmer" />
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-24 h-8 rounded-lg skeleton-shimmer" />
          <div className="w-8 h-8 rounded-lg skeleton-shimmer" />
        </div>
      </div>

      {/* Abas */}
      <div className="flex gap-2 border-b border-slate-100 px-6 pt-3 shrink-0 bg-white">
        <div className="w-24 h-8 rounded-t-lg skeleton-shimmer" />
        <div className="w-24 h-8 rounded-t-lg skeleton-shimmer" />
        <div className="w-20 h-8 rounded-t-lg skeleton-shimmer" />
      </div>

      {/* Conteúdo do Formulário */}
      <div className="p-6 space-y-4 flex-1 overflow-y-auto bg-white">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <div className="w-16 h-3 rounded skeleton-shimmer" />
            <div className="w-full h-10 rounded-lg skeleton-shimmer" />
          </div>
          <div className="space-y-1.5">
            <div className="w-24 h-3 rounded skeleton-shimmer" />
            <div className="w-full h-10 rounded-lg skeleton-shimmer" />
          </div>
          <div className="space-y-1.5">
            <div className="w-16 h-3 rounded skeleton-shimmer" />
            <div className="w-full h-10 rounded-lg skeleton-shimmer" />
          </div>
          <div className="space-y-1.5">
            <div className="w-20 h-3 rounded skeleton-shimmer" />
            <div className="w-full h-10 rounded-lg skeleton-shimmer" />
          </div>
          <div className="col-span-2 space-y-1.5">
            <div className="w-14 h-3 rounded skeleton-shimmer" />
            <div className="w-full h-10 rounded-lg skeleton-shimmer" />
          </div>
          <div className="col-span-2 space-y-1.5">
            <div className="w-24 h-3 rounded skeleton-shimmer" />
            <div className="w-full h-20 rounded-lg skeleton-shimmer" />
          </div>
        </div>

        {/* Rodapé de Salvar */}
        <div className="flex justify-between items-center pt-3 border-t border-slate-100">
          <div className="w-28 h-3 rounded skeleton-shimmer" />
          <div className="w-32 h-9 rounded-lg skeleton-shimmer" />
        </div>
      </div>
    </div>
  )
}
