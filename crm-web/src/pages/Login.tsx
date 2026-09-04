import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Eye, EyeOff, Loader2, Mail, Lock, User, Building2, Phone } from 'lucide-react'

type Mode = 'login' | 'signup'

function normalizeWhatsApp(value: string): string | null {
  const digits = value.replace(/\D/g, '')
  const withCountryCode = digits.length === 10 || digits.length === 11 ? `55${digits}` : digits

  if (!/^[1-9]\d{9,14}$/.test(withCountryCode)) return null
  return `+${withCountryCode}`
}

export default function Login() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>('login')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const [nome, setNome] = useState('')
  const [nomeEmpresa, setNomeEmpresa] = useState('')
  const [signupWhatsApp, setSignupWhatsApp] = useState('')
  const [signupEmail, setSignupEmail] = useState('')
  const [signupPassword, setSignupPassword] = useState('')
  const [signupConfirm, setSignupConfirm] = useState('')
  const [showSignupPassword, setShowSignupPassword] = useState(false)
  const [showSignupConfirm, setShowSignupConfirm] = useState(false)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  function switchMode(next: Mode) {
    setMode(next)
    setError('')
    setSuccessMsg('')
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('E-mail ou senha incorretos.')
      setLoading(false)
      return
    }
    navigate('/dashboard')
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!nome.trim()) { setError('Informe seu nome completo.'); return }
    if (!nomeEmpresa.trim()) { setError('Informe o nome da empresa.'); return }
    const whatsappNormalizado = normalizeWhatsApp(signupWhatsApp)
    if (!whatsappNormalizado) { setError('Informe um WhatsApp válido com DDD.'); return }
    if (signupPassword.length < 8) { setError('A senha deve ter pelo menos 8 caracteres.'); return }
    if (signupPassword !== signupConfirm) { setError('As senhas não coincidem.'); return }
    setLoading(true)

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: signupEmail,
      password: signupPassword,
      options: {
        data: {
          full_name: nome.trim(),
          empresa: nomeEmpresa.trim(),
          whatsapp: whatsappNormalizado,
        }
      },
    })

    if (signUpError) {
      const msg = signUpError.message.toLowerCase()
      setError(
        msg.includes('already') || msg.includes('registered')
          ? 'Este e-mail já está cadastrado.'
          : signUpError.message
      )
      setLoading(false)
      return
    }

    if (data.user) {
      await supabase.from('profiles').update({
        nome: nome.trim(),
      }).eq('id', data.user.id)

      if (nomeEmpresa.trim()) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('organization_id')
          .eq('id', data.user.id)
          .single()

        if (prof?.organization_id) {
          await supabase
            .from('organizations')
            .update({
              nome: nomeEmpresa.trim(),
              nome_exibicao: nomeEmpresa.trim(),
            })
            .eq('id', prof.organization_id)
        }
      }
    }

    if (data.session) {
      navigate('/dashboard')
      return
    }

    setLoading(false)
    switchMode('login')
    setSuccessMsg('Conta criada! Verifique seu e-mail para confirmar o cadastro.')
  }

  const inputBase = 'w-full h-10 pl-9 pr-3 rounded-lg border border-slate-200 bg-white text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition'
  const inputWithEye = 'w-full h-10 pl-9 pr-10 rounded-lg border border-slate-200 bg-white text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition'
  const iconCls = 'absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none'

  return (
    <div className="min-h-screen bg-slate-100/90 flex items-center justify-center p-4 sm:p-6">
      {/* Card Centralizado com Cantos Elegantes */}
      <div className="w-full max-w-[430px] bg-white rounded-xl border border-slate-200 shadow-xl p-7 sm:p-8 flex flex-col justify-between transition-all duration-200">
        <div>
          {/* Header com Tipografia Sora */}
          <div className="text-left mb-6">
            <h2 className="font-['Sora'] text-2xl font-extrabold tracking-tight text-slate-900 leading-none">
              Connect <span className="text-emerald-600">CRM</span>
            </h2>
            <p className="text-slate-500 text-xs mt-1.5">Gestão de leads integrada ao seu WhatsApp Web.</p>
          </div>

          {/* Abas: Entrar vs Criar Conta */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/80 mb-5">
            <button
              type="button"
              onClick={() => switchMode('login')}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer select-none ${
                mode === 'login'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => switchMode('signup')}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer select-none ${
                mode === 'signup'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Criar Conta
            </button>
          </div>

          {/* Mensagens de Feedback */}
          {successMsg && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3.5 py-2.5 mb-4 text-emerald-800 text-xs font-medium animate-fade-in">
              {successMsg}
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5 mb-4 text-red-700 text-xs font-medium animate-fade-in">
              {error}
            </div>
          )}

          {/* Formulário: Modo Login */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4 pt-2 animate-fade-in">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">E-mail</label>
                <div className="relative">
                  <Mail className={iconCls} size={15} />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    required
                    className={inputBase}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Senha</label>
                <div className="relative">
                  <Lock className={iconCls} size={15} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className={inputWithEye}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition cursor-pointer"
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-10 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
                >
                  {loading && <Loader2 size={14} className="animate-spin" />}
                  {loading ? 'Entrando...' : 'Entrar na Conta'}
                </button>
              </div>
            </form>
          )}

          {/* Formulário: Modo Cadastro */}
          {mode === 'signup' && (
            <form onSubmit={handleSignup} className="space-y-3 animate-fade-in">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Nome completo</label>
                <div className="relative">
                  <User className={iconCls} size={14} />
                  <input
                    type="text"
                    value={nome}
                    onChange={e => setNome(e.target.value)}
                    placeholder="Seu nome"
                    required
                    className={inputBase}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Nome da Empresa</label>
                <div className="relative">
                  <Building2 className={iconCls} size={14} />
                  <input
                    type="text"
                    value={nomeEmpresa}
                    onChange={e => setNomeEmpresa(e.target.value)}
                    placeholder="Ex: Imovvi Contabilidade"
                    required
                    className={inputBase}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">WhatsApp principal da empresa</label>
                <div className="relative">
                  <Phone className={iconCls} size={14} />
                  <input
                    type="tel"
                    inputMode="tel"
                    value={signupWhatsApp}
                    onChange={e => setSignupWhatsApp(e.target.value)}
                    placeholder="(11) 99999-9999"
                    required
                    className={inputBase}
                  />
                </div>
                <p className="text-[10px] text-slate-400">Usaremos este número para contato sobre a sua conta.</p>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">E-mail</label>
                <div className="relative">
                  <Mail className={iconCls} size={14} />
                  <input
                    type="email"
                    value={signupEmail}
                    onChange={e => setSignupEmail(e.target.value)}
                    placeholder="seu@email.com"
                    required
                    className={inputBase}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Senha</label>
                  <div className="relative">
                    <Lock className={iconCls} size={13} />
                    <input
                      type={showSignupPassword ? 'text' : 'password'}
                      value={signupPassword}
                      onChange={e => setSignupPassword(e.target.value)}
                      placeholder="Mín. 8 dígitos"
                      required
                      className="w-full h-10 pl-8 pr-7 rounded-xl border border-slate-200 bg-white text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSignupPassword(!showSignupPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition cursor-pointer"
                    >
                      {showSignupPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Confirmar</label>
                  <div className="relative">
                    <Lock className={iconCls} size={13} />
                    <input
                      type={showSignupConfirm ? 'text' : 'password'}
                      value={signupConfirm}
                      onChange={e => setSignupConfirm(e.target.value)}
                      placeholder="Repita a senha"
                      required
                      className="w-full h-10 pl-8 pr-7 rounded-xl border border-slate-200 bg-white text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSignupConfirm(!showSignupConfirm)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition cursor-pointer"
                    >
                      {showSignupConfirm ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-10 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
                >
                  {loading && <Loader2 size={14} className="animate-spin" />}
                  {loading ? 'Cadastrando...' : 'Criar Minha Conta'}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer do Card */}
        <div className="pt-4 mt-6 border-t border-slate-100 text-center">
          <p className="text-slate-400 text-[11px]">© 2026 Connect CRM</p>
        </div>
      </div>
    </div>
  )
}
