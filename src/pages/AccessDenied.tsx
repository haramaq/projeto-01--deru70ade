import React from 'react'
import { Link } from 'react-router-dom'
import { ShieldAlert, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function AccessDenied() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4 animate-fade-in-up">
      <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center text-red-600 mb-4 shadow-sm">
        <ShieldAlert className="w-8 h-8" />
      </div>
      <h1 className="text-2xl font-bold text-[#1B4332] mb-2">Acesso Negado</h1>
      <p className="text-gray-600 max-w-md mb-6 text-sm">
        Seu nível de acesso atual não possui permissão para visualizar esta área do sistema Haramaq.
      </p>
      <Link to="/">
        <Button className="bg-[#1B4332] hover:bg-[#2D6A4F] text-white gap-2 rounded-xl">
          <ArrowLeft className="w-4 h-4" />
          Voltar ao Dashboard
        </Button>
      </Link>
    </div>
  )
}
