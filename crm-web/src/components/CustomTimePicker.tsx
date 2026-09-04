import { useState, useRef, useEffect } from 'react'
import { Clock, ChevronDown, Sparkles } from 'lucide-react'

export interface CustomTimePickerProps {
  value: string // 'HH:MM'
  onChange: (time: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  buttonClassName?: string
}

const COMMON_PRESETS = [
  '08:00', '09:00', '10:00', '11:00',
  '13:30', '14:00', '15:00', '16:00',
  '17:00', '18:00', '19:00', '20:00'
]

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const MINUTES = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55']

export default function CustomTimePicker({
  value,
  onChange,
  placeholder = 'Selecionar horário',
  disabled = false,
  className = '',
  buttonClassName = '',
}: CustomTimePickerProps) {
  const [open, setOpen] = useState(false)
  const [alignRight, setAlignRight] = useState(false)
  const [openUp, setOpenUp] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Extrai hora e minuto selecionados
  const [selectedHour, setSelectedHour] = useState(() => {
    if (value && value.includes(':')) return value.split(':')[0]
    return '09'
  })
  const [selectedMinute, setSelectedMinute] = useState(() => {
    if (value && value.includes(':')) {
      const min = value.split(':')[1]
      return min.slice(0, 2)
    }
    return '00'
  })

  // Sincroniza se o valor externo mudar
  useEffect(() => {
    if (value && value.includes(':')) {
      const [h, m] = value.split(':')
      setSelectedHour(h.padStart(2, '0'))
      setSelectedMinute(m.slice(0, 2).padStart(2, '0'))
    }
  }, [value])

  // Ajusta alinhamento horizontal e vertical (evita corte inferior)
  useEffect(() => {
    if (open && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      const popoverWidth = 260
      const popoverHeight = 310
      setAlignRight(rect.left + popoverWidth > window.innerWidth - 16)
      // Se não couber embaixo e tiver espaço em cima, abre para cima!
      const shouldOpenUp = window.innerHeight - rect.bottom < popoverHeight && rect.top > popoverHeight - 50
      setOpenUp(shouldOpenUp)
    }
  }, [open])

  // Fecha ao clicar fora
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  function handleSelectTime(h: string, m: string) {
    setSelectedHour(h)
    setSelectedMinute(m)
    onChange(`${h}:${m}`)
  }

  function handleNow() {
    const now = new Date()
    const h = String(now.getHours()).padStart(2, '0')
    const rawM = now.getMinutes()
    const roundedM = String(Math.round(rawM / 5) * 5 % 60).padStart(2, '0')
    handleSelectTime(h, roundedM)
    setOpen(false)
  }

  const displayTime = value ? value.slice(0, 5) : ''

  return (
    <div className={`relative inline-block w-full ${className}`} ref={containerRef}>
      {/* Botão Gatilho */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(prev => !prev)}
        className={`flex items-center justify-between gap-2.5 px-3 py-2 rounded-lg border text-xs font-semibold transition-all cursor-pointer select-none shadow-2xs ${
          open
            ? 'border-brand-500 bg-white ring-2 ring-brand-500/20 text-slate-900'
            : 'border-slate-200 bg-white hover:border-slate-300 text-slate-800'
        } ${disabled ? 'opacity-50 cursor-not-allowed bg-slate-50' : ''} ${buttonClassName}`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Clock size={14} className={displayTime ? 'text-brand-600' : 'text-slate-400'} />
          <span className={`truncate font-mono ${displayTime ? 'text-slate-900 font-bold' : 'text-slate-400 font-sans'}`}>
            {displayTime || placeholder}
          </span>
        </div>
        <ChevronDown
          size={14}
          className={`text-slate-400 shrink-0 transition-transform duration-200 ${
            open ? 'rotate-180 text-brand-600' : ''
          }`}
        />
      </button>

      {/* Popover Flutuante de Seleção de Horário */}
      {open && (
        <div
          className={`absolute z-50 bg-white rounded-xl border border-slate-200 shadow-dropdown p-3 animate-fade-in w-68 ${
            openUp ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
          } ${alignRight ? 'right-0' : 'left-0'}`}
        >
          {/* Header com Display do Horário Atual */}
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Horário</span>
              <p className="text-sm font-black font-mono text-slate-900">
                {selectedHour}:{selectedMinute}
              </p>
            </div>
            <button
              type="button"
              onClick={handleNow}
              className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-brand-50 hover:bg-brand-100 text-brand-700 text-[10px] font-bold transition cursor-pointer"
            >
              <Sparkles size={11} />
              Agora
            </button>
          </div>

          {/* Colunas de Hora e Minuto */}
          <div className="grid grid-cols-2 gap-2 mb-2.5">
            {/* Coluna Horas */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 text-center">Hora</p>
              <div className="h-28 overflow-y-auto pr-0.5 space-y-0.5 rounded-xl border border-slate-100 p-1 bg-slate-50/50">
                {HOURS.map(h => {
                  const isSelected = selectedHour === h
                  return (
                    <button
                      key={h}
                      type="button"
                      onClick={() => handleSelectTime(h, selectedMinute)}
                      className={`w-full py-0.5 rounded-md text-xs font-mono font-bold transition-all text-center cursor-pointer ${
                        isSelected
                          ? 'bg-brand-600 text-white shadow-2xs'
                          : 'text-slate-700 hover:bg-slate-200/70'
                      }`}
                    >
                      {h}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Coluna Minutos */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 text-center">Minuto</p>
              <div className="h-28 overflow-y-auto pr-0.5 space-y-0.5 rounded-xl border border-slate-100 p-1 bg-slate-50/50">
                {MINUTES.map(m => {
                  const isSelected = selectedMinute === m
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => handleSelectTime(selectedHour, m)}
                      className={`w-full py-0.5 rounded-md text-xs font-mono font-bold transition-all text-center cursor-pointer ${
                        isSelected
                          ? 'bg-brand-600 text-white shadow-2xs'
                          : 'text-slate-700 hover:bg-slate-200/70'
                      }`}
                    >
                      {m}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Presets Rápidos */}
          <div className="pt-2 border-t border-slate-100">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Atalhos rápidos</p>
            <div className="grid grid-cols-4 gap-1">
              {COMMON_PRESETS.map(preset => {
                const isSelected = value === preset
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      const [h, m] = preset.split(':')
                      handleSelectTime(h, m)
                      setOpen(false)
                    }}
                    className={`py-0.5 rounded-md text-[10px] font-mono font-bold transition-all text-center cursor-pointer border ${
                      isSelected
                        ? 'bg-brand-600 text-white border-brand-600 shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                    }`}
                  >
                    {preset}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Botão de Confirmar */}
          <div className="mt-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="w-full py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold transition cursor-pointer shadow-2xs text-center"
            >
              Confirmar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
