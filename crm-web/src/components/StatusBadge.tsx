import { useStatuses } from '../contexts/StatusesContext'

export default function StatusBadge({ status }: { status: string }) {
  const { getConfig } = useStatuses()
  const cfg = getConfig(status)
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap"
      style={{ color: cfg.color_text, backgroundColor: cfg.color_bg }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ backgroundColor: cfg.color_dot }}
      />
      {cfg.label}
    </span>
  )
}
