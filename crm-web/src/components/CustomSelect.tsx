import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface SelectOption {
  value: string
  label: string
  icon?: LucideIcon
  dotColor?: string
}

interface CustomSelectProps {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  icon?: LucideIcon
  align?: 'left' | 'right' | 'auto'
  className?: string
  buttonClassName?: string
  disabled?: boolean
}

export default function CustomSelect({
  value,
  onChange,
  options,
  placeholder = 'Selecione...',
  icon: Icon,
  align = 'auto',
  className = '',
  buttonClassName = '',
  disabled = false,
}: CustomSelectProps) {
  const [open, setOpen] = useState(false)
  const [openUp, setOpenUp] = useState(false)
  const [computedAlign, setComputedAlign] = useState<'left' | 'right'>('left')
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedOption = options.find(o => o.value === value)

  useEffect(() => {
    if (!open) return

    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      const popoverWidth = 240
      const popoverHeight = 220

      // Alinhamento Horizontal
      if (align === 'right') {
        setComputedAlign('right')
      } else if (align === 'left') {
        setComputedAlign('left')
      } else {
        if (rect.left + popoverWidth > window.innerWidth - 20) {
          setComputedAlign('right')
        } else {
          setComputedAlign('left')
        }
      }

      // Direção Vertical (Abre para cima se estiver perto do rodapé da tela)
      if (rect.bottom + popoverHeight > window.innerHeight && rect.top > popoverHeight) {
        setOpenUp(true)
      } else {
        setOpenUp(false)
      }
    }

    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open, align])

  return (
    <div className={`relative ${open ? 'z-50' : 'z-auto'} ${className}`} ref={containerRef}>
      {/* Botão Gatilho Estilizado */}
      <button
        type="button"
        disabled={disabled}
        onClick={e => {
          e.stopPropagation()
          if (!disabled) setOpen(prev => !prev)
        }}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-semibold transition-all shadow-2xs select-none bg-white ${
          disabled
            ? 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed opacity-75'
            : open
            ? 'border-emerald-500 ring-2 ring-emerald-500/20 text-slate-900 cursor-pointer'
            : 'border-slate-200 hover:border-slate-300 text-slate-800 cursor-pointer'
        } ${buttonClassName}`}
      >
        {Icon && <Icon size={14} className="text-slate-400 shrink-0" />}

        {selectedOption?.dotColor && (
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: selectedOption.dotColor }} />
        )}

        <span className="truncate text-left max-w-[140px]">
          {selectedOption ? selectedOption.label : placeholder}
        </span>

        <ChevronDown
          size={14}
          className={`text-slate-400 shrink-0 transition-transform duration-200 ml-auto ${open ? 'rotate-180 text-emerald-600' : ''}`}
        />
      </button>

      {/* Menu Flutuante Popover Customizado */}
      {open && (
        <div
          onClick={e => e.stopPropagation()}
          className={`absolute ${openUp ? 'bottom-full mb-1.5' : 'top-full mt-1.5'} min-w-[200px] w-full sm:w-max max-w-xs max-h-60 overflow-y-auto bg-white rounded-xl border border-slate-200/90 shadow-dropdown z-50 p-1.5 animate-fade-in ${computedAlign === 'right' ? 'right-0' : 'left-0'}`}
        >
          <div className="space-y-0.5">
            {options.map(opt => {
              const isSelected = opt.value === value
              const OptIcon = opt.icon
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value)
                    setOpen(false)
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer text-left ${
                    isSelected
                      ? 'bg-emerald-600 text-white font-bold shadow-2xs'
                      : 'text-slate-700 hover:bg-slate-50 hover:text-slate-950'
                  }`}
                >
                  {OptIcon && <OptIcon size={14} className={isSelected ? 'text-white' : 'text-slate-400'} />}

                  {opt.dotColor && (
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: isSelected ? '#ffffff' : opt.dotColor }} />
                  )}

                  <span className="flex-1 truncate">{opt.label}</span>

                  {isSelected && <Check size={14} className="text-white shrink-0" />}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
