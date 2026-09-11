import React from 'react'
import { Link } from 'react-router-dom'
import { ShieldAlert, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function AccessDenied() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4 animate-fade-in-up">
      <div className="w-16 h-16 rounded-full bg-[#FEE2E2] flex items-center justify-center text-[#D92323] mb-4 shadow-2xs">
        <ShieldAlert className="w-8 h-8" />
      </div>
      <h1 className="text-xl sm:text-2xl font-bold text-[#1E293B] mb-2">Acesso Restrito</h1>
      <p className="text-[#64748B] max-w-md mb-6 text-xs sm:text-sm leading-relaxed">
        Seu nível de acesso atual não possui permissão para visualizar este módulo do HARAMAQ CRM.
      </p>
      <Link to="/">
        <Button className="bg-[#D92323] hover:bg-[#B91C1C] text-white gap-2 rounded-lg text-xs font-semibold h-9 shadow-xs">
          <ArrowLeft className="w-4 h-4" />
          Voltar ao Painel
        </Button>
      </Link>
    </div>
  )
}
