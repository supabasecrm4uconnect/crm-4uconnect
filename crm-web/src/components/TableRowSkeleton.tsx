interface SkeletonCol {
  width: string
  height?: string
  circle?: boolean
}

interface TableRowSkeletonProps {
  rows?: number
  cols: SkeletonCol[]
}

export default function TableRowSkeleton({ rows = 6, cols }: TableRowSkeletonProps) {
  return (
    <div className="divide-y divide-slate-50">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-3.5 animate-pulse">
          {cols.map((c, j) => (
            <div key={j} className={`bg-slate-100 ${c.circle ? 'rounded-full' : 'rounded'} ${c.width} ${c.height ?? 'h-3.5'}`} />
          ))}
        </div>
      ))}
    </div>
  )
}
