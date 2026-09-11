/* 404 Page - Displays when a user attempts to access a non-existent route - translate to the language of the user */
import { useLocation } from 'react-router-dom'
import { useEffect } from 'react'

const NotFound = () => {
  const location = useLocation()

  useEffect(() => {
    console.error('404 Error: User attempted to access non-existent route:', location.pathname)
  }, [location.pathname])

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F1F3F5] px-4">
      <div className="text-center max-w-md bg-white p-8 rounded-2xl border border-[#E2E8F0] shadow-sm">
        <div className="w-12 h-12 rounded-xl bg-[#FEE2E2] text-[#D92323] flex items-center justify-center mx-auto mb-4 font-black text-lg">
          404
        </div>
        <h1 className="text-xl font-bold text-[#1E293B] mb-2">Página não encontrada</h1>
        <p className="text-xs text-[#64748B] mb-6">
          A rota solicitada não existe ou foi movida no sistema HARAMAQ CRM.
        </p>
        <a
          href="/"
          className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-[#D92323] hover:bg-[#B91C1C] text-white text-xs font-semibold shadow-xs transition-colors"
        >
          Voltar ao Início
        </a>
      </div>
    </div>
  )
}

export default NotFound
