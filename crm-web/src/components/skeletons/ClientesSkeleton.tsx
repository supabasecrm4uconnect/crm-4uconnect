export default function ClientesSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="h-7 w-48 bg-slate-200 rounded-lg animate-pulse" />
          <div className="h-4 w-72 bg-slate-100 rounded mt-1.5 animate-pulse" />
        </div>
        <div className="h-10 w-36 bg-slate-200 rounded-lg animate-pulse" />
      </div>

      {/* KPI Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-white p-5 rounded-xl border border-slate-200 shadow-card space-y-3">
            <div className="flex items-center justify-between">
              <div className="h-3.5 w-24 bg-slate-200 rounded animate-pulse" />
              <div className="w-8 h-8 rounded-lg bg-slate-100 animate-pulse" />
            </div>
            <div className="h-7 w-28 bg-slate-200 rounded animate-pulse" />
            <div className="h-3 w-36 bg-slate-100 rounded animate-pulse" />
          </div>
        ))}
      </div>

      {/* Filter Bar Skeleton */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-card flex flex-col sm:flex-row gap-3">
        <div className="h-10 flex-1 bg-slate-100 rounded-lg animate-pulse" />
        <div className="h-10 w-44 bg-slate-100 rounded-lg animate-pulse" />
        <div className="h-10 w-44 bg-slate-100 rounded-lg animate-pulse" />
      </div>

      {/* Table Skeleton */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-card overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex justify-between">
          <div className="h-4 w-32 bg-slate-200 rounded animate-pulse" />
          <div className="h-4 w-20 bg-slate-100 rounded animate-pulse" />
        </div>
        <div className="divide-y divide-slate-100">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-200 animate-pulse shrink-0" />
                <div className="space-y-1.5">
                  <div className="h-4 w-36 bg-slate-200 rounded animate-pulse" />
                  <div className="h-3 w-24 bg-slate-100 rounded animate-pulse" />
                </div>
              </div>
              <div className="h-6 w-24 bg-slate-100 rounded-full animate-pulse hidden md:block" />
              <div className="h-6 w-20 bg-slate-100 rounded-full animate-pulse hidden sm:block" />
              <div className="h-4 w-28 bg-slate-200 rounded animate-pulse" />
              <div className="h-8 w-20 bg-slate-100 rounded-lg animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
