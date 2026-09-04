import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { localDateStr } from '../lib/helpers'

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
]

const WEEKDAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export interface CustomCalendarProps {
  mode?: 'single' | 'range'
  selectedDate?: string // YYYY-MM-DD
  startDate?: string // YYYY-MM-DD
  endDate?: string // YYYY-MM-DD
  onSelectDate?: (date: string) => void
  onSelectRange?: (start: string, end: string) => void
  minDate?: string
  maxDate?: string
  className?: string
}

export default function CustomCalendar({
  mode = 'single',
  selectedDate = '',
  startDate = '',
  endDate = '',
  onSelectDate,
  onSelectRange,
  minDate,
  maxDate,
  className = '',
}: CustomCalendarProps) {
  const todayStr = localDateStr()

  // Inicializa o mês/ano visível no calendário
  const initialDate = selectedDate || startDate || todayStr
  const [viewYear, setViewYear] = useState(() => {
    const [y] = initialDate.split('-').map(Number)
    return isNaN(y) ? new Date().getFullYear() : y
  })
  const [viewMonth, setViewMonth] = useState(() => {
    const [, m] = initialDate.split('-').map(Number)
    return isNaN(m) ? new Date().getMonth() : m - 1
  })

  const [hoverDate, setHoverDate] = useState<string | null>(null)
  const [rangeSelectingStart, setRangeSelectingStart] = useState<string | null>(null)

  function prevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11)
      setViewYear(y => y - 1)
    } else {
      setViewMonth(m => m - 1)
    }
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0)
      setViewYear(y => y + 1)
    } else {
      setViewMonth(m => m + 1)
    }
  }

  // Gera a matriz de dias (42 células = 6 semanas × 7 dias)
  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay() // 0 = Domingo
    const daysInCurrentMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate()

    const days: {
      dateStr: string
      dayNum: number
      isCurrentMonth: boolean
      isToday: boolean
      isDisabled: boolean
    }[] = []

    // Dias do mês anterior
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i
      const prevM = viewMonth === 0 ? 12 : viewMonth
      const prevY = viewMonth === 0 ? viewYear - 1 : viewYear
      const dateStr = `${prevY}-${String(prevM).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`
      days.push({
        dateStr,
        dayNum,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        isDisabled: (minDate ? dateStr < minDate : false) || (maxDate ? dateStr > maxDate : false),
      })
    }

    // Dias do mês atual
    for (let d = 1; d <= daysInCurrentMonth; d++) {
      const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      days.push({
        dateStr,
        dayNum: d,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
        isDisabled: (minDate ? dateStr < minDate : false) || (maxDate ? dateStr > maxDate : false),
      })
    }

    // Dias do próximo mês para completar 42 células
    const remaining = 42 - days.length
    for (let d = 1; d <= remaining; d++) {
      const nextM = viewMonth === 11 ? 1 : viewMonth + 2
      const nextY = viewMonth === 11 ? viewYear + 1 : viewYear
      const dateStr = `${nextY}-${String(nextM).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      days.push({
        dateStr,
        dayNum: d,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        isDisabled: (minDate ? dateStr < minDate : false) || (maxDate ? dateStr > maxDate : false),
      })
    }

    return days
  }, [viewYear, viewMonth, minDate, maxDate, todayStr])

  function handleDayClick(dateStr: string, isDisabled: boolean) {
    if (isDisabled) return

    if (mode === 'single') {
      onSelectDate?.(dateStr)
      return
    }

    // Mode: Range
    if (!rangeSelectingStart) {
      setRangeSelectingStart(dateStr)
      onSelectRange?.(dateStr, '')
    } else {
      if (dateStr < rangeSelectingStart) {
        onSelectRange?.(dateStr, rangeSelectingStart)
      } else {
        onSelectRange?.(rangeSelectingStart, dateStr)
      }
      setRangeSelectingStart(null)
    }
  }

  const effectiveStart = rangeSelectingStart || startDate
  const effectiveEnd = rangeSelectingStart ? (hoverDate && hoverDate >= rangeSelectingStart ? hoverDate : '') : endDate

  return (
    <div className={`select-none p-1.5 ${className}`}>
      {/* Cabeçalho do Calendário */}
      <div className="flex items-center justify-between mb-2.5 px-1">
        <span className="text-xs font-bold text-slate-900 capitalize">
          {MONTH_NAMES[viewMonth]} <span className="text-slate-500 font-medium">{viewYear}</span>
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={prevMonth}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition cursor-pointer"
            title="Mês anterior"
          >
            <ChevronLeft size={15} />
          </button>
          <button
            type="button"
            onClick={nextMonth}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition cursor-pointer"
            title="Próximo mês"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>

      {/* Dias da Semana */}
      <div className="grid grid-cols-7 gap-1 mb-1 text-center">
        {WEEKDAY_NAMES.map(w => (
          <span key={w} className="text-[10px] font-bold uppercase text-slate-400 py-0.5">
            {w}
          </span>
        ))}
      </div>

      {/* Grade de Dias */}
      <div className="grid grid-cols-7 gap-y-1 gap-x-0.5 text-center">
        {calendarDays.map(({ dateStr, dayNum, isCurrentMonth, isToday, isDisabled }) => {
          const isRangeStart = mode === 'range' && effectiveStart === dateStr
          const isRangeEnd = mode === 'range' && effectiveEnd === dateStr
          const isSelected = mode === 'single'
            ? selectedDate === dateStr
            : isRangeStart || isRangeEnd
          const isInRange = mode === 'range'
            && !!(effectiveStart && effectiveEnd && dateStr > effectiveStart && dateStr < effectiveEnd)

          return (
            <div
              key={dateStr}
              className={`relative py-0.5 ${
                isInRange ? 'bg-brand-50' : ''
              } ${isRangeStart && effectiveEnd ? 'bg-gradient-to-r from-transparent to-brand-50 rounded-l-xl' : ''} ${
                isRangeEnd && effectiveStart ? 'bg-gradient-to-l from-transparent to-brand-50 rounded-r-xl' : ''
              }`}
            >
              <button
                type="button"
                onClick={() => handleDayClick(dateStr, isDisabled)}
                onMouseEnter={() => rangeSelectingStart && setHoverDate(dateStr)}
                disabled={isDisabled}
                className={`w-7 h-7 mx-auto rounded-lg text-xs font-semibold flex items-center justify-center transition-all cursor-pointer relative ${
                  isDisabled
                    ? 'opacity-25 cursor-not-allowed text-slate-400'
                    : isSelected
                    ? 'bg-brand-600 text-white font-bold shadow-xs hover:bg-brand-700'
                    : isInRange
                    ? 'text-brand-900 font-bold hover:bg-brand-100 rounded-none'
                    : isToday
                    ? 'text-brand-700 bg-brand-50/80 font-bold border border-brand-300 hover:bg-brand-100'
                    : isCurrentMonth
                    ? 'text-slate-800 hover:bg-slate-100'
                    : 'text-slate-300 hover:bg-slate-50'
                }`}
              >
                {dayNum}
                {isToday && !isSelected && (
                  <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-brand-600" />
                )}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
