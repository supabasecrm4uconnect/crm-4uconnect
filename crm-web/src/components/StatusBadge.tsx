import { useStatuses } from '../contexts/StatusesContext'

export default function StatusBadge({ status }: { status: string }) {
  const { getConfig } = useStatuses()
  const cfg = getConfig(status)
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-bold text-white shadow-2xs whitespace-nowrap select-none"
      style={{ backgroundColor: cfg.color_dot }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full bg-white/70 shrink-0"
      />
      {cfg.label}
    </span>
  )
}
