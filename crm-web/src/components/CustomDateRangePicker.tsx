import { useState, useRef, useEffect } from 'react'
import { CalendarDays, ChevronDown, Check } from 'lucide-react'
import CustomCalendar from './CustomCalendar'
import { localDateStr, formatDate } from '../lib/helpers'

export interface CustomDateRangePickerProps {
  startDate: string // YYYY-MM-DD
  endDate: string // YYYY-MM-DD
  onChange: (start: string, end: string) => void
  label?: string
  align?: 'left' | 'right' | 'auto'
  className?: string
  buttonClassName?: string
}

export default function CustomDateRangePicker({
  startDate,
  endDate,
  onChange,
  label = 'Filtrar por data',
  align = 'auto',
  className = '',
  buttonClassName = '',
}: CustomDateRangePickerProps) {
  const [open, setOpen] = useState(false)
  const [tempStart, setTempStart] = useState(startDate)
  const [tempEnd, setTempEnd] = useState(endDate)
  const [computedAlign, setComputedAlign] = useState<'left' | 'right'>('left')
  const containerRef = useRef<HTMLDivElement>(null)

  const todayStr = localDateStr()

  useEffect(() => {
    setTempStart(startDate)
    setTempEnd(endDate)
  }, [startDate, endDate, open])

  useEffect(() => {
    if (!open) return
    if (align === 'right') {
      setComputedAlign('right')
    } else if (align === 'left') {
      setComputedAlign('left')
    } else if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      const popoverWidth = 320
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
    if (!startDate && !endDate) return label
    if (startDate === todayStr && endDate === todayStr) return 'Hoje'
    if (startDate && !endDate) return `A partir de ${formatDate(startDate)}`
    if (!startDate && endDate) return `Até ${formatDate(endDate)}`
    if (startDate === endDate) return formatDate(startDate)
    return `${formatDate(startDate)} — ${formatDate(endDate)}`
  }

  function applyPreset(preset: 'todos' | 'hoje' | 'ontem' | '7dias' | 'mes' | 'mes_passado') {
    const now = new Date()
    if (preset === 'todos') {
      onChange('', '')
    } else if (preset === 'hoje') {
      onChange(todayStr, todayStr)
    } else if (preset === 'ontem') {
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
      onChange(yesterday, yesterday)
    } else if (preset === '7dias') {
      const next7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
      onChange(todayStr, next7)
    } else if (preset === 'mes') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10)
      onChange(startOfMonth, endOfMonth)
    } else if (preset === 'mes_passado') {
      const startOfPrev = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10)
      const endOfPrev = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10)
      onChange(startOfPrev, endOfPrev)
    }
    setOpen(false)
  }

  function handleApply() {
    onChange(tempStart, tempEnd)
    setOpen(false)
  }

  function handleClear() {
    onChange('', '')
    setTempStart('')
    setTempEnd('')
    setOpen(false)
  }

  const hasFilter = !!(startDate || endDate)

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {/* Botão Gatilho */}
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-semibold transition-all shadow-2xs cursor-pointer select-none ${
          open
            ? 'border-brand-500 ring-2 ring-brand-500/20 bg-white text-slate-900'
            : hasFilter
            ? 'border-brand-300 bg-brand-50/70 text-brand-900 hover:bg-brand-50'
            : 'border-slate-200 bg-slate-50/70 hover:bg-white text-slate-700 hover:border-slate-300'
        } ${buttonClassName}`}
      >
        <CalendarDays size={14} className={hasFilter ? 'text-brand-600 shrink-0' : 'text-slate-400 shrink-0'} />
        <span className="truncate max-w-[170px]">{getDisplayLabel()}</span>
        <ChevronDown
          size={14}
          className={`text-slate-400 shrink-0 transition-transform duration-200 ml-auto ${open ? 'rotate-180 text-brand-600' : ''}`}
        />
      </button>

      {/* Popover com Grade Gráfica Customizada */}
      {open && (
        <div className={`absolute top-full mt-1.5 w-80 bg-white rounded-xl border border-slate-200/90 shadow-dropdown z-50 p-3 animate-fade-in ${computedAlign === 'right' ? 'right-0' : 'left-0'}`}>

          {/* Atalhos Rápidos */}
          <div className="mb-2.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5 px-1">
              Atalhos Rápidos
            </span>
            <div className="grid grid-cols-3 gap-1">
              <button
                type="button"
                onClick={() => applyPreset('hoje')}
                className="px-2 py-1 rounded-lg text-[11px] font-bold bg-slate-50 hover:bg-brand-50 hover:text-brand-700 text-slate-700 text-center transition cursor-pointer"
              >
                Hoje
              </button>
              <button
                type="button"
                onClick={() => applyPreset('ontem')}
                className="px-2 py-1 rounded-lg text-[11px] font-bold bg-slate-50 hover:bg-brand-50 hover:text-brand-700 text-slate-700 text-center transition cursor-pointer"
              >
                Ontem
              </button>
              <button
                type="button"
                onClick={() => applyPreset('7dias')}
                className="px-2 py-1 rounded-lg text-[11px] font-bold bg-slate-50 hover:bg-brand-50 hover:text-brand-700 text-slate-700 text-center transition cursor-pointer"
              >
                7 Dias
              </button>
              <button
                type="button"
                onClick={() => applyPreset('mes')}
                className="px-2 py-1 rounded-lg text-[11px] font-bold bg-slate-50 hover:bg-brand-50 hover:text-brand-700 text-slate-700 text-center transition cursor-pointer"
              >
                Este Mês
              </button>
              <button
                type="button"
                onClick={() => applyPreset('mes_passado')}
                className="px-2 py-1 rounded-lg text-[11px] font-bold bg-slate-50 hover:bg-brand-50 hover:text-brand-700 text-slate-700 text-center transition cursor-pointer"
              >
                Mês Passado
              </button>
              <button
                type="button"
                onClick={() => applyPreset('todos')}
                className="px-2 py-1 rounded-lg text-[11px] font-bold bg-slate-50 hover:bg-brand-50 hover:text-brand-700 text-slate-700 text-center transition cursor-pointer"
              >
                Todas
              </button>
            </div>
          </div>

          <div className="border-t border-slate-100 my-2" />

          {/* Grade Gráfica do Calendário Customizado */}
          <CustomCalendar
            mode="range"
            startDate={tempStart}
            endDate={tempEnd}
            onSelectRange={(start, end) => {
              setTempStart(start)
              setTempEnd(end)
            }}
          />

          {/* Rodapé com Resumo e Ações */}
          <div className="border-t border-slate-100 mt-2.5 pt-2.5 flex items-center justify-between px-1">
            <button
              type="button"
              onClick={handleClear}
              className="text-xs font-bold text-slate-500 hover:text-slate-800 transition cursor-pointer"
            >
              Limpar
            </button>

            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400 font-medium">
                {tempStart ? (tempEnd ? `${formatDate(tempStart)} - ${formatDate(tempEnd)}` : formatDate(tempStart)) : 'Selecione as datas'}
              </span>

              <button
                type="button"
                onClick={handleApply}
                disabled={!tempStart}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold transition shadow-2xs cursor-pointer disabled:opacity-40"
              >
                <Check size={13} />
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
