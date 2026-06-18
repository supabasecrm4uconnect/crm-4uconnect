import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Eye, EyeOff, Loader2, Mail, Lock, User } from 'lucide-react'

type Mode = 'login' | 'signup'

export default function Login() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>('login')

  // Login fields
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  // Signup fields
  const [nome, setNome] = useState('')
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
    if (signupPassword.length < 8) { setError('A senha deve ter pelo menos 8 caracteres.'); return }
    if (signupPassword !== signupConfirm) { setError('As senhas não coincidem.'); return }

    setLoading(true)

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: signupEmail,
      password: signupPassword,
      options: { data: { full_name: nome.trim() } },
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

    // Atualiza o nome no perfil criado pelo trigger (que usa o email como fallback)
    if (data.user) {
      await supabase.from('profiles').update({
        nome: nome.trim(),
      }).eq('id', data.user.id)
    }

    // Se a sessão já foi criada (confirmação de e-mail desativada), redireciona
    if (data.session) {
      navigate('/dashboard')
      return
    }

    // Caso contrário, exige confirmação de e-mail
    setLoading(false)
    switchMode('login')
    setSuccessMsg('Conta criada! Verifique seu e-mail para confirmar o cadastro.')
  }

  const inputCls = 'w-full pl-10 pr-3.5 py-2.5 rounded-lg border border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-900 caret-slate-800 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent focus:bg-white transition cursor-text [color-scheme:light]'
  const iconCls  = 'absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none select-none'

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
      <div className="login-border-spin relative w-full max-w-5xl rounded-2xl p-[1.5px] overflow-hidden flex items-center justify-center shadow-2xl">

        <div className="relative w-full min-h-[580px] rounded-[14px] overflow-hidden flex bg-white">

          {/* Lado esquerdo — branding */}
          <div className="hidden md:flex md:w-1/2 bg-emerald-950 flex-col justify-end p-12 relative overflow-hidden rounded-l-[14px]">
            <div
              className="absolute inset-0 bg-cover bg-center rounded-l-[14px]"
              style={{ backgroundImage: `url('/imagem.jpg')` }}
            />
            <div className="absolute inset-0 bg-gradient-to-tr from-emerald-950 via-emerald-900/85 to-emerald-700/50" />

            <div className="relative z-10 space-y-6">
              <div>
                <h1 className="text-white text-3xl font-bold leading-tight mb-4">
                  Organize seus leads.<br />
                  Nunca perca um{' '}
                  <span className="text-emerald-400">follow-up.</span>
                </h1>
                <p className="text-slate-300 text-sm leading-relaxed max-w-md">
                  CRM integrado ao WhatsApp Web para acompanhar cada oportunidade do primeiro contato ao fechamento.
                </p>
              </div>

              <p className="text-slate-400 text-xs">© 2026 4U Connect</p>
            </div>
          </div>

          {/* Lado direito — formulário */}
          <div className="w-full md:w-1/2 bg-white flex items-center justify-center p-12">
            <div className="w-full max-w-sm">

              {mode === 'login' ? (
                <>
                  <h2 className="text-slate-900 text-2xl font-semibold mb-1.5">Entrar na conta</h2>
                  <p className="text-slate-500 text-sm mb-8">Digite suas credenciais para acessar o CRM.</p>

                  {successMsg && (
                    <div className="bg-emerald-50 border border-emerald-100 rounded-lg px-3.5 py-2.5 mb-4">
                      <p className="text-emerald-700 text-sm">{successMsg}</p>
                    </div>
                  )}

                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="relative">
                      <Mail className={iconCls} size={18} />
                      <input
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="E-mail"
                        required
                        className={inputCls}
                      />
                    </div>

                    <div className="relative">
                      <Lock className={iconCls} size={18} />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="Senha"
                        required
                        className="w-full pl-10 pr-10 py-2.5 rounded-lg border border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-900 caret-slate-800 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent focus:bg-white transition cursor-text [color-scheme:light]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                      >
                        {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>

                    {error && (
                      <div className="bg-red-50 border border-red-100 rounded-lg px-3.5 py-2.5">
                        <p className="text-red-600 text-sm">{error}</p>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300 text-white font-medium text-sm py-2.5 rounded-lg transition flex items-center justify-center gap-2 mt-1"
                    >
                      {loading && <Loader2 size={15} className="animate-spin" />}
                      {loading ? 'Entrando...' : 'Entrar'}
                    </button>
                  </form>

                  <p className="text-center text-sm text-slate-500 mt-6">
                    Ainda não tem conta?{' '}
                    <button
                      type="button"
                      onClick={() => switchMode('signup')}
                      className="text-emerald-600 font-semibold hover:text-emerald-700 transition"
                    >
                      Criar conta
                    </button>
                  </p>
                </>
              ) : (
                <>
                  <h2 className="text-slate-900 text-2xl font-semibold mb-1.5">Criar conta</h2>
                  <p className="text-slate-500 text-sm mb-8">Preencha os dados para se cadastrar.</p>

                  <form onSubmit={handleSignup} className="space-y-4">
                    <div className="relative">
                      <User className={iconCls} size={18} />
                      <input
                        type="text"
                        value={nome}
                        onChange={e => setNome(e.target.value)}
                        placeholder="Nome completo"
                        required
                        className={inputCls}
                      />
                    </div>

                    <div className="relative">
                      <Mail className={iconCls} size={18} />
                      <input
                        type="email"
                        value={signupEmail}
                        onChange={e => setSignupEmail(e.target.value)}
                        placeholder="E-mail"
                        required
                        className={inputCls}
                      />
                    </div>

                    <div className="relative">
                      <Lock className={iconCls} size={18} />
                      <input
                        type={showSignupPassword ? 'text' : 'password'}
                        value={signupPassword}
                        onChange={e => setSignupPassword(e.target.value)}
                        placeholder="Senha (mín. 6 caracteres)"
                        required
                        className="w-full pl-10 pr-10 py-2.5 rounded-lg border border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-900 caret-slate-800 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent focus:bg-white transition cursor-text [color-scheme:light]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSignupPassword(!showSignupPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                      >
                        {showSignupPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>

                    <div className="relative">
                      <Lock className={iconCls} size={18} />
                      <input
                        type={showSignupConfirm ? 'text' : 'password'}
                        value={signupConfirm}
                        onChange={e => setSignupConfirm(e.target.value)}
                        placeholder="Confirmar senha"
                        required
                        className="w-full pl-10 pr-10 py-2.5 rounded-lg border border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-900 caret-slate-800 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent focus:bg-white transition cursor-text [color-scheme:light]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSignupConfirm(!showSignupConfirm)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                      >
                        {showSignupConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>

                    {error && (
                      <div className="bg-red-50 border border-red-100 rounded-lg px-3.5 py-2.5">
                        <p className="text-red-600 text-sm">{error}</p>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300 text-white font-medium text-sm py-2.5 rounded-lg transition flex items-center justify-center gap-2 mt-1"
                    >
                      {loading && <Loader2 size={15} className="animate-spin" />}
                      {loading ? 'Cadastrando...' : 'Criar conta'}
                    </button>
                  </form>

                  <p className="text-center text-sm text-slate-500 mt-6">
                    Já tem conta?{' '}
                    <button
                      type="button"
                      onClick={() => switchMode('login')}
                      className="text-emerald-600 font-semibold hover:text-emerald-700 transition"
                    >
                      Entrar
                    </button>
                  </p>
                </>
              )}

            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
