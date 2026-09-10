import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider } from '@/contexts/AuthContext'
import ProtectedRoute from '@/components/ProtectedRoute'
import Layout from '@/components/Layout'

// Pages
import Login from '@/pages/Login'
import Dashboard from '@/pages/Index'
import Vendas from '@/pages/Vendas'
import Clientes from '@/pages/Clientes'
import ClienteDetalhe from '@/pages/ClienteDetalhe'
import Revendas from '@/pages/Revendas'
import RevendaDetalhe from '@/pages/RevendaDetalhe'
import Suporte from '@/pages/Suporte'
import Relatorios from '@/pages/Relatorios'
import Configuracoes from '@/pages/Configuracoes'
import AccessDenied from '@/pages/AccessDenied'
import NotFound from '@/pages/NotFound'

const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner position="top-right" duration={3500} richColors />
        <Routes>
          {/* Public Login Route */}
          <Route path="/login" element={<Login />} />

          {/* Authenticated Layout Wrapped Routes */}
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            {/* Dashboard / - accessible by admin, vendedor, suporte */}
            <Route index element={<Dashboard />} />

            {/* Vendas - admin & vendedor */}
            <Route
              path="vendas"
              element={
                <ProtectedRoute allowedRoles={['admin', 'vendedor']}>
                  <Vendas />
                </ProtectedRoute>
              }
            />

            {/* Clientes - admin, vendedor, suporte */}
            <Route path="clientes" element={<Clientes />} />
            <Route path="clientes/:id" element={<ClienteDetalhe />} />

            {/* Revendas - admin, vendedor */}
            <Route
              path="revendas"
              element={
                <ProtectedRoute allowedRoles={['admin', 'vendedor']}>
                  <Revendas />
                </ProtectedRoute>
              }
            />
            <Route
              path="revendas/:id"
              element={
                <ProtectedRoute allowedRoles={['admin', 'vendedor']}>
                  <RevendaDetalhe />
                </ProtectedRoute>
              }
            />

            {/* Suporte - admin, suporte */}
            <Route
              path="suporte"
              element={
                <ProtectedRoute allowedRoles={['admin', 'suporte']}>
                  <Suporte />
                </ProtectedRoute>
              }
            />

            {/* Relatórios - admin only */}
            <Route
              path="relatorios"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <Relatorios />
                </ProtectedRoute>
              }
            />

            {/* Configurações - admin only */}
            <Route
              path="configuracoes"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <Configuracoes />
                </ProtectedRoute>
              }
            />

            {/* Explicit Access Denied Screen */}
            <Route path="acesso-negado" element={<AccessDenied />} />

            {/* Legacy /dashboard redirect to root / */}
            <Route path="dashboard" element={<Navigate to="/" replace />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </TooltipProvider>
    </AuthProvider>
  </BrowserRouter>
)

export default App
