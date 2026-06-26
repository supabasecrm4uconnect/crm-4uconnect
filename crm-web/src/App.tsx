import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import { StatusesProvider } from './contexts/StatusesContext'
import { FollowUpsProvider } from './contexts/FollowUpsContext'
import { BrandingProvider } from './contexts/BrandingContext'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Leads from './pages/Leads'
import Arquivados from './pages/Arquivados'
import FollowUps from './pages/FollowUps'
import Configuracoes from './pages/Configuracoes'
import Status from './pages/Status'

function Protected({ children }: { children: React.ReactNode }) {
  return <ProtectedRoute>{children}</ProtectedRoute>
}

export default function App() {
  return (
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
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
    </FollowUpsProvider>
    </StatusesProvider>
    </BrandingProvider>
  )
}
