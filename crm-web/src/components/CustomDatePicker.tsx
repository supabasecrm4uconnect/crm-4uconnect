import { useState, useRef, useEffect } from 'react'
import { CalendarDays, ChevronDown } from 'lucide-react'
import CustomCalendar from './CustomCalendar'
import { localDateStr, formatDate } from '../lib/helpers'

export interface CustomDatePickerProps {
  value: string // YYYY-MM-DD
  onChange: (date: string) => void
  label?: string
  placeholder?: string
  minDate?: string
  maxDate?: string
  align?: 'left' | 'right' | 'auto'
  className?: string
  buttonClassName?: string
}

export default function CustomDatePicker({
  value,
  onChange,
  label,
  placeholder = 'Selecionar data...',
  minDate,
  maxDate,
  align = 'auto',
  className = '',
  buttonClassName = '',
}: CustomDatePickerProps) {
  const [open, setOpen] = useState(false)
  const [computedAlign, setComputedAlign] = useState<'left' | 'right'>('left')
  const containerRef = useRef<HTMLDivElement>(null)

  const todayStr = localDateStr()

  useEffect(() => {
    if (!open) return
    if (align === 'right') {
      setComputedAlign('right')
    } else if (align === 'left') {
      setComputedAlign('left')
    } else if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      const popoverWidth = 280
      if (rect.left + popoverWidth > window.innerWidth - 20) {
        setComputedAlign('right')
      } else {
        setComputedAlign('left')
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

  function getDisplayLabel() {
    if (!value) return placeholder
    if (value === todayStr) return 'Hoje'
    return formatDate(value)
  }

  function handleSelectDate(d: string) {
    onChange(d)
    setOpen(false)
  }

  function handleToday() {
    onChange(todayStr)
    setOpen(false)
  }

  function handleClear() {
    onChange('')
    setOpen(false)
  }

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && <label className="block text-xs font-semibold text-slate-700 mb-1">{label}</label>}

      {/* Botão Gatilho */}
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-semibold transition-all shadow-2xs cursor-pointer select-none ${
          open
            ? 'border-brand-500 ring-2 ring-brand-500/20 bg-white text-slate-900'
            : value
            ? 'border-brand-300 bg-brand-50/70 text-brand-900 hover:bg-brand-50'
            : 'border-slate-200 bg-slate-50/70 hover:bg-white text-slate-700 hover:border-slate-300'
        } ${buttonClassName}`}
      >
        <CalendarDays size={14} className={value ? 'text-brand-600 shrink-0' : 'text-slate-400 shrink-0'} />
        <span className="truncate flex-1 text-left">{getDisplayLabel()}</span>
        <ChevronDown
          size={14}
          className={`text-slate-400 shrink-0 transition-transform duration-200 ${open ? 'rotate-180 text-brand-600' : ''}`}
        />
      </button>

      {/* Popover com Grade Gráfica Customizada */}
      {open && (
        <div className={`absolute top-full mt-1.5 w-72 bg-white rounded-xl border border-slate-200/90 shadow-dropdown z-50 p-2 animate-fade-in ${computedAlign === 'right' ? 'right-0' : 'left-0'}`}>
          <CustomCalendar
            mode="single"
            selectedDate={value}
            onSelectDate={handleSelectDate}
            minDate={minDate}
            maxDate={maxDate}
          />

          <div className="border-t border-slate-100 mt-2 pt-2 flex items-center justify-between px-2 pb-1">
            <button
              type="button"
              onClick={handleClear}
              className="text-xs font-bold text-slate-500 hover:text-slate-800 transition cursor-pointer"
            >
              Limpar
            </button>
            <button
              type="button"
              onClick={handleToday}
              className="text-xs font-bold text-brand-600 hover:text-brand-700 transition cursor-pointer"
            >
              Hoje
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
