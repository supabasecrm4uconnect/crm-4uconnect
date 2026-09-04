import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import './index.css'

function stripBom(value: string | undefined): string {
  if (!value) return ''
  return (value.charCodeAt(0) === 0xfeff ? value.slice(1) : value).trim()
}

const missingEnvironmentVariables = [
  !stripBom(import.meta.env.VITE_SUPABASE_URL) && 'VITE_SUPABASE_URL',
  !stripBom(import.meta.env.VITE_SUPABASE_ANON_KEY) && 'VITE_SUPABASE_ANON_KEY',
].filter((variable): variable is string => Boolean(variable))

const root = createRoot(document.getElementById('root')!)

if (missingEnvironmentVariables.length > 0) {
  root.render(
    <StrictMode>
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-slate-900">
        <section className="w-full max-w-lg rounded-2xl border border-amber-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wide text-amber-700">
            Configuração pendente
          </p>
          <h1 className="mt-2 text-2xl font-bold">Este ambiente ainda não está conectado ao Supabase.</h1>
          <p className="mt-4 text-sm leading-6 text-slate-600">
            Configure as variáveis abaixo no ambiente correspondente da Vercel e faça um novo deployment:
          </p>
          <code className="mt-4 block whitespace-pre-wrap rounded-lg bg-slate-950 p-4 text-sm text-slate-100">
            {missingEnvironmentVariables.join('\n')}
          </code>
        </section>
      </main>
    </StrictMode>,
  )
} else {
  void import('./App.tsx').then(({ default: App }) => {
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  })
}
