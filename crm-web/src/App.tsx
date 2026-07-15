import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import { AuthProvider } from './contexts/AuthContext'
import { StatusesProvider } from './contexts/StatusesContext'
import { FollowUpsProvider } from './contexts/FollowUpsContext'
import { BrandingProvider } from './contexts/BrandingContext'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Leads from './pages/Leads'
import Arquivados from './pages/Arquivados'
import FollowUps from './pages/FollowUps'
import Configuracoes from './pages/Configuracoes'
import Diagnostico from './pages/Diagnostico'
import Status from './pages/Status'

function Protected({ children }: { children: React.ReactNode }) {
  return <ProtectedRoute>{children}</ProtectedRoute>
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const [allowed, setAllowed] = useState<boolean | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { setAllowed(false); return }
      supabase.from('profiles').select('is_admin').eq('id', user.id).single()
        .then(({ data }) => setAllowed(data?.is_admin === true))
    })
  }, [])

  if (allowed === null) return null
  if (!allowed) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <AuthProvider>
    <BrandingProvider>
    <StatusesProvider>
    <FollowUpsProvider>
    <BrowserRouter>
      <Routes>
        <Route path="/login"  element={<Login />} />
        <Route path="/status" element={<Status />} />
        <Route path="/dashboard"    element={<Protected><Dashboard /></Protected>} />
        <Route path="/leads"        element={<Protected><Leads /></Protected>} />
        <Route path="/arquivados"   element={<Protected><Arquivados /></Protected>} />
        <Route path="/followups"    element={<Protected><FollowUps /></Protected>} />
        <Route path="/configuracoes" element={<Protected><Configuracoes /></Protected>} />
        <Route path="/diagnostico"   element={<Protected><AdminRoute><Diagnostico /></AdminRoute></Protected>} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
    </FollowUpsProvider>
    </StatusesProvider>
    </BrandingProvider>
    </AuthProvider>
  )
}
