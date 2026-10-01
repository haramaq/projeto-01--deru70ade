import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider } from '@/contexts/AuthContext'
import ProtectedRoute from '@/components/ProtectedRoute'
import Layout from '@/components/Layout'
import Login from '@/pages/Login'
import Dashboard from '@/pages/Index'
import Vendas from '@/pages/Vendas'
import Clientes from '@/pages/Clientes'
import ClienteDetalhe from '@/pages/ClienteDetalhe'
import ClientesUnificados from '@/pages/ClientesUnificados'
import RevendaDetalhe from '@/pages/RevendaDetalhe'
import Suporte from '@/pages/Suporte'
import Relatorios from '@/pages/Relatorios'
import Configuracoes from '@/pages/Configuracoes'
import Feiras from '@/pages/Feiras'
import AccessDenied from '@/pages/AccessDenied'
import NotFound from '@/pages/NotFound'

const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner position="top-right" duration={3500} richColors />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route
              index
              element={
                <ProtectedRoute requiredPermission="dashboard">
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="vendas"
              element={
                <ProtectedRoute requiredPermission="leads">
                  <Vendas />
                </ProtectedRoute>
              }
            />
            <Route
              path="clientes"
              element={
                <ProtectedRoute requiredPermission="clientes">
                  <ClientesUnificados />
                </ProtectedRoute>
              }
            />
            <Route
              path="clientes/:id"
              element={
                <ProtectedRoute requiredPermission="clientes">
                  <ClienteDetalhe />
                </ProtectedRoute>
              }
            />
            <Route path="revendas" element={<Navigate to="/clientes?tipo=revenda" replace />} />
            <Route
              path="revendas/:id"
              element={
                <ProtectedRoute requiredPermission="revendas">
                  <RevendaDetalhe />
                </ProtectedRoute>
              }
            />
            <Route
              path="suporte"
              element={
                <ProtectedRoute requiredPermission="suporte">
                  <Suporte />
                </ProtectedRoute>
              }
            />
            <Route
              path="relatorios"
              element={
                <ProtectedRoute requiredPermission="relatorios">
                  <Relatorios />
                </ProtectedRoute>
              }
            />
            <Route
              path="feiras"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <Feiras />
                </ProtectedRoute>
              }
            />
            <Route
              path="configuracoes"
              element={
                <ProtectedRoute allowedRoles={['admin']} requiredPermission="configuracoes">
                  <Configuracoes />
                </ProtectedRoute>
              }
            />
            <Route path="acesso-negado" element={<AccessDenied />} />
            <Route path="dashboard" element={<Navigate to="/" replace />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </TooltipProvider>
    </AuthProvider>
  </BrowserRouter>
)

export default App
