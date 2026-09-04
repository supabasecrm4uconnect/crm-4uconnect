import { useState, useEffect, useMemo } from 'react'
import {
  User, Lock, X, Loader2, Eye, EyeOff, Building2,
  Mail, Shield, KeyRound, CheckCircle2, AlertCircle, Save
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { getInitials, departmentConfig } from '../lib/helpers'
import { InputIcon, iconInputCls } from './FieldIcon'

interface UserProfileModalProps {
  open: boolean
  onClose: () => void
  onProfileUpdated?: () => void
}

type Tab = 'dados' | 'senha'

export default function UserProfileModal({ open, onClose, onProfileUpdated }: UserProfileModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>('dados')
  const [loading, setLoading] = useState(true)
  const [savingName, setSavingName] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)

  // Dados do usuário
  const [userId, setUserId] = useState<string | null>(null)
  const [nome, setNome] = useState('')
  const [initialNome, setInitialNome] = useState('')
  const [email, setEmail] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [departamento, setDepartamento] = useState('comercial')

  const isNameDirty = useMemo(() => {
    return nome.trim().length > 0 && nome.trim() !== initialNome.trim()
  }, [nome, initialNome])

  // Senha
  const [senhaAtual, setSenhaAtual] = useState('')
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [showSenhaAtual, setShowSenhaAtual] = useState(false)
  const [showNovaSenha, setShowNovaSenha] = useState(false)
  const [showConfirmarSenha, setShowConfirmarSenha] = useState(false)

  // Mensagens
  const [nameSuccess, setNameSuccess] = useState('')
  const [nameError, setNameError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [passwordError, setPasswordError] = useState('')

  useEffect(() => {
    if (open) {
      loadUserProfile()
      setNameSuccess('')
      setNameError('')
      setPasswordSuccess('')
      setPasswordError('')
      setSenhaAtual('')
      setNovaSenha('')
      setConfirmarSenha('')
    }
  }, [open])

  async function loadUserProfile() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }

    setUserId(user.id)
    setEmail(user.email || '')

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('nome, email, is_admin, departamento')
      .eq('id', user.id)
      .single()

    let profileData: {
      nome: string | null
      email: string | null
      is_admin: boolean | null
      departamento?: string | null
    } | null = profile
    if (error) {
      const { data: fallbackProfile } = await supabase
        .from('profiles')
        .select('nome, email, is_admin')
        .eq('id', user.id)
        .single()
      profileData = fallbackProfile
    }

    if (profileData) {
      setNome(profileData.nome || '')
      setInitialNome(profileData.nome || '')
      setIsAdmin(profileData.is_admin === true)
      setDepartamento(profileData.departamento || 'comercial')
    }
    setLoading(false)
  }

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault()
    if (!userId || !nome.trim()) return

    setSavingName(true)
    setNameSuccess('')
    setNameError('')

    try {
      const { error: profileErr } = await supabase
        .from('profiles')
        .update({ nome: nome.trim() })
        .eq('id', userId)

      if (profileErr) throw profileErr

      // Atualiza também os metadados do auth
      await supabase.auth.updateUser({
        data: { nome: nome.trim() }
      })

      setInitialNome(nome.trim())
      setNameSuccess('Nome atualizado com sucesso!')
      if (onProfileUpdated) onProfileUpdated()
      setTimeout(() => setNameSuccess(''), 3500)
    } catch (err: any) {
      console.error('Erro ao atualizar nome:', err)
      setNameError(err?.message || 'Erro ao atualizar nome. Tente novamente.')
    } finally {
      setSavingName(false)
    }
  }

  async function handleUpdatePassword(e: React.FormEvent) {
    e.preventDefault()
    setPasswordSuccess('')
    setPasswordError('')

    if (!senhaAtual) {
      setPasswordError('Informe sua senha atual.')
      return
    }

    if (novaSenha.length < 6) {
      setPasswordError('A nova senha deve conter no mínimo 6 caracteres.')
      return
    }

    if (novaSenha !== confirmarSenha) {
      setPasswordError('As senhas digitadas não coincidem.')
      return
    }

    if (novaSenha === senhaAtual) {
      setPasswordError('A nova senha deve ser diferente da senha atual.')
      return
    }

    setSavingPassword(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !user.email) {
        setPasswordError('Sessão expirada. Faça login novamente.')
        setSavingPassword(false)
        return
      }

      // Reautentica com a senha atual para garantir que é o titular
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: senhaAtual,
      })

      if (verifyError) {
        setPasswordError('A senha atual informada está incorreta.')
        setSavingPassword(false)
        return
      }

      // Aplica a nova senha
      const { error } = await supabase.auth.updateUser({
        password: novaSenha
      })

      if (error) throw error

      setPasswordSuccess('Senha alterada com sucesso!')
      setSenhaAtual('')
      setNovaSenha('')
      setConfirmarSenha('')
      setTimeout(() => {
        setPasswordSuccess('')
        onClose()
      }, 2000)
    } catch (err: any) {
      console.error('Erro ao atualizar senha:', err)
      setPasswordError(err?.message || 'Não foi possível alterar a senha.')
    } finally {
      setSavingPassword(false)
    }
  }

  if (!open) return null

  const depCfg = departmentConfig(departamento)
  const initials = getInitials(nome || email)

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-[70] p-4 animate-fade-in">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-100">

        {/* Header do Perfil */}
        <div className="relative bg-gradient-to-r from-brand-900 via-brand-800 to-emerald-950 px-6 pt-6 pb-5 text-white">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 text-white/70 hover:text-white transition p-1.5 rounded-full hover:bg-white/10 cursor-pointer"
          >
            <X size={18} />
          </button>

          <div className="flex items-center gap-3.5">
            <div className="w-14 h-14 rounded-xl bg-white/15 text-white backdrop-blur-md flex items-center justify-center font-extrabold text-lg border border-white/20 shadow-inner">
              {initials}
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold truncate leading-tight">{nome || 'Meu Perfil'}</h2>
              <p className="text-brand-200 text-xs truncate mt-0.5">{email}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-white/20 text-white backdrop-blur-xs">
                  <Shield size={10} />
                  {isAdmin ? 'Administrador' : 'Atendente'}
                </span>
                <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-500/30 text-emerald-200 border border-emerald-400/30`}>
                  <Building2 size={10} />
                  {depCfg.label.split(' / ')[0]}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Abas */}
        <div className="flex border-b border-slate-100 px-6 pt-2 bg-slate-50/50">
          <button
            type="button"
            onClick={() => setActiveTab('dados')}
            className={`flex items-center gap-2 pb-3 px-3 text-xs font-bold transition border-b-2 cursor-pointer ${
              activeTab === 'dados'
                ? 'border-emerald-600 text-emerald-900'
                : 'border-transparent text-slate-400 hover:text-slate-700'
            }`}
          >
            <User size={14} />
            Meus Dados
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('senha')}
            className={`flex items-center gap-2 pb-3 px-3 text-xs font-bold transition border-b-2 cursor-pointer ${
              activeTab === 'senha'
                ? 'border-emerald-600 text-emerald-900'
                : 'border-transparent text-slate-400 hover:text-slate-700'
            }`}
          >
            <Lock size={14} />
            Alterar Senha
          </button>
        </div>

        {/* Conteúdo das Abas */}
        <div className="p-6">
          {loading ? (
            <div className="space-y-4 animate-fade-in" aria-busy="true">
              <div className="space-y-1.5">
                <div className="w-24 h-3 rounded skeleton-shimmer" />
                <div className="w-full h-10 rounded-lg skeleton-shimmer" />
              </div>
              <div className="space-y-1.5">
                <div className="w-16 h-3 rounded skeleton-shimmer" />
                <div className="w-full h-10 rounded-lg skeleton-shimmer" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <div className="w-20 h-3 rounded skeleton-shimmer" />
                  <div className="w-full h-10 rounded-lg skeleton-shimmer" />
                </div>
                <div className="space-y-1.5">
                  <div className="w-16 h-3 rounded skeleton-shimmer" />
                  <div className="w-full h-10 rounded-lg skeleton-shimmer" />
                </div>
              </div>
            </div>
          ) : activeTab === 'dados' ? (
            <form onSubmit={handleSaveName} className="space-y-4">
              {nameSuccess && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium animate-fade-in">
                  <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                  <span>{nameSuccess}</span>
                </div>
              )}

              {nameError && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-medium animate-fade-in">
                  <AlertCircle size={15} className="text-red-600 shrink-0" />
                  <span>{nameError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Nome Completo</label>
                <InputIcon icon={User}>
                  <input
                    type="text"
                    value={nome}
                    onChange={e => setNome(e.target.value)}
                    required
                    placeholder="Seu nome completo"
                    className={iconInputCls}
                  />
                </InputIcon>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">E-mail</label>
                <InputIcon icon={Mail}>
                  <input
                    type="email"
                    value={email}
                    disabled
                    className={`${iconInputCls} bg-slate-50 text-slate-400 cursor-not-allowed`}
                  />
                </InputIcon>
                <p className="text-[11px] text-slate-400 mt-1">O e-mail é gerenciado pelo administrador.</p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Departamento</span>
                  <p className="text-xs font-bold text-slate-800 mt-0.5">{depCfg.label}</p>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Função</span>
                  <p className="text-xs font-bold text-slate-800 mt-0.5">{isAdmin ? 'Administrador' : 'Atendente'}</p>
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 transition cursor-pointer shadow-2xs select-none"
                >
                  <X size={14} className="text-slate-400" />
                  Fechar
                </button>
                <button
                  type="submit"
                  disabled={savingName || !isNameDirty}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200 disabled:cursor-not-allowed border border-emerald-700/50 text-white text-xs font-bold transition shadow-2xs cursor-pointer select-none"
                >
                  {savingName ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                  {savingName ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              {passwordSuccess && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium animate-fade-in">
                  <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                  <span>{passwordSuccess}</span>
                </div>
              )}

              {passwordError && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-medium animate-fade-in">
                  <AlertCircle size={15} className="text-red-600 shrink-0" />
                  <span>{passwordError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Senha Atual *</label>
                <div className="relative">
                  <InputIcon icon={Lock}>
                    <input
                      type={showSenhaAtual ? 'text' : 'password'}
                      value={senhaAtual}
                      onChange={e => setSenhaAtual(e.target.value)}
                      required
                      placeholder="Sua senha atual"
                      className={`${iconInputCls} pr-10`}
                    />
                  </InputIcon>
                  <button
                    type="button"
                    onClick={() => setShowSenhaAtual(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition cursor-pointer"
                  >
                    {showSenhaAtual ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Nova Senha *</label>
                <div className="relative">
                  <InputIcon icon={Lock}>
                    <input
                      type={showNovaSenha ? 'text' : 'password'}
                      value={novaSenha}
                      onChange={e => setNovaSenha(e.target.value)}
                      required
                      placeholder="Mínimo 6 caracteres"
                      className={`${iconInputCls} pr-10`}
                    />
                  </InputIcon>
                  <button
                    type="button"
                    onClick={() => setShowNovaSenha(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition cursor-pointer"
                  >
                    {showNovaSenha ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Confirmar Nova Senha *</label>
                <div className="relative">
                  <InputIcon icon={Lock}>
                    <input
                      type={showConfirmarSenha ? 'text' : 'password'}
                      value={confirmarSenha}
                      onChange={e => setConfirmarSenha(e.target.value)}
                      required
                      placeholder="Repita a nova senha"
                      className={`${iconInputCls} pr-10`}
                    />
                  </InputIcon>
                  <button
                    type="button"
                    onClick={() => setShowConfirmarSenha(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition cursor-pointer"
                  >
                    {showConfirmarSenha ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-amber-50/70 border border-amber-200/80 text-amber-900 text-[11px] leading-relaxed">
                💡 <strong>Dica de Segurança:</strong> Digite sua senha atual para confirmar a titularidade antes de definir a nova senha.
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 transition cursor-pointer shadow-2xs select-none"
                >
                  <X size={14} className="text-slate-400" />
                  Fechar
                </button>
                <button
                  type="submit"
                  disabled={savingPassword || !senhaAtual || !novaSenha || !confirmarSenha}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 active:bg-amber-800 disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200 disabled:cursor-not-allowed border border-amber-700/50 text-white text-xs font-bold transition shadow-2xs cursor-pointer select-none"
                >
                  {savingPassword ? <Loader2 size={13} className="animate-spin" /> : <KeyRound size={13} />}
                  {savingPassword ? 'Verificando...' : 'Alterar Senha'}
                </button>
              </div>
            </form>
          )}
        </div>

      </div>
    </div>
  )
}
