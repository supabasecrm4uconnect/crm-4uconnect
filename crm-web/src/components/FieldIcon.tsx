import type { LucideIcon } from 'lucide-react'

// Classes de input/select/textarea com espaço à esquerda para o ícone interno.
export const iconInputCls = 'w-full pl-10 pr-3.5 py-2.5 rounded-lg border border-slate-200 text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition'
export const iconSelectCls = 'w-full pl-10 pr-3.5 py-2.5 rounded-lg border border-slate-200 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition bg-white'
export const iconTextareaCls = 'w-full pl-10 pr-3.5 py-2.5 rounded-lg border border-slate-200 text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition resize-none'

/** Envolve um input/select com um ícone discreto à esquerda, dentro do campo. */
export function InputIcon({ icon: Icon, children, className = '' }: { icon: LucideIcon; children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative ${className}`}>
      <Icon size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
      {children}
    </div>
  )
}

/** Igual, mas com o ícone alinhado ao topo (para textareas). */
export function TextareaIcon({ icon: Icon, children, className = '' }: { icon: LucideIcon; children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative ${className}`}>
      <Icon size={15} className="absolute left-3 top-3 text-slate-400 pointer-events-none" />
      {children}
    </div>
  )
}
