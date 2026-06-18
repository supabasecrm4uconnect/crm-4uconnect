import { getInitials, getAvatarColor } from '../lib/helpers'

interface LeadAvatarProps {
  nome: string
  foto_url?: string | null
  size?: 'sm' | 'md' | 'lg'
}

const sizes = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-sm',
}

export default function LeadAvatar({ nome, foto_url, size = 'sm' }: LeadAvatarProps) {
  const sz = sizes[size]
  if (foto_url) {
    return (
      <img
        src={foto_url}
        alt=""
        className={`${sz} rounded-full object-cover shrink-0`}
        onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
      />
    )
  }
  return (
    <div className={`${sz} rounded-full flex items-center justify-center font-semibold shrink-0 ${getAvatarColor(nome)}`}>
      {getInitials(nome)}
    </div>
  )
}
